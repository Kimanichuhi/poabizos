// Server-only helper: assemble a compact live business snapshot the AI can cite.
export async function buildBusinessContext(supabase: any, tenantId: string): Promise<string> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [tenantRes, salesRes, itemsRes, productsRes, debtorsRes, expensesRes, employeesRes, payrollRes, featuresRes] =
    await Promise.all([
      supabase.from("tenants").select("business_name, business_type, currency, subscription_plan").eq("id", tenantId).maybeSingle(),
      supabase.from("sales").select("total_amount, sale_date, status").gte("sale_date", thirtyDaysAgo).eq("tenant_id", tenantId),
      supabase.from("sale_items").select("description, quantity, line_total, sale_id, sales!inner(sale_date, tenant_id)").eq("tenant_id", tenantId).gte("sales.sale_date", thirtyDaysAgo).limit(500),
      supabase.from("products").select("name, sku, stock_quantity, reorder_level, is_service").eq("tenant_id", tenantId).is("archived_at", null).limit(500),
      supabase.from("debtors").select("amount_owed, status, customers(name)").eq("tenant_id", tenantId).eq("status", "open").order("amount_owed", { ascending: false }).limit(10),
      supabase.from("expenses").select("amount, category, expense_date").gte("expense_date", monthStart).eq("tenant_id", tenantId),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("payrolls").select("gross_pay, net_pay, period_end").eq("tenant_id", tenantId).order("period_end", { ascending: false }).limit(5),
      supabase.rpc("get_tenant_features", { _tenant_id: tenantId }),
    ]);

  const t = tenantRes.data ?? {};
  const currency = (t.currency as string) || "KES";
  const sales = salesRes.data ?? [];
  const salesTotal = sales.reduce((a: number, r: any) => a + Number(r.total_amount || 0), 0);
  const salesCount = sales.length;

  // Top products (last 30d) by revenue
  const productAgg = new Map<string, { units: number; revenue: number }>();
  for (const it of itemsRes.data ?? []) {
    const key = it.description || "Item";
    const prev = productAgg.get(key) ?? { units: 0, revenue: 0 };
    prev.units += Number(it.quantity || 0);
    prev.revenue += Number(it.line_total || 0);
    productAgg.set(key, prev);
  }
  const topProducts = [...productAgg.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, v]) => `- ${name}: ${v.units} sold, ${currency} ${v.revenue.toFixed(0)}`);

  const products = productsRes.data ?? [];
  const totalSKUs = products.length;
  const lowStock = products
    .filter((p: any) => !p.is_service && p.reorder_level != null && Number(p.stock_quantity ?? 0) <= Number(p.reorder_level))
    .slice(0, 10)
    .map((p: any) => `- ${p.name} (${p.sku ?? "no sku"}): ${p.stock_quantity} left, reorder at ${p.reorder_level}`);

  const debtors = debtorsRes.data ?? [];
  const debtorsTotal = debtors.reduce((a: number, r: any) => a + Number(r.amount_owed || 0), 0);
  const topDebtors = debtors.slice(0, 5).map((d: any) => `- ${d.customers?.name ?? "Unknown"}: ${currency} ${Number(d.amount_owed).toFixed(0)}`);

  const expenses = expensesRes.data ?? [];
  const expTotal = expenses.reduce((a: number, r: any) => a + Number(r.amount || 0), 0);
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category || "Other", (byCat.get(e.category || "Other") ?? 0) + Number(e.amount || 0));
  const expByCat = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) => `- ${c}: ${currency} ${v.toFixed(0)}`);

  const employeeCount = employeesRes.count ?? 0;
  const lastPayroll = (payrollRes.data ?? [])[0];

  const features = (featuresRes.data ?? []).map((r: any) => r.feature_key as string);

  return [
    `Business: ${t.business_name ?? "Workspace"} (${t.business_type ?? "n/a"}) — currency ${currency}, package ${t.subscription_plan ?? "n/a"}.`,
    `\nSales (last 30 days): ${salesCount} orders, total ${currency} ${salesTotal.toFixed(0)}.`,
    topProducts.length ? `Top selling items:\n${topProducts.join("\n")}` : "No sales in the last 30 days.",
    `\nInventory: ${totalSKUs} active SKUs.`,
    lowStock.length ? `Low-stock items:\n${lowStock.join("\n")}` : "No items below reorder level.",
    `\nDebtors: ${debtors.length} open, total outstanding ${currency} ${debtorsTotal.toFixed(0)}.`,
    topDebtors.length ? `Top debtors:\n${topDebtors.join("\n")}` : "",
    `\nExpenses (month-to-date): ${currency} ${expTotal.toFixed(0)}.`,
    expByCat.length ? `By category:\n${expByCat.join("\n")}` : "",
    `\nHR: ${employeeCount} employees.` + (lastPayroll ? ` Last payroll (${lastPayroll.period_end}): net ${currency} ${Number(lastPayroll.net_pay || 0).toFixed(0)}.` : ""),
    `\nModules available in this package: ${features.join(", ") || "none"}.`,
  ].filter(Boolean).join("\n");
}

export function sanitizeAiText(text: string): string {
  // Remove markdown emphasis stars per user preference; keep hyphen bullets.
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1$2")
    .replace(/^\s*\*\s+/gm, "- ");
}
