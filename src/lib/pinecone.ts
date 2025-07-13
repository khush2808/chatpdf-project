import { Pinecone } from "@pinecone-database/pinecone";
import { convertToAscii } from "./utils";

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
      metadata: Record<string, unknown>;
      totalPages: number;
    };
  };
};

let pinecone: Pinecone | null = null;

export const getPineconeClient = async () => {
  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pinecone;
};

export async function loadS3IntoPinecone(fileKey: string) {
  // Import the PDF processor module dynamically (keeps client bundle slim)
  const { downloadAndProcessPDF, prepareDocument, createDocumentHash } =
    await import("./pdf-processor");

  try {
    // ------------------------------------------------------------------
    // 1. Download & parse PDF into array of pages
    // ------------------------------------------------------------------
    const pages = await downloadAndProcessPDF(fileKey);

    // ------------------------------------------------------------------
    // 2. Prepare smaller text chunks for embedding (approx. 1-2k chars)
    // ------------------------------------------------------------------
    const documents = (await Promise.all(pages.map(prepareDocument))).flat();

    // ------------------------------------------------------------------
    // 3. Generate embeddings for each chunk – sequentially to respect
    //    OpenAI rate-limits. In production you may parallelise with a pool
    //    & exponential back-off. Here we keep it simple.
    // ------------------------------------------------------------------
    const vectors = [] as {
      id: string;
      values: number[];
      metadata: { text: string; pageNumber: number };
    }[];

    for (const doc of documents) {
      const embedding = await getEmbeddings(doc.pageContent);
      const id = createDocumentHash(doc.pageContent);

      vectors.push({
        id,
        values: embedding,
        metadata: {
          text: doc.metadata.text,
          pageNumber: doc.metadata.pageNumber,
        },
      });
    }

    // ------------------------------------------------------------------
    // 4. Upsert vectors to Pinecone – batch to 100 vectors/request to stay
    //    within API limits.
    // ------------------------------------------------------------------
    const client = await getPineconeClient();
    const index = await client.index("chatpdf");
    const namespace = index.namespace(convertToAscii(fileKey));

    // Clear previous vectors for this file to avoid duplicates / stale data.
    try {
      await namespace.deleteAll();
    } catch {
      // Not fatal – e.g. namespace may not exist yet.
    }

    const BATCH_SIZE = 100;
    console.log(`Inserting ${vectors.length} vectors into Pinecone`);
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      await namespace.upsert(batch);
    }

    return documents; // return processed chunks for optional post-processing
  } catch (error) {
    console.error("Error in loadS3IntoPinecone:", error);
    throw error;
  }
}

export async function getEmbeddings(text: string) {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.replace(/\n/g, " "),
      }),
    });

    const result = await response.json();
    return result.data[0].embedding as number[];
  } catch (error) {
    console.log("error calling openai embeddings api", error);
    throw error;
  }
}

export async function getMatchesFromEmbeddings(
  embeddings: number[],
  fileKey: string
) {
  try {
    const client = await getPineconeClient();
    const pineconeIndex = await client.index("chatpdf");
    const namespace = pineconeIndex.namespace(convertToAscii(fileKey));
    const queryResult = await namespace.query({
      topK: 5,
      vector: embeddings,
      includeMetadata: true,
    });
    return queryResult.matches || [];
  } catch (error) {
    console.log("error querying embeddings", error);
    throw error;
  }
}

export async function getContext(query: string, fileKey: string) {
  try {
    // ------------------------------------------------------------------
    // 1. Embed the user query
    // ------------------------------------------------------------------
    const queryEmbeddings = await getEmbeddings(query);

    // ------------------------------------------------------------------
    // 2. Fetch the most relevant chunks from Pinecone
    // ------------------------------------------------------------------
    const matches = await getMatchesFromEmbeddings(queryEmbeddings, fileKey);

    // ------------------------------------------------------------------
    // 3. Filter low-score matches & assemble context string
    // ------------------------------------------------------------------
    const CONTEXT_SCORE_THRESHOLD = 0.75;
    const qualifying = matches.filter(
      (m) => (m.score ?? 0) >= CONTEXT_SCORE_THRESHOLD
    );

    if (!qualifying.length) return ""; // No relevant context found

    type Metadata = { text: string; pageNumber: number };

    const context = qualifying
      .map((m) => (m.metadata as Metadata).text)
      // Remove duplicate strings while preserving order
      .filter((text, idx, arr) => arr.indexOf(text) === idx)
      .join("\n---\n");

    // Cap context to ~3000 chars to stay within OpenAI prompt limits
    return context.slice(0, 3000);
  } catch (error) {
    console.error("Error getting context from Pinecone", error);
    return "";
  }
}
