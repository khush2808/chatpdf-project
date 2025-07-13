import { Pinecone } from "@pinecone-database/pinecone";
import { downloadFromS3 } from "./s3-server";

export const PineConeClient = async function () {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || "",
  });
  return pinecone;
};

export async function loads3IntoPinecone(file_key: string) {
  //obtain the pdf file from s3
  console.log("downloading pdf from s3 into file system");
  const file_name = await downloadFromS3(file_key);
  if (!file_name) {
    throw new Error("Failed to download pdf from s3");
  }
}
