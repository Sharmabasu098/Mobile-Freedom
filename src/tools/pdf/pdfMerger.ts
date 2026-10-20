import { PDFDocument } from "pdf-lib";

/**
 * Merge two or more PDF files into one PDF.
 * Processing happens locally in the browser.
 */
export async function mergePdfFiles(
  files: File[]
): Promise<Uint8Array> {
  if (files.length < 2) {
    throw new Error("Please select at least two PDF files.");
  }

  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    if (file.type !== "application/pdf") {
      throw new Error(`"${file.name}" is not a PDF file.`);
    }

    const fileBytes = await file.arrayBuffer();

    const sourcePdf = await PDFDocument.load(fileBytes);

    const copiedPages = await mergedPdf.copyPages(
      sourcePdf,
      sourcePdf.getPageIndices()
    );

    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  return await mergedPdf.save();
}
