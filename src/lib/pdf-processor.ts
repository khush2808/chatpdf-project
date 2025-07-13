import fs from "fs";
import path from "path";
import crypto from "crypto";
import { downloadFromS3 } from "./s3-server";

// Define types for better TypeScript support
export interface ProcessedDocument {
  pageContent: string;
  metadata: {
    loc: { pageNumber: number };
    source: string;
    pdf: {
      info: PDFInfo;
      totalPages: number;
    };
  };
}

export interface PDFInfo {
  Title?: string;
  Author?: string;
  Subject?: string;
  Keywords?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: Date;
  ModDate?: Date;
  PDFFormatVersion?: string;
}

export interface DocumentChunk {
  pageContent: string;
  metadata: {
    pageNumber: number;
    chunkIndex: number;
    source: string;
    totalChunks: number;
  };
}

/**
 * Downloads and processes a PDF from S3, extracting text and metadata
 */
export async function downloadAndProcessPDF(
  fileKey: string
): Promise<ProcessedDocument[]> {
  let tempFilePath: string | null = null;

  try {
    console.log(`Starting PDF processing for file: ${fileKey}`);

    // Download PDF from S3 to temporary file
    tempFilePath = await downloadFromS3(fileKey);

    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
      throw new Error("Failed to download file from S3");
    }

    console.log(`Downloaded PDF to temporary file: ${tempFilePath}`);

    // Extract text and metadata using multiple strategies
    const documents = await extractPDFContent(tempFilePath, fileKey);

    if (!documents || documents.length === 0) {
      throw new Error("No content could be extracted from the PDF");
    }

    console.log(
      `Successfully processed PDF: ${documents.length} pages extracted`
    );
    return documents;
  } catch (error) {
    console.error("Error processing PDF:", error);
    throw new Error(
      `PDF processing failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  } finally {
    // Cleanup temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temporary file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn("Failed to cleanup temporary file:", cleanupError);
      }
    }
  }
}

/**
 * Extracts content from PDF using multiple fallback strategies
 */
async function extractPDFContent(
  filePath: string,
  source: string
): Promise<ProcessedDocument[]> {
  const strategies = [
    () => extractWithPdfParse(filePath, source),
    () => extractWithFallbackMethod(filePath, source),
  ];

  for (const [index, strategy] of strategies.entries()) {
    try {
      console.log(`Trying PDF extraction strategy ${index + 1}`);
      const result = await strategy();
      if (result && result.length > 0) {
        console.log(`Strategy ${index + 1} succeeded`);
        return result;
      }
    } catch (error) {
      console.warn(`Strategy ${index + 1} failed:`, error);
      if (index === strategies.length - 1) {
        throw error; // Re-throw if it's the last strategy
      }
    }
  }

  throw new Error("All PDF extraction strategies failed");
}

/**
 * Primary extraction method using pdf-parse
 */
async function extractWithPdfParse(
  filePath: string,
  source: string
): Promise<ProcessedDocument[]> {
  try {
    // Dynamic import to handle potential missing dependency
    const pdfParse = await import("pdf-parse").catch(() => null);

    if (!pdfParse) {
      throw new Error("pdf-parse library not available");
    }

    const pdfBuffer = fs.readFileSync(filePath);
    const data = await pdfParse.default(pdfBuffer);

    // Extract page-by-page content if available
    const documents: ProcessedDocument[] = [];

    if (data.text && data.text.trim().length > 0) {
      // If we can't get individual pages, treat the whole document as one page
      const pageCount = data.numpages || 1;
      const textPerPage = data.text.length / pageCount;

      for (let i = 0; i < pageCount; i++) {
        const startIndex = Math.floor(i * textPerPage);
        const endIndex = Math.floor((i + 1) * textPerPage);
        const pageText = data.text.slice(startIndex, endIndex).trim();

        if (pageText.length > 0) {
          documents.push({
            pageContent: pageText,
            metadata: {
              loc: { pageNumber: i + 1 },
              source,
              pdf: {
                info: data.info || {},
                totalPages: pageCount,
              },
            },
          });
        }
      }
    }

    if (documents.length === 0) {
      throw new Error("No text content found in PDF");
    }

    return documents;
  } catch (error) {
    console.error("pdf-parse extraction failed:", error);
    throw error;
  }
}

/**
 * Fallback extraction method for problematic PDFs
 */
async function extractWithFallbackMethod(
  filePath: string,
  source: string
): Promise<ProcessedDocument[]> {
  try {
    // This is a basic fallback - in production you might use other libraries
    // For now, we'll create a minimal document structure
    const stats = fs.statSync(filePath);

    return [
      {
        pageContent: `This PDF file could not be processed for text extraction. File size: ${stats.size} bytes. Please ensure the PDF contains readable text and is not password-protected or corrupted.`,
        metadata: {
          loc: { pageNumber: 1 },
          source,
          pdf: {
            info: {
              Title: "Unprocessable PDF",
              Creator: "ChatPDF Fallback",
            },
            totalPages: 1,
          },
        },
      },
    ];
  } catch (error) {
    console.error("Fallback extraction failed:", error);
    throw error;
  }
}

/**
 * Chunks documents into smaller pieces for vector embeddings
 */
export function chunkDocuments(
  documents: ProcessedDocument[],
  chunkSize: number = 1000,
  overlap: number = 200
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  for (const doc of documents) {
    const text = doc.pageContent;
    const pageNumber = doc.metadata.loc.pageNumber;

    if (text.length <= chunkSize) {
      // Document fits in one chunk
      chunks.push({
        pageContent: text,
        metadata: {
          pageNumber,
          chunkIndex: 0,
          source: doc.metadata.source,
          totalChunks: 1,
        },
      });
    } else {
      // Split document into multiple chunks
      const textChunks = splitTextIntoChunks(text, chunkSize, overlap);

      for (let i = 0; i < textChunks.length; i++) {
        chunks.push({
          pageContent: textChunks[i],
          metadata: {
            pageNumber,
            chunkIndex: i,
            source: doc.metadata.source,
            totalChunks: textChunks.length,
          },
        });
      }
    }
  }

  return chunks;
}

/**
 * Splits text into chunks with overlap
 */
function splitTextIntoChunks(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to break at word boundaries
    if (end < text.length) {
      const lastSpaceIndex = chunk.lastIndexOf(" ");
      if (lastSpaceIndex > chunkSize * 0.8) {
        // Only break at word if it's not too early
        chunk = chunk.slice(0, lastSpaceIndex);
        start += lastSpaceIndex + 1;
      } else {
        start += chunkSize - overlap;
      }
    } else {
      start = text.length; // We've reached the end
    }

    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
  }

  return chunks;
}

/**
 * Creates a hash for the document content to detect duplicates
 */
export function createDocumentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Prepares document for processing - validates and cleans content
 */
export function prepareDocument(
  fileKey: string,
  content: string
): {
  isValid: boolean;
  cleanedContent: string;
  contentHash: string;
  wordCount: number;
} {
  try {
    // Basic validation
    if (!content || typeof content !== "string") {
      return {
        isValid: false,
        cleanedContent: "",
        contentHash: "",
        wordCount: 0,
      };
    }

    // Clean and normalize content
    let cleanedContent = content
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\r/g, "\n") // Handle old Mac line endings
      .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
      .replace(/[ \t]{2,}/g, " ") // Normalize whitespace
      .trim();

    // Remove empty lines and normalize
    cleanedContent = cleanedContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");

    const wordCount = cleanedContent
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    const contentHash = createDocumentHash(cleanedContent);

    return {
      isValid: cleanedContent.length > 10 && wordCount > 5, // Minimum content requirements
      cleanedContent,
      contentHash,
      wordCount,
    };
  } catch (error) {
    console.error("Error preparing document:", error);
    return {
      isValid: false,
      cleanedContent: "",
      contentHash: "",
      wordCount: 0,
    };
  }
}
