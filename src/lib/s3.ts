import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
