import type { Alignment, Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ExportResult } from "./export";
import { formatNumber, formatTL } from "./format";

export interface PdfReportInfo {
  /** e.g. "Harcama Raporu" */
  title: string;
  /** Vehicle(s), e.g. "Aile Arabası · 34 ABC 12" or "Tüm araçlar" */
  scope: string;
  /** e.g. "01.01.2026 – 31.12.2026" or "Tüm zamanlar" */
  period: string;
  /** Who made it, shown in the footer. */
  username: string;
  reminders: boolean;
}

// CarLog blue and slate, as in the app.
const BRAND = "#1f68d1";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const ZEBRA = "#f8fafc";

/**
 * Builds the report and returns it as a PDF file. pdfmake and its Roboto fonts (which cover
 * ç, ğ, ı, İ, ö, ş, ü) are loaded only now, so they don't weigh on the app's first load.
 */
export async function buildPdf(result: ExportResult, info: PdfReportInfo): Promise<Blob> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  (pdfMake as unknown as { vfs: unknown }).vfs = vfs;

  const created = new Date().toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const { table } = result;

  const summary: [string, string][] = info.reminders
    ? [["Hatırlatma", String(result.rowCount)]]
    : [
        ["Toplam", formatTL(result.total)],
        ["Yakıt", formatTL(result.fuelTotal)],
        ["Diğer masraflar", formatTL(result.otherTotal)],
        ["Alınan yakıt", `${formatNumber(result.liters, 1)} L`],
        ["Kayıt", String(result.rowCount)],
      ];

  const content: Content[] = [
    {
      columns: [
        { text: [{ text: "CarLog", color: BRAND, bold: true }, { text: "  ·  Yakıt gideri takibi", color: MUTED, fontSize: 9 }], fontSize: 12 },
        { text: created, alignment: "right", color: MUTED, fontSize: 9 },
      ],
    },
    { text: info.title, fontSize: 20, bold: true, color: INK, margin: [0, 14, 0, 2] },
    { text: `${info.scope}  ·  ${info.period}`, color: MUTED, fontSize: 10, margin: [0, 0, 0, 14] },
    {
      // Summary figures in a row of light boxes.
      table: {
        widths: summary.map(() => "*"),
        body: [
          summary.map(([label, value]) => ({
            stack: [
              { text: label, color: MUTED, fontSize: 8 },
              { text: value, bold: true, fontSize: 13, color: INK, margin: [0, 2, 0, 0] },
            ],
            fillColor: "#eef6ff",
            margin: [8, 7, 8, 7],
          })),
        ],
      },
      layout: { hLineWidth: () => 0, vLineWidth: () => 4, vLineColor: () => "#ffffff" },
      margin: [0, 0, 0, 16],
    },
    {
      table: {
        headerRows: 1,
        widths: table.widths,
        body: [
          table.header.map((h, i) => ({
            text: h,
            bold: true,
            color: "#ffffff",
            fillColor: BRAND,
            alignment: (table.right.includes(i) ? "right" : "left") as Alignment,
          })),
          ...table.rows.map((row) =>
            row.map((cell, i) => ({ text: cell, alignment: (table.right.includes(i) ? "right" : "left") as Alignment })),
          ),
        ],
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 || i === 1 ? 0 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => LINE,
        fillColor: (row: number) => (row > 0 && row % 2 === 0 ? ZEBRA : null),
        paddingTop: () => 5,
        paddingBottom: () => 5,
        paddingLeft: () => 6,
        paddingRight: () => 6,
      },
      fontSize: 8.5,
    },
  ];

  if (!info.reminders && table.rows.length > 0) {
    content.push({
      text: `Toplam ${formatTL(result.total)}`,
      alignment: "right",
      bold: true,
      fontSize: 11,
      margin: [0, 10, 0, 0],
      color: INK,
    });
  }

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    // The spending table has nine columns; landscape keeps notes readable.
    pageOrientation: info.reminders ? "portrait" : "landscape",
    pageMargins: [36, 36, 36, 44],
    info: { title: `CarLog – ${info.title}`, author: info.username, creator: "CarLog" },
    defaultStyle: { font: "Roboto", fontSize: 10, color: INK },
    content,
    footer: (page: number, pages: number) => ({
      columns: [
        { text: `${info.username} için CarLog ile oluşturuldu`, color: MUTED, fontSize: 8 },
        { text: `${page} / ${pages}`, alignment: "right", color: MUTED, fontSize: 8 },
      ],
      margin: [36, 14, 36, 0],
    }),
  };

  return new Promise((resolve, reject) => {
    try {
      // pdfmake 0.2 hands the blob to a callback (the bundled types describe the newer promise API).
      const pdf = pdfMake.createPdf(doc) as unknown as { getBlob: (done: (blob: Blob) => void) => void };
      pdf.getBlob((blob) => resolve(blob));
    } catch (err) {
      reject(err);
    }
  });
}
