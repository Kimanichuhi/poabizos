export const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

export const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString();
};
