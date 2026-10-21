// M5.7 — PDF Splitter Core

import { PDFDocument } from "pdf-lib";

/**
 * Split a PDF into separate one-page PDF files.
 *
 * @param file The original PDF file.
 * @returns An array containing one PDF byte array per page.
 */
export async function splitPdfFile(
  file: File
): Promise<Uint8Array[]> {
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Please select a valid PDF file.");
  }

  const fileBytes = await file.arrayBuffer();

  const sourcePdf = await PDFDocument.load(fileBytes);

  const pageCount = sourcePdf.getPageCount();

  if (pageCount < 2) {
    throw new Error("The PDF must contain at least two pages to split.");
  }

  const splitFiles: Uint8Array[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const newPdf = await PDFDocument.create();

    const [copiedPage] = await newPdf.copyPages(
      sourcePdf,
      [pageIndex]
    );

    newPdf.addPage(copiedPage);

    const pdfBytes = await newPdf.save();

    splitFiles.push(pdfBytes);
  }

  return splitFiles;
}
