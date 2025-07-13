import { downloadFromS3 } from "./s3-server";
import fs from "fs";
import md5 from "md5";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { truncateStringByBytes } from "./utils";

// We will lazily import heavy, server-only dependencies so that they are **never** bundled
// into the client build. These are only required inside a Node.js runtime.
type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

/**
 * Internal helper that tries to extract text from a PDF via **pdfjs-dist**.
 * Throws on failure so the caller can continue with fallback strategies.
 */
async function parseWithPdfJs(filePath: string) {
  const pdfjs: PdfJs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Read file buffer & convert to Uint8Array for pdf-js
  const buffer = fs.readFileSync(filePath);
  const uint8Array = new Uint8Array(buffer);

  const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;

  const pages: FilePage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    const pageText = textContent.items.map((item: any) => item.str).join(" ");

    pages.push({
      pageContent: pageText,
      metadata: {
        loc: { pageNumber: i },
        pdf: {
          info: pdf!.info ?? {},
          metadata: {},
          totalPages: pdf.numPages,
        },
      },
    });
  }

  return pages;
}

/**
 * Fallback parser that uses **pdf-parse** which sometimes succeeds on PDF files
 * that pdf-js cannot handle (e.g. certain encrypted or malformed files).
 * pdf-parse only returns a single block of text, so we split it up into pseudo
 * pages of equal length.
 */
async function parseWithPdfParse(filePath: string) {
  const pdfParse: any = (await import("pdf-parse")).default;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  // pdf-parse does not preserve page separation in a structured way, but it
  // annotates the text with form-feed (\f) characters per page so we can use
  // those as delimiters. If none are present, treat the entire document as a
  // single page.
  const rawPages = data.text.split("\f");

  return rawPages.map((pageText: string, idx: number) => ({
    pageContent: pageText.trim(),
    metadata: {
      loc: { pageNumber: idx + 1 },
      pdf: {
        info: data.info ?? {},
        metadata: data.metadata ?? {},
        totalPages: rawPages.length,
      },
    },
  })) as FilePage[];
}

/**
 * A **single** page of a PDF with minimal metadata – kept intentionally
 * compatible with downstream usage in the Pinecone pipeline.
 */
export interface FilePage {
  pageContent: string;
  metadata: {
    loc: { pageNumber: number };
    pdf: {
      info: Record<string, unknown>;
      metadata: any;
      totalPages: number;
    };
  };
}

/**
 * Attempts to extract text from the given PDF file using multiple strategies.
 * 1. pdfjs-dist (fast & accurate)
 * 2. pdf-parse (good at some encrypted/corrupted variants)
 * 3. (TODO) OCR fallback – placeholder for now
 */
export async function loadPDF(filePath: string): Promise<FilePage[]> {
  // Strategy 1 – pdfjs-dist
  try {
    return await parseWithPdfJs(filePath);
  } catch (err) {
    console.warn("pdfjs-dist failed – falling back to pdf-parse", err);
  }

  // Strategy 2 – pdf-parse
  try {
    return await parseWithPdfParse(filePath);
  } catch (err) {
    console.warn("pdf-parse failed", err);
  }

  // Future Strategy 3 – OCR fallback (image-based PDFs)
  // For now, throw an error so the caller can handle gracefully.
  throw new Error("Unable to extract text from PDF using available strategies");
}

// Simple text splitter
function splitText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}

export async function prepareDocument(page: any) {
  const { pageContent: originalContent, metadata } = page;
  const cleanedContent = originalContent.replace(/\n/g, " ");

  // Split the document into smaller chunks
  const chunks = splitText(cleanedContent, 1000, 200);

  return chunks.map((chunk) => ({
    pageContent: chunk,
    metadata: {
      pageNumber: metadata.loc.pageNumber,
      text: truncateStringByBytes(chunk, 36000),
    },
  }));
}

export function createDocumentHash(content: string): string {
  return md5(content);
}

export async function downloadAndProcessPDF(fileKey: string) {
  try {
    console.log("downloading s3 into file system");
    const file_name = await downloadFromS3(fileKey);
    if (!file_name) {
      throw new Error("Could not download from s3");
    }
    console.log("loading pdf into memory: " + file_name);

    // Parse PDF
    const docs = await loadPDF(file_name);

    // Clean up temp file
    try {
      fs.unlinkSync(file_name);
    } catch (cleanupError) {
      console.warn("Could not cleanup temp file:", cleanupError);
    }

    return docs;
  } catch (error) {
    console.error("Error in downloadAndProcessPDF:", error);
    throw error;
  }
}
