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
  /**
   * Pro プラン向けホワイトラベル設定。
   * companyName または companyLogoUrl が指定されると、PDF の先頭にブランドヘッダーを描画する。
   * 未指定の場合はデフォルトのヘッダー（物件目利きリサーチ）を使用。
   */
  whiteLabel?: {
    companyName?: string;
    companyLogoUrl?: string;
  };
}

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  includeLifestyleImage: true,
  includeMap: false,
};

const WHITE_LABEL_HEADER_ID = "pdf-white-label-header";

/**
 * 指定要素配下の `<img>` がすべて読み込み完了するまで待機する。
 * 各画像ごとに最大 5 秒、要素全体としても最大 10 秒で打ち切る。
 * 失敗・タイムアウトしても resolve するので、キャプチャ自体は必ず走る。
 */
async function waitForImagesToLoad(root: HTMLElement, perImageTimeoutMs = 5000, overallTimeoutMs = 10000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  if (imgs.length === 0) return;
  const tasks = imgs.map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete && img.naturalHeight !== 0) return resolve();
        const finish = () => resolve();
        img.addEventListener("load", finish, { once: true });
        img.addEventListener("error", finish, { once: true });
        setTimeout(finish, perImageTimeoutMs);
      })
  );
  await Promise.race([
    Promise.all(tasks).then(() => undefined),
    new Promise<void>((r) => setTimeout(r, overallTimeoutMs)),
  ]);
}

/**
 * ホワイトラベルヘッダー DOM を生成して `element` の先頭に挿入する。
 * 戻り値はクリーンアップ用。
 *
 * 注意: html2canvas は CORS タグなしの cross-origin 画像を tainted canvas として
 * 描画失敗にする。Firebase Storage のダウンロード URL は CORS 設定済みなので
 * crossOrigin="anonymous" + useCORS:true で取り込める。
 */
async function injectWhiteLabelHeader(
  element: HTMLElement,
  whiteLabel: NonNullable<PdfExportOptions["whiteLabel"]>
): Promise<() => void> {
  const companyName = whiteLabel.companyName?.trim() ?? "";
  const companyLogoUrl = whiteLabel.companyLogoUrl?.trim() ?? "";
  if (!companyName && !companyLogoUrl) return () => {};

  const header = document.createElement("div");
  header.id = WHITE_LABEL_HEADER_ID;
  header.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:16px",
    "padding:14px 20px",
    "margin-bottom:12px",
    "background:#ffffff",
    "border:1px solid #e2e8f0",
    "border-radius:12px",
    "border-left:6px solid #2563eb",
  ].join(";");

  if (companyLogoUrl) {
    const img = document.createElement("img");
    img.src = companyLogoUrl;
    img.alt = companyName || "logo";
    img.crossOrigin = "anonymous";
    img.style.cssText = "height:44px;width:auto;max-width:180px;object-fit:contain";
    header.appendChild(img);
    // 画像読み込みを待つ（タイムアウト 3 秒）。失敗時は img を残したまま続行。
    await new Promise<void>((resolve) => {
      if (img.complete && img.naturalHeight !== 0) return resolve();
      const finish = () => resolve();
      img.addEventListener("load", finish, { once: true });
      img.addEventListener("error", finish, { once: true });
      setTimeout(finish, 3000);
    });
  }

  if (companyName) {
    const name = document.createElement("div");
    name.textContent = companyName;
    name.style.cssText = "font-size:18px;font-weight:700;color:#0f172a;letter-spacing:0.01em";
    header.appendChild(name);
  }

  const label = document.createElement("div");
  label.textContent = "Property Report";
  label.style.cssText = "margin-left:auto;font-size:11px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase";
  header.appendChild(label);

  element.insertBefore(header, element.firstChild);
  return () => {
    if (header.parentNode === element) {
      element.removeChild(header);
    }
  };
}

/**
 * PDF を生成して Blob URL を返す。
 * window.open はカスタマで呼ぶこと（状態リセット後に実行しないと iOS bfcache でフリーズする）。
 */
export async function exportToPdf(
  elementId: string,
  municipality: string,
  options: PdfExportOptions = DEFAULT_PDF_OPTIONS
): Promise<{ blobUrl: string; filename: string }> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`element #${elementId} not found`);

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

  // body.pdf-export クラスを付与して pdf-hide 要素を非表示にする
  document.body.classList.add("pdf-export");

  // Pro ホワイトラベルヘッダーを差し込む（画像ロードを await）
  const removeHeader = options.whiteLabel
    ? await injectWhiteLabelHeader(element, options.whiteLabel)
    : () => {};

  // キャプチャ対象内の <img> がすべて読み込み完了するまで待機。
  // Firebase Storage 等の外部画像が遅延読み込み中だとキャプチャが空になるため。
  await waitForImagesToLoad(element);
  // レンダリング/レイアウト確定のための猶予（lifestyle画像のフェードインアニメ等）
  await new Promise((r) => setTimeout(r, 1000));

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      // CORS 取得に失敗した cross-origin 画像も描画する（タイント canvas を許容）。
      // useCORS が成功すれば tainted にならず toDataURL も問題なし。
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 15000,
      ignoreElements: (el: Element) => {
        if (!options.includeLifestyleImage && el.hasAttribute("data-pdf-lifestyle-image")) return true;
        if (!options.includeMap && el.hasAttribute("data-pdf-map")) return true;
        return false;
      },
    });
  } finally {
    removeHeader();
    document.body.classList.remove("pdf-export");
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

  const blob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  return { blobUrl, filename };
}
