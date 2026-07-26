import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Search, ScanLine } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { BarcodeScanner } from "@/components/barcode-scanner";

type Item = {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  is_service: boolean;
  staff_id?: string | null;
  notes?: string;
  available?: number | null;
};

const blankItem = (): Item => ({
  product_id: null, description: "", quantity: 1, unit_price: 0, discount: 0, is_service: false, available: null,
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SaleDialog({ open, onOpenChange }: Props) {
  const { tenant } = useAuth();
  const qc = useQueryClient();

  const [saleType, setSaleType] = useState("cash");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing">("walkin");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [amountReceived, setAmountReceived] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  const onBarcode = async (code: string) => {
    const { data, error } = await (supabase as any).rpc("find_product_by_barcode", { _code: code });
    const found = Array.isArray(data) ? data[0] : data;
    if (error || !found) { toast.error(`No product for code "${code}"`); return; }
    setItems(prev => {
      const idx = prev.findIndex(it => it.product_id === found.id);
      if (idx >= 0) {
        return prev.map((it, i) => i === idx ? { ...it, quantity: Number(it.quantity) + 1 } : it);
      }
      const filled: Item = {
        product_id: found.id, description: found.name, quantity: 1,
        unit_price: Number(found.price ?? 0), discount: 0,
        is_service: !!found.is_service,
        available: found.is_service ? null : found.stock_quantity,
      };
      const hasEmpty = prev.length === 1 && !prev[0].description && !prev[0].product_id;
      return hasEmpty ? [filled] : [...prev, filled];
    });
    toast.success(`Added ${found.name}`);
  };

  useEffect(() => {
    if (open) {
      setSaleType("cash"); setSaleDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod("cash"); setCustomerMode("walkin"); setCustomerId(null);
      setCustomerName(""); setCustomerPhone(""); setItems([blankItem()]);
      setDiscount(0); setTax(0); setAmountReceived(0); setDueDate(""); setNotes("");
    }
  }, [open]);

  useEffect(() => {
    // Default payment method follows sale type
    const map: Record<string, string> = { cash: "cash", mpesa: "mpesa", bank: "bank", credit: "credit" };
    if (map[saleType]) setPaymentMethod(map[saleType]);
  }, [saleType]);

  const { data: products = [] } = useQuery({
    queryKey: ["products-lookup", tenant?.id],
    enabled: !!tenant?.id && open,
    queryFn: async () => {
      const { data } = await (supabase as any).from("products").select("id,name,sku,price,stock_quantity,is_service").eq("status", "active").order("name").limit(500);
      return data ?? [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-lookup", tenant?.id],
    enabled: !!tenant?.id && open,
    queryFn: async () => {
      const { data } = await (supabase as any).from("customers").select("id,name,phone").order("name").limit(500);
      return data ?? [];
    },
  });

  const subtotal = useMemo(() =>
    items.reduce((s, it) => s + Math.max(0, (Number(it.quantity) || 0) * (Number(it.unit_price) || 0) - (Number(it.discount) || 0)), 0),
  [items]);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));
  const balance = total - (Number(amountReceived) || 0);
  const change = balance < 0 ? -balance : 0;

  const updateItem = (i: number, patch: Partial<Item>) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };

  const pickProduct = (i: number, productId: string) => {
    const p = products.find((x: any) => x.id === productId);
    if (!p) return;
    updateItem(i, {
      product_id: p.id,
      description: p.name,
      unit_price: Number(p.price ?? 0),
      is_service: !!p.is_service,
      available: p.is_service ? null : p.stock_quantity,
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const validItems = items.filter(it => it.description && Number(it.quantity) > 0);
      if (validItems.length === 0) throw new Error("Add at least one item");
      // Enforce stock availability before sending to RPC
      for (const it of validItems) {
        if (!it.is_service && it.product_id) {
          const p = products.find((x: any) => x.id === it.product_id);
          const avail = Number(p?.stock_quantity ?? 0);
          if (Number(it.quantity) > avail) {
            throw new Error(`Insufficient stock for "${it.description}" — only ${avail} available`);
          }
        }
      }
      const payload = {
        sale_type: saleType,
        sale_date: saleDate,
        payment_method: paymentMethod,
        customer_id: customerMode === "existing" ? customerId : null,
        customer_name: customerMode === "existing" ? (customers.find((c: any) => c.id === customerId)?.name ?? null) : (customerName || "Walk-in"),
        customer_phone: customerMode === "existing" ? (customers.find((c: any) => c.id === customerId)?.phone ?? null) : customerPhone,
        discount, tax, amount_received: saleType === "credit" ? amountReceived : (amountReceived || total),
        due_date: saleType === "credit" ? (dueDate || null) : null,
        notes,
        items: validItems.map(it => ({
          product_id: it.product_id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: it.discount,
          is_service: it.is_service,
        })),
      };
      const { data, error } = await (supabase as any).rpc("record_sale", { _payload: payload });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Sale recorded");
      qc.invalidateQueries({ queryKey: ["resource", "sales"] });
      qc.invalidateQueries({ queryKey: ["products-lookup"] });
      qc.invalidateQueries({ queryKey: ["resource", "products"] });
      qc.invalidateQueries({ queryKey: ["resource", "debtors"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save sale"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Sale</DialogTitle></DialogHeader>

        {/* Sale info */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Sale Type</Label>
            <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={saleType} onChange={e => setSaleType(e.target.value)}>
              <option value="cash">Cash Sale</option>
              <option value="credit">Credit Sale</option>
              <option value="mpesa">M-Pesa Sale</option>
              <option value="bank">Bank Payment</option>
              <option value="flutterwave">Flutterwave</option>
            </select>
          </div>
          <div>
            <Label>Sale Date</Label>
            <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Customer</Label>
            <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={customerMode} onChange={e => setCustomerMode(e.target.value as any)}>
              <option value="walkin">Walk-in Customer</option>
              <option value="existing">Existing Customer</option>
            </select>
          </div>
        </section>

        {customerMode === "existing" ? (
          <div>
            <Label>Search customer</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <select className="w-full h-9 pl-9 pr-3 rounded-md border bg-background text-sm" value={customerId ?? ""} onChange={e => setCustomerId(e.target.value || null)}>
                <option value="">— select customer —</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
                ))}
              </select>
            </div>
          </div>
        ) : saleType === "credit" && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Customer name</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-1.5" /></div>
            <div><Label>Phone</Label><Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="mt-1.5" /></div>
          </div>
        )}

        {/* Items */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label>Products / Services</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setScanOpen(true)}>
                <ScanLine className="h-3.5 w-3.5 mr-1" /> Scan
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems(p => [...p, blankItem()])}>
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => {
              const line = Math.max(0, (Number(it.quantity) || 0) * (Number(it.unit_price) || 0) - (Number(it.discount) || 0));
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2.5">
                  <div className="col-span-12 sm:col-span-4">
                    <Label className="text-xs">Product / Service</Label>
                    <select
                      className="w-full h-9 px-2 rounded-md border bg-background text-sm mt-1"
                      value={it.product_id ?? ""}
                      onChange={e => e.target.value ? pickProduct(i, e.target.value) : updateItem(i, { product_id: null })}
                    >
                      <option value="">— custom / service —</option>
                      {products.map((p: any) => (
                        <option key={p.id} value={p.id} disabled={!p.is_service && p.stock_quantity <= 0}>
                          {p.name}{p.is_service ? " (service)" : ` · stock ${p.stock_quantity}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-12 sm:col-span-3">
                    <Label className="text-xs">Description</Label>
                    <Input className="mt-1" value={it.description} onChange={e => updateItem(i, { description: e.target.value })} placeholder="Item name" />
                  </div>
                  <div className="col-span-4 sm:col-span-1">
                    <Label className="text-xs">Qty</Label>
                    <Input className="mt-1" type="number" min="0" step="0.01" value={it.quantity} onChange={e => updateItem(i, { quantity: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-xs">Unit price</Label>
                    <Input className="mt-1" type="number" min="0" step="0.01" value={it.unit_price} onChange={e => updateItem(i, { unit_price: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-4 sm:col-span-1">
                    <Label className="text-xs">Disc</Label>
                    <Input className="mt-1" type="number" min="0" step="0.01" value={it.discount} onChange={e => updateItem(i, { discount: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-10 sm:col-span-1 text-right">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-medium text-sm">{fmtMoney(line)}</div>
                    {it.available != null && (
                      <div className={`text-[10px] ${it.available < it.quantity ? "text-destructive" : "text-muted-foreground"}`}>
                        stock {it.available}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-12 sm:flex sm:justify-end">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setItems(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : p)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Summary */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
          <div className="space-y-2">
            <div>
              <Label>Payment method</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="airtel">Airtel Money</option>
                <option value="bank">Bank</option>
                <option value="credit">Credit</option>
                <option value="flutterwave">Flutterwave</option>
              </select>
            </div>
            <div>
              <Label>Amount received</Label>
              <Input type="number" min="0" step="0.01" value={amountReceived} onChange={e => setAmountReceived(Number(e.target.value))} className="mt-1.5" />
            </div>
            {saleType === "credit" && (
              <div>
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1.5" />
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div className="space-y-1.5 bg-muted/30 rounded-md p-3 text-sm self-start">
            <Row label="Subtotal" value={fmtMoney(subtotal)} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Discount</span>
              <Input type="number" min="0" step="0.01" className="h-7 w-28 text-right" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Tax</span>
              <Input type="number" min="0" step="0.01" className="h-7 w-28 text-right" value={tax} onChange={e => setTax(Number(e.target.value))} />
            </div>
            <Row label="Grand total" value={fmtMoney(total)} bold />
            <Row label={balance >= 0 ? "Balance" : "Change"} value={fmtMoney(balance >= 0 ? balance : change)} />
          </div>
        </section>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save Sale"}
          </Button>
        </DialogFooter>
        <BarcodeScanner open={scanOpen} onOpenChange={setScanOpen} onScan={onBarcode} title="Scan product barcode" />
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold text-base pt-1 border-t" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
