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
      metadata: any;
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
  // TODO: Implement PDF processing and Pinecone integration
  console.log("loadS3IntoPinecone called for file:", fileKey);

  throw new Error(
    "PDF processing not yet implemented - will be added in next phase"
  );
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
  const queryEmbeddings = await getEmbeddings(query);
  const matches = await getMatchesFromEmbeddings(queryEmbeddings, fileKey);

  const qualifyingDocs = matches.filter(
    (match) => match.score && match.score > 0.7
  );

  type Metadata = {
    text: string;
    pageNumber: number;
  };

  let docs = qualifyingDocs.map((match) => (match.metadata as Metadata).text);
  return docs.join("\n").substring(0, 3000);
}
