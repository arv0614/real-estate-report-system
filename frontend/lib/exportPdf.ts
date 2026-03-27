export async function exportToPdf(elementId: string, municipality: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `不動産診断レポート_${municipality}_${date}.pdf`;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let yOffset = 0;
  while (yOffset < imgHeight) {
    if (yOffset > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, -yOffset, imgWidth, imgHeight);
    yOffset += pageHeight;
  }

  // iOS Safari では pdf.save() が現在タブを上書きするため、
  // Blob URL + <a download> によるクリック方式に統一する。
  // <a>.click() はポップアップブロック対象外なので非同期後でも安全。
  const blob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.target = "_blank";   // iOS で download 未対応の場合も新タブで開く（上書き回避）
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
}
