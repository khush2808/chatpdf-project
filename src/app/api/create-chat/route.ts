import { loadS3IntoPinecone } from "@/lib/pinecone";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("🌟 API Route: /api/create-chat called");

  try {
    console.log("📥 Parsing request body...");
    const body = await req.json();
    const { file_key, file_name } = body;

    console.log("📋 Request details:");
    console.log(`   - File key: ${file_key}`);
    console.log(`   - File name: ${file_name}`);

    if (!file_key) {
      console.error("❌ Missing file_key in request body");
      return NextResponse.json(
        { error: "file_key is required" },
        { status: 400 }
      );
    }

    console.log("🚀 Starting PDF processing...");
    const result = await loadS3IntoPinecone(file_key);

    console.log("✅ PDF processing completed successfully:");
    console.log(`   - Chunks processed: ${result.chunksProcessed}`);
    console.log(`   - Vectors uploaded: ${result.vectorsUploaded}`);
    console.log(`   - File key: ${result.fileKey}`);

    return NextResponse.json(
      {
        message: "PDF processed successfully",
        data: {
          chunksProcessed: result.chunksProcessed,
          vectorsUploaded: result.vectorsUploaded,
          fileKey: result.fileKey,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error in create-chat API:", error);

    // Provide more specific error messages
    let errorMessage = "Internal Server Error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
