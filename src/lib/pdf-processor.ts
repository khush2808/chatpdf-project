import { downloadFromS3 } from "./s3-server";
import fs from "fs";
import md5 from "md5";
import { truncateStringByBytes } from "./utils";

// Load PDF using pdfjs-dist
export async function loadPDF(filePath: string) {
  try {
    // Dynamic import of pdfjs-dist to prevent bundling issues
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Read file buffer
    const buffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(buffer);

    // Load PDF document
    const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;

    const pages = [];

    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Combine all text items into a single string
      const pageText = textContent.items.map((item: any) => item.str).join(" ");

      pages.push({
        pageContent: pageText,
        metadata: {
          loc: { pageNumber: i },
          pdf: {
            info: {
              Title: "",
              Author: "",
              Subject: "",
              Keywords: "",
              Creator: "",
              Producer: "",
              CreationDate: new Date(),
              ModDate: new Date(),
              PDFFormatVersion: "1.0",
            },
            metadata: {},
            totalPages: pdf.numPages,
          },
        },
      });
    }

    return pages;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw error;
  }
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
  let { pageContent, metadata } = page;
  pageContent = pageContent.replace(/\n/g, " ");

  // Split the document into smaller chunks
  const chunks = splitText(pageContent, 1000, 200);

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
