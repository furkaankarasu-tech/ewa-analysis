import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ReportSection } from "./report-structure.ts";

type PageText = { page: number; items: { str: string; x: number; y: number; height: number }[] };

// In SAP's PDF rating tables the coloured icon is immediately to the left of
// the check name. Inspect only that small region, never the coloured title or
// an unrelated chart. An ambiguous colour is left unknown.
export async function pdfSectionRatings(pdf: PDFDocumentProxy, pages: PageText[], sections: ReportSection[]) {
  const ratings = new Map<string, ReportSection["rating"]>();
  if (typeof document === "undefined") return ratings;
  for (const data of pages) {
    const anchors = data.items.filter((item) => item.str.trim() === "Rating Check").flatMap((header) => {
      const check = data.items.find((item) => item.y < header.y && header.y - item.y < 28 && item.x > header.x + 20 && item.x < header.x + 95 && item.str.trim().length > 5);
      const heading = data.items.filter((item) => item.y > header.y && item.y - header.y < 175 && item.height >= 11 && /^\d{1,2}(?:\.\d{1,2})+\s+/.test(item.str))
        .sort((a, b) => a.y - b.y)[0];
      const number = heading?.str.match(/^(\d{1,2}(?:\.\d{1,2})+)\s+/)?.[1];
      return check && number && sections.some((section) => section.number === number && section.page === data.page)
        ? [{ header, check, number }] : [];
    });
    if (!anchors.length) continue;
    const page = await pdf.getPage(data.page);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) continue;
    try { await page.render({ canvasContext: context, canvas, viewport }).promise; }
    catch { canvas.width = 0; canvas.height = 0; continue; }
    for (const { header, check, number } of anchors) {
      const x = Math.max(0, Math.floor((header.x + 1) * scale));
      const right = Math.min(canvas.width, Math.ceil((check.x - 3) * scale));
      const y = Math.max(0, Math.floor(viewport.height - (check.y + 9) * scale));
      const height = Math.min(canvas.height - y, Math.ceil(18 * scale));
      if (right <= x || height <= 0) continue;
      const pixels = context.getImageData(x, y, right - x, height).data;
      let red = 0, yellow = 0, green = 0;
      for (let at = 0; at < pixels.length; at += 4) {
        const [r, g, b, alpha] = [pixels[at], pixels[at + 1], pixels[at + 2], pixels[at + 3]];
        if (alpha < 100) continue;
        if (r > 120 && r > g * 1.4 && r > b * 1.4) red++;
        else if (r > 130 && g > 90 && b < 125 && r > b * 1.6) yellow++;
        else if (g > 90 && g > r * 1.25 && g > b * 1.2) green++;
      }
      const top = Math.max(red, yellow, green), second = [red, yellow, green].sort((a, b) => b - a)[1];
      if (top < 12 || top <= second * 1.25) continue;
      const rating = red === top ? "red" : yellow === top ? "yellow" : "green";
      const previous = ratings.get(number);
      if (!previous || previous === "green" || rating === "red") ratings.set(number, rating);
    }
    canvas.width = 0; canvas.height = 0;
  }
  return ratings;
}
