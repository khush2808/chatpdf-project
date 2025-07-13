import { Pinecone } from "@pinecone-database/pinecone";
import { convertToAscii } from "./utils";
import { downloadFromS3 } from "./s3";
import fs from "fs";
import pdf from "pdf-parse";
import md5 from "md5";

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
  // 1. obtain the pdf -> download and read from pdf
  console.log("downloading s3 into file system");
  const file_name = await downloadFromS3(fileKey);
  if (!file_name) {
    throw new Error("Could not download from s3");
  }
  console.log("loading pdf into memory: " + file_name);

  // 2. split and segment the pdf
  const docs = await loadPDF(file_name);

  // 3. split and segment the pdf into smaller documents
  const documents = await Promise.all(docs.map(prepareDocument));

  // 4. vectorise and embed individual documents
  const vectors = await Promise.all(documents.flat().map(embedDocument));

  // 5. upload to pinecone
  const client = await getPineconeClient();
  const pineconeIndex = await client.index("chatpdf");
  const namespace = pineconeIndex.namespace(convertToAscii(fileKey));

  console.log("inserting vectors into pinecone");
  await namespace.upsert(vectors);

  return documents[0];
}

// Load PDF using pdf-parse instead of langchain
async function loadPDF(filePath: string) {
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
}

async function embedDocument(doc: any) {
  try {
    const embeddings = await getEmbeddings(doc.pageContent);
    const hash = md5(doc.pageContent);

    return {
      id: hash,
      values: embeddings,
      metadata: {
        text: doc.metadata.text,
        pageNumber: doc.metadata.pageNumber,
      },
    } as any;
  } catch (error) {
    console.log("error embedding document", error);
    throw error;
  }
}

export const truncateStringByBytes = (str: string, bytes: number) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};

// Simple text splitter to replace langchain's RecursiveCharacterTextSplitter
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

async function prepareDocument(page: any) {
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
