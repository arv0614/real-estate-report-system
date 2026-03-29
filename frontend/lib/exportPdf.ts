// Tailwind CSS v4 は oklch()/lab() カラー関数を使用しており、html2canvas が解釈できない。
// キャプチャ直前に :root のカスタムプロパティを hex 値で上書きし、キャプチャ後に削除する。
const OKLCH_COLOR_OVERRIDE_ID = "pdf-color-override";
const OKLCH_COLOR_OVERRIDE_CSS = `
  :root {
    --background: #ffffff !important;
    --foreground: #09090b !important;
    --card: #ffffff !important;
    --card-foreground: #09090b !important;
    --popover: #ffffff !important;
    --popover-foreground: #09090b !important;
    --primary: #18181b !important;
    --primary-foreground: #fafafa !important;
    --secondary: #f4f4f5 !important;
    --secondary-foreground: #18181b !important;
    --muted: #f4f4f5 !important;
    --muted-foreground: #71717a !important;
    --accent: #f4f4f5 !important;
    --accent-foreground: #18181b !important;
    --destructive: #dc2626 !important;
    --border: #e4e4e7 !important;
    --input: #e4e4e7 !important;
    --ring: #a1a1aa !important;
    --chart-1: #d4d4d8 !important;
    --chart-2: #71717a !important;
    --chart-3: #52525b !important;
    --chart-4: #3f3f46 !important;
    --chart-5: #27272a !important;
  }
`;

export interface PdfExportOptions {
  /** 暮らしのイメージ画像を含める（data-pdf-lifestyle-image 属性を持つ要素） */
  includeLifestyleImage: boolean;
  /** 地図を含める（data-pdf-map 属性を持つ要素） */
  includeMap: boolean;
}

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  includeLifestyleImage: true,
  includeMap: true,
};

export async function exportToPdf(
  elementId: string,
  municipality: string,
  options: PdfExportOptions = DEFAULT_PDF_OPTIONS
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `不動産診断レポート_${municipality}_${date}.pdf`;

  // oklch カラー変数を hex で上書き（html2canvas-pro がパースできない色への対策）
  const styleEl = document.createElement("style");
  styleEl.id = OKLCH_COLOR_OVERRIDE_ID;
  styleEl.textContent = OKLCH_COLOR_OVERRIDE_CSS;
  document.head.appendChild(styleEl);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      ignoreElements: (el: Element) => {
        if (!options.includeLifestyleImage && el.hasAttribute("data-pdf-lifestyle-image")) return true;
        if (!options.includeMap && el.hasAttribute("data-pdf-map")) return true;
        return false;
      },
    });
  } finally {
    document.head.removeChild(styleEl);
  }

  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  // ページ分割なし: コンテンツ全体を1枚のカスタムサイズページに収める
  // → addImage の yOffset 分割で発生する黒線アーティファクトを根本的に排除
  const pdfWidth = 210; // A4幅 (mm)
  const pdfHeight = (canvas.height / canvas.width) * pdfWidth;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pdfWidth, pdfHeight],
  });
  pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

  // iOS Safari では pdf.save() が現在タブを上書きするため、
  // Blob URL + <a download> によるクリック方式に統一する。
  const blob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
}
