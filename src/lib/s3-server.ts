import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";

export async function downloadFromS3(file_key: string): Promise<string> {
  try {
    const s3Client = new S3Client({
      region: "ap-southeast-1",
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_ACCESS_KEY!,
      },
    });

    const command = new GetObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME!,
      Key: file_key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error("No file body received from S3");
    }

    // Create a temporary file path
    const tempDir = os.tmpdir();
    const fileName = path.basename(file_key);
    const tempFilePath = path.join(tempDir, fileName);

    // Handle Node.js stream properly
    const stream = response.Body as Readable;

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempFilePath);

      stream.pipe(writeStream);

      writeStream.on("finish", () => {
        resolve(tempFilePath);
      });

      writeStream.on("error", (error) => {
        reject(error);
      });

      stream.on("error", (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error("Error downloading from S3:", error);
    throw error;
  }
}
