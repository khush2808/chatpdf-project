import { downloadFromS3 } from "./s3-server";
import fs from "fs";
import md5 from "md5";
import { truncateStringByBytes } from "./utils";

export interface PDFPage {
  pageContent: string;
  metadata: {
    loc: { pageNumber: number };
    pdf: {
      info: {
        Title: string;
        Author: string;
        Subject: string;
        Keywords: string;
        Creator: string;
        Producer: string;
        CreationDate: Date;
        ModDate: Date;
        PDFFormatVersion: string;
      };
      metadata: any;
      totalPages: number;
    };
  };
}

export interface ProcessedChunk {
  pageContent: string;
  metadata: {
    pageNumber: number;
    text: string;
  };
}

// Enhanced text splitter with better chunking strategy
function splitText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    // Only add non-empty chunks
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
    
    start = end - overlap;
    
    // Prevent infinite loop
    if (start >= text.length) break;
  }

  return chunks;
}

// Load PDF using pdfjs-dist with enhanced error handling
export async function loadPDF(filePath: string): Promise<PDFPage[]> {
  try {
    // Dynamic import of pdfjs-dist to prevent bundling issues
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Read file buffer
    const buffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(buffer);

    // Load PDF document with timeout
    const loadingTask = pdfjs.getDocument({ data: uint8Array });
    const pdf = await Promise.race([
      loadingTask.promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("PDF loading timeout")), 30000)
      )
    ]);

    const pages: PDFPage[] = [];

    // Extract text from each page with error handling
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Combine all text items into a single string
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        // Only add pages with content
        if (pageText.length > 0) {
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
      } catch (pageError) {
        console.warn(`Error processing page ${i}:`, pageError);
        // Continue with other pages
      }
    }

    if (pages.length === 0) {
      throw new Error("No text content could be extracted from PDF");
    }

    return pages;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    
    // Try alternative PDF parsing method if available
    try {
      return await fallbackPDFParsing(filePath);
    } catch (fallbackError) {
      console.error("Fallback PDF parsing also failed:", fallbackError);
      throw new Error(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Fallback PDF parsing method
async function fallbackPDFParsing(filePath: string): Promise<PDFPage[]> {
  // This could be implemented with alternative PDF libraries
  // For now, we'll throw an error to indicate the PDF couldn't be processed
  throw new Error("PDF format not supported or file is corrupted");
}

export async function prepareDocument(page: PDFPage): Promise<ProcessedChunk[]> {
  let { pageContent, metadata } = page;
  
  // Clean up the text
  pageContent = pageContent
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!pageContent || pageContent.length === 0) {
    return [];
  }

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

export async function downloadAndProcessPDF(fileKey: string): Promise<PDFPage[]> {
  let tempFilePath: string | null = null;
  
  try {
    console.log("Downloading PDF from S3:", fileKey);
    tempFilePath = await downloadFromS3(fileKey);
    
    if (!tempFilePath) {
      throw new Error("Could not download file from S3");
    }

    console.log("Processing PDF:", tempFilePath);
    const docs = await loadPDF(tempFilePath);

    if (docs.length === 0) {
      throw new Error("No content could be extracted from the PDF");
    }

    console.log(`Successfully processed PDF with ${docs.length} pages`);
    return docs;
  } catch (error) {
    console.error("Error in downloadAndProcessPDF:", error);
    throw error;
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log("Cleaned up temporary file:", tempFilePath);
      } catch (cleanupError) {
        console.warn("Could not cleanup temp file:", cleanupError);
      }
    }
  }
}

// Utility function to validate PDF file
export function validatePDFFile(file: File): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: "No file provided" };
  }

  if (file.type !== "application/pdf") {
    return { isValid: false, error: "File must be a PDF" };
  }

  if (file.size > 10 * 1024 * 1024) { // 10MB limit
    return { isValid: false, error: "File size must be less than 10MB" };
  }

  if (file.size === 0) {
    return { isValid: false, error: "File is empty" };
  }

  return { isValid: true };
}
