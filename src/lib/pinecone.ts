import { Pinecone, PineconeRecord } from "@pinecone-database/pinecone";
import { downloadFromS3 } from "./s3-server";
import { promises as fs } from "fs";
import md5 from "md5";
import { getEmbeddings } from "./embeddings";
import { convertToAscii } from "./utils";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { Document } from "@langchain/core/documents";

export const getPineconeClient = () => {
  console.log("🔧 Initializing Pinecone client...");
  return new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
};

interface DocumentChunk {
  content: string;
  metadata: {
    pageNumber: number;
    chunkIndex: number;
    totalChunks: number;
  };
}

export async function loadS3IntoPinecone(fileKey: string) {
  console.log("🚀 Starting PDF processing pipeline for:", fileKey);

  try {
    // Step 1: Download PDF from S3
    console.log("📥 Step 1: Downloading PDF from S3...");
    const filePath = await downloadFromS3(fileKey);
    if (!filePath) {
      throw new Error("Failed to download PDF from S3");
    }
    console.log("✅ PDF downloaded successfully to:", filePath);

    // Step 2: Read and parse PDF using a simpler approach
    console.log("📖 Step 2: Reading and parsing PDF...");
    const pdfBuffer = await fs.readFile(filePath);

    // For now, let's create a simple text extraction
    // This is a placeholder - in production you'd want to use a proper PDF parser
    const extractedText = await extractTextFromPDF(pdfBuffer);
    console.log(`✅ PDF processed successfully:`);
    console.log(`   - Text length: ${extractedText.length} characters`);

    // Step 3: Split text into chunks
    console.log("✂️ Step 3: Splitting text into chunks...");
    const chunks = splitTextIntoChunks(extractedText);
    console.log(`✅ Text split into ${chunks.length} chunks`);

    // Step 4: Generate embeddings for each chunk
    console.log("🧠 Step 4: Generating embeddings with Gemini AI...");
    const vectors: PineconeRecord[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(
        `   Processing chunk ${i + 1}/${chunks.length} (Page ${
          chunk.metadata.pageNumber
        })`
      );

      try {
        const embeddings = await getEmbeddings(chunk.content);
        const hash = md5(chunk.content);

        const vector: PineconeRecord = {
          id: `${fileKey}-${hash}`,
          values: embeddings,
          metadata: {
            text: chunk.content.substring(0, 1000), // Limit metadata size
            pageNumber: chunk.metadata.pageNumber,
            chunkIndex: chunk.metadata.chunkIndex,
            totalChunks: chunk.metadata.totalChunks,
            fileKey: fileKey,
          },
        };

        vectors.push(vector);
        console.log(
          `   ✅ Chunk ${i + 1} embedded successfully (${
            embeddings.length
          } dimensions)`
        );
      } catch (error) {
        console.error(`   ❌ Failed to embed chunk ${i + 1}:`, error);
        throw error;
      }
    }

    // Step 5: Upload vectors to Pinecone
    console.log("📤 Step 5: Uploading vectors to Pinecone...");
    const client = getPineconeClient();
    const pineconeIndex = client.index("chatpdf");
    const namespace = pineconeIndex.namespace(convertToAscii(fileKey));

    console.log(`   Using namespace: ${convertToAscii(fileKey)}`);
    await namespace.upsert(vectors);
    console.log(
      `✅ Successfully uploaded ${vectors.length} vectors to Pinecone`
    );

    // Step 6: Clean up temporary file
    console.log("🧹 Step 6: Cleaning up temporary files...");
    try {
      await fs.unlink(filePath);
      console.log("✅ Temporary PDF file deleted");
    } catch (error) {
      console.warn("⚠️ Could not delete temporary file:", error);
    }

    console.log("🎉 PDF processing pipeline completed successfully!");
    return {
      success: true,
      chunksProcessed: chunks.length,
      vectorsUploaded: vectors.length,
      fileKey: fileKey,
    };
  } catch (error) {
    console.error("❌ Error in PDF processing pipeline:", error);
    throw error;
  }
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log(`📄 Processing PDF buffer of size: ${buffer.length} bytes`);
  try {
    // Use LangChain's WebPDFLoader to extract text from the PDF buffer
    const loader = new WebPDFLoader(new Blob([buffer]), {
      parsedItemSeparator: "\n",
    });
    const docs = await loader.load();
    // Concatenate all page texts
    const fullText = docs.map((doc: Document) => doc.pageContent).join("\n");
    const cleanedText = fullText
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();
    console.log(`✅ PDF parsed successfully:`);
    console.log(`   - Text length: ${cleanedText.length} characters`);
    console.log(`   - Text preview: "${cleanedText.substring(0, 100)}..."`);
    return cleanedText;
  } catch (error) {
    console.error("❌ Error parsing PDF with LangChain PDFLoader:", error);
    throw new Error(
      `Failed to parse PDF: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function splitTextIntoChunks(text: string): DocumentChunk[] {
  console.log("✂️ Splitting text into manageable chunks...");

  const maxChunkSize = 1000; // Maximum characters per chunk
  const overlapSize = 100; // Characters to overlap between chunks

  // Clean the text
  const cleanText = text.replace(/\s+/g, " ").trim();

  const chunks: DocumentChunk[] = [];
  let currentPosition = 0;
  let chunkIndex = 0;

  while (currentPosition < cleanText.length) {
    const endPosition = Math.min(
      currentPosition + maxChunkSize,
      cleanText.length
    );

    // Try to break at a sentence or word boundary
    let chunkEnd = endPosition;
    if (endPosition < cleanText.length) {
      const sentenceBreak = cleanText.lastIndexOf(".", endPosition);
      const wordBreak = cleanText.lastIndexOf(" ", endPosition);

      if (sentenceBreak > currentPosition + maxChunkSize * 0.8) {
        chunkEnd = sentenceBreak + 1;
      } else if (wordBreak > currentPosition + maxChunkSize * 0.8) {
        chunkEnd = wordBreak;
      }
    }

    const chunkContent = cleanText.substring(currentPosition, chunkEnd).trim();

    if (chunkContent.length > 0) {
      // Estimate page number based on position in text
      const pageNumber = Math.ceil(
        (currentPosition / cleanText.length) * 10 // Assume 10 pages for now
      );

      chunks.push({
        content: chunkContent,
        metadata: {
          pageNumber: pageNumber,
          chunkIndex: chunkIndex,
          totalChunks: 0, // Will be updated after all chunks are created
        },
      });

      chunkIndex++;
    }

    currentPosition = Math.max(chunkEnd - overlapSize, chunkEnd);
  }

  // Update totalChunks for all chunks
  chunks.forEach((chunk) => {
    chunk.metadata.totalChunks = chunks.length;
  });

  console.log(
    `✅ Created ${chunks.length} chunks with average size ${Math.round(
      cleanText.length / chunks.length
    )} characters`
  );
  return chunks;
}

export const truncateStringByBytes = (str: string, bytes: number) => {
  console.log(`🔧 Truncating string to ${bytes} bytes...`);
  const enc = new TextEncoder();
  const truncated = new TextDecoder("utf-8").decode(
    enc.encode(str).slice(0, bytes)
  );
  console.log(
    `✅ String truncated from ${str.length} to ${truncated.length} characters`
  );
  return truncated;
};
