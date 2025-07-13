// Client-side S3 utilities - now using secure server-side API

export async function uploadToS3(
  file: File
): Promise<
  { file_key: string; file_name: string; file_size: number } | { error: string }
> {
  try {
    // Create FormData for file upload
    const formData = new FormData();
    formData.append("file", file);

    // Upload via secure server-side API
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      return { error: result.error || "Upload failed" };
    }

    return {
      file_key: result.file_key,
      file_name: result.file_name,
      file_size: result.file_size,
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    return { error: "Failed to upload file" };
  }
}

export function getS3Url(file_key: string) {
  // This will be handled server-side, but keeping for compatibility
  // In production, you might want to use signed URLs for security
  return `/api/file/${encodeURIComponent(file_key)}`;
}
