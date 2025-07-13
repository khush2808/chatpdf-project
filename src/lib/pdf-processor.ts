import { downloadFromS3 } from "./s3-server";
import fs from "fs";
import pdf from "pdf-parse";
import md5 from "md5";
import { truncateStringByBytes } from "./utils";

// Load PDF using pdf-parse
export async function loadPDF(filePath: string) {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdf(buffer);

    // Split text into pages (rough approximation)
    const pages = data.text.split("\n\n\n"); // Assuming page breaks are marked by triple newlines

    return pages.map((pageContent: string, index: number) => ({
      pageContent,
      metadata: {
        loc: { pageNumber: index + 1 },
        pdf: {
          info: data.info || {},
          metadata: data.metadata || {},
          totalPages: pages.length,
        },
      },
    }));
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
