import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface ExportColumn { header: string; key: string; format?: (v: any, row: any) => string | number; }

export function exportToExcel(filename: string, rows: any[], columns: ExportColumn[]) {
  const data = rows.map(r => {
    const o: Record<string, any> = {};
    columns.forEach(c => { o[c.header] = c.format ? c.format(r[c.key], r) : (r[c.key] ?? ""); });
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  rows: any[];
  columns: ExportColumn[];
  footer?: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
  doc.setFontSize(16); doc.text(opts.title, 40, 40);
  if (opts.subtitle) { doc.setFontSize(10); doc.setTextColor(120); doc.text(opts.subtitle, 40, 58); doc.setTextColor(0); }
  autoTable(doc, {
    startY: 75,
    head: [opts.columns.map(c => c.header)],
    body: opts.rows.map(r => opts.columns.map(c => {
      const v = c.format ? c.format(r[c.key], r) : (r[c.key] ?? "");
      return v == null ? "" : String(v);
    })),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  if (opts.footer) {
    const y = (doc as any).lastAutoTable?.finalY ?? 100;
    doc.setFontSize(10); doc.text(opts.footer, 40, y + 24);
  }
  doc.save(`${opts.filename}.pdf`);
}
