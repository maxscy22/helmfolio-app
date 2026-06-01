export type PdfExportResult = { ok: boolean; error?: string };

// PDF page dimensions are capped by the spec at 14400pt (200in). Stay just under
// so a single-page "screenshot" PDF is used whenever the dashboard fits, and we
// fall back to paginated A4 only for extremely long dashboards.
const PDF_MAX_PT = 14000;
const PX_TO_PT = 72 / 96;

// Capture an element (and its themed background) to a single image, then save it
// as a PDF that looks like a screenshot of the whole element.
export async function exportElementToPdf(element: HTMLElement, fileName: string): Promise<PdfExportResult> {
  // Temporarily hide transient UI (sticky nav, dev toggles) so the capture is clean.
  const hiddenEls = Array.from(document.querySelectorAll<HTMLElement>('[data-pdf-hide]'));
  const previousDisplay = hiddenEls.map((el) => el.style.display);
  hiddenEls.forEach((el) => { el.style.display = 'none'; });

  try {
    // Lazy-load the heavy PDF/canvas libraries only when the user exports, so
    // they stay out of the initial app bundle.
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas-pro'),
    ]);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#020617',
      logging: false,
      windowWidth: element.scrollWidth,
      width: element.scrollWidth,
      height: element.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const cssWidthPt = element.scrollWidth * PX_TO_PT;
    const cssHeightPt = element.scrollHeight * PX_TO_PT;

    if (cssWidthPt <= PDF_MAX_PT && cssHeightPt <= PDF_MAX_PT) {
      // Single page sized to the dashboard — a true full-page screenshot.
      const pdf = new jsPDF({
        orientation: cssWidthPt > cssHeightPt ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [cssWidthPt, cssHeightPt],
        compress: true,
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, cssWidthPt, cssHeightPt);
      pdf.save(fileName);
      return { ok: true };
    }

    // Fallback: very long dashboard — paginate the image across A4 pages.
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(fileName);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'PDF export failed.' };
  } finally {
    hiddenEls.forEach((el, index) => { el.style.display = previousDisplay[index]; });
  }
}
