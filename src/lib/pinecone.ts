import { Pinecone } from "@pinecone-database/pinecone";
import { convertToAscii } from "./utils";
import { PDFPage, ProcessedChunk } from "./pdf-processor";

export type FileChunk = {
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
};

export interface VectorMetadata {
  text: string;
  pageNumber: number;
  fileKey: string;
}

export interface VectorDocument {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

let pinecone: Pinecone | null = null;

export const getPineconeClient = async (): Promise<Pinecone> => {
  if (!pinecone) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is not configured");
    }
    
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pinecone;
};

export async function loadS3IntoPinecone(fileKey: string): Promise<PDFPage[]> {
  try {
    console.log("Starting PDF processing and vectorization for:", fileKey);
    
    // Import the PDF processor module dynamically (server-only)
    const { downloadAndProcessPDF, prepareDocument, createDocumentHash } =
      await import("./pdf-processor");

    // 1. Download and parse PDF
    const docs = await downloadAndProcessPDF(fileKey);
    console.log(`PDF processed successfully with ${docs.length} pages`);

    // 2. Split and segment the pdf into smaller documents
    const documentChunks = await Promise.all(docs.map(prepareDocument));
    const flattenedChunks = documentChunks.flat();
    
    console.log(`Created ${flattenedChunks.length} text chunks for vectorization`);

    if (flattenedChunks.length === 0) {
      throw new Error("No text chunks could be created from the PDF");
    }

    // 3. Vectorise and embed individual documents
    const vectors: VectorDocument[] = [];
    
    for (const doc of flattenedChunks) {
      try {
        const embeddings = await getEmbeddings(doc.pageContent);
        const hash = createDocumentHash(doc.pageContent);

        vectors.push({
          id: hash,
          values: embeddings,
          metadata: {
            text: doc.metadata.text,
            pageNumber: doc.metadata.pageNumber,
            fileKey: fileKey,
          },
        });
      } catch (embeddingError) {
        console.warn(`Failed to create embedding for chunk:`, embeddingError);
        // Continue with other chunks
      }
    }

    if (vectors.length === 0) {
      throw new Error("No vectors could be created from the PDF content");
    }

    // 4. Upload to pinecone
    const client = await getPineconeClient();
    const indexName = process.env.PINECONE_INDEX_NAME || "chatpdf";
    const pineconeIndex = client.index(indexName);
    const namespace = pineconeIndex.namespace(convertToAscii(fileKey));

    console.log(`Inserting ${vectors.length} vectors into Pinecone namespace: ${convertToAscii(fileKey)}`);
    
    const upsertResult = await namespace.upsert(vectors);
    console.log("Vectors uploaded successfully to Pinecone");

    return docs;
  } catch (error) {
    console.error("Error in loadS3IntoPinecone:", error);
    throw new Error(`Failed to process PDF and create vectors: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getEmbeddings(text: string): Promise<number[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("Cannot create embeddings for empty text");
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.replace(/\n/g, " ").trim(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    
    if (!result.data || !result.data[0] || !result.data[0].embedding) {
      throw new Error("Invalid response format from OpenAI embeddings API");
    }

    return result.data[0].embedding as number[];
  } catch (error) {
    console.error("Error calling OpenAI embeddings API:", error);
    throw error;
  }
}

export async function getMatchesFromEmbeddings(
  embeddings: number[],
  fileKey: string,
  topK: number = 5
): Promise<any[]> {
  try {
    const client = await getPineconeClient();
    const indexName = process.env.PINECONE_INDEX_NAME || "chatpdf";
    const pineconeIndex = client.index(indexName);
    const namespace = pineconeIndex.namespace(convertToAscii(fileKey));
    
    const queryResult = await namespace.query({
      topK: topK,
      vector: embeddings,
      includeMetadata: true,
      filter: {
        fileKey: { $eq: fileKey }
      }
    });
    
    return queryResult.matches || [];
  } catch (error) {
    console.error("Error querying Pinecone embeddings:", error);
    throw error;
  }
}

export async function getContext(query: string, fileKey: string): Promise<string> {
  try {
    if (!query || query.trim().length === 0) {
      throw new Error("Query cannot be empty");
    }

    console.log("Getting context for query:", query.substring(0, 100) + "...");
    
    const queryEmbeddings = await getEmbeddings(query);
    const matches = await getMatchesFromEmbeddings(queryEmbeddings, fileKey);

    console.log(`Found ${matches.length} potential matches`);

    // Filter matches by relevance score
    const qualifyingDocs = matches.filter(
      (match) => match.score && match.score > 0.7
    );

    console.log(`${qualifyingDocs.length} matches meet relevance threshold`);

    if (qualifyingDocs.length === 0) {
      return "No relevant context found for this query.";
    }

    type Metadata = {
      text: string;
      pageNumber: number;
    };

    // Sort by relevance score and extract text
    const sortedDocs = qualifyingDocs
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((match) => (match.metadata as Metadata).text);

    // Join and truncate to avoid token limits
    const context = sortedDocs.join("\n\n").substring(0, 3000);
    
    console.log(`Returning context of ${context.length} characters`);
    return context;
  } catch (error) {
    console.error("Error getting context:", error);
    return "Unable to retrieve relevant context for this query.";
  }
}

// Utility function to check if Pinecone is properly configured
export async function validatePineconeSetup(): Promise<boolean> {
  try {
    const client = await getPineconeClient();
    const indexName = process.env.PINECONE_INDEX_NAME || "chatpdf";
    const index = client.index(indexName);
    
    // Try to get index stats to verify connection
    await index.describeIndexStats();
    return true;
  } catch (error) {
    console.error("Pinecone validation failed:", error);
    return false;
  }
}
