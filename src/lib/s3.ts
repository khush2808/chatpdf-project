import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "fs";
import os from "os";
import path from "path";

export async function uploadToS3(
  file: File
): Promise<{ file_key: string; file_name: string } | { error: string }> {
  try {
    // Configure AWS S3 Client
    const s3Client = new S3Client({
      region: "ap-southeast-1",
      credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_ACCESS_KEY!,
      },
    });

    const file_key =
      "uploads/" + Date.now().toString() + file.name.replace(/\s+/g, "-");

    // Convert File to Uint8Array to avoid stream issues in the browser
    const arrayBuffer = await file.arrayBuffer();
    const bodyData = new Uint8Array(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME!,
      Key: file_key,
      Body: bodyData,
      ContentType: file.type,
    });

    await s3Client.send(command);

    return {
      file_key,
      file_name: file.name,
    };
  } catch (error) {
    console.error("Error uploading to S3:", error);
    return Promise.reject({ error: "Failed to upload file to S3" });
  }
}

export function getS3Url(file_key: string) {
  const url = `https://${process.env.NEXT_PUBLIC_S3_BUCKET_NAME}.s3.ap-southeast-1.amazonaws.com/${file_key}`;
  return url;
}

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

    // Convert stream to buffer
    const stream = response.Body as ReadableStream;
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine all chunks into a single buffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, buffer);

    return tempFilePath;
  } catch (error) {
    console.error("Error downloading from S3:", error);
    throw error;
  }
}
