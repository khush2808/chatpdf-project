import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { promises as fs } from "fs";
import path from "path";

export async function downloadFromS3(file_key: string) {
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
    const body = await response.Body?.transformToByteArray();
    if (!body) {
      throw new Error("No body found");
    }
    const file_name = `./tmp/pdf-${Date.now()}.pdf`;
    await fs.mkdir(path.dirname(file_name), { recursive: true });
    await fs.writeFile(file_name, body);
    return file_name;
  } catch (error) {
    console.error(error);
    return null;
  }
}
