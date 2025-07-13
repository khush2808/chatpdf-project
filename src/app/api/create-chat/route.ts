import { NextRequest, NextResponse } from "next/server";
import { loadS3IntoPinecone } from "@/lib/pinecone";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { getS3Url } from "@/lib/s3";
import { auth } from "@clerk/nextjs/server";
import { validatePDFFile } from "@/lib/pdf-processor";

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    // 2. Request validation
    const body = await req.json();
    const { file_key, file_name } = body;

    if (!file_key || !file_name) {
      return NextResponse.json(
        { error: "Missing required fields: file_key and file_name" },
        { status: 400 }
      );
    }

    // Validate file name format
    if (typeof file_name !== "string" || file_name.trim().length === 0) {
      return NextResponse.json(
        { error: "Invalid file name" },
        { status: 400 }
      );
    }

    // Validate file key format
    if (typeof file_key !== "string" || file_key.trim().length === 0) {
      return NextResponse.json(
        { error: "Invalid file key" },
        { status: 400 }
      );
    }

    console.log("Processing file:", { file_key, file_name, userId });

    // 3. Check if chat already exists for this file
    const existingChat = await db
      .select()
      .from(chats)
      .where(
        chats.fileKey === file_key && chats.userId === userId
      )
      .limit(1);

    if (existingChat.length > 0) {
      return NextResponse.json(
        {
          chat_id: existingChat[0].id,
          message: "Chat already exists for this file",
          isExisting: true,
        },
        { status: 200 }
      );
    }

    // 4. Process the PDF and create vectors
    console.log("Starting PDF processing and vectorization...");
    const pages = await loadS3IntoPinecone(file_key);
    console.log(`PDF processed successfully with ${pages.length} pages`);

    // 5. Create database entry
    const chatResult = await db
      .insert(chats)
      .values({
        fileKey: file_key,
        pdfName: file_name,
        pdfUrl: getS3Url(file_key),
        userId: userId,
      })
      .returning({
        insertedId: chats.id,
      });

    if (!chatResult || chatResult.length === 0) {
      throw new Error("Failed to create chat entry in database");
    }

    const chatId = chatResult[0].insertedId;
    console.log("Chat created successfully with ID:", chatId);

    // 6. Return success response
    return NextResponse.json(
      {
        chat_id: chatId,
        message: "PDF processed and chat created successfully",
        pages_processed: pages.length,
        isExisting: false,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error in create-chat API:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("PINECONE_API_KEY")) {
        return NextResponse.json(
          { error: "Vector database not configured properly" },
          { status: 500 }
        );
      }
      
      if (error.message.includes("OPENAI_API_KEY")) {
        return NextResponse.json(
          { error: "AI service not configured properly" },
          { status: 500 }
        );
      }
      
      if (error.message.includes("Could not download")) {
        return NextResponse.json(
          { error: "Failed to access uploaded file" },
          { status: 500 }
        );
      }
      
      if (error.message.includes("No text content")) {
        return NextResponse.json(
          { error: "PDF appears to be empty or unreadable" },
          { status: 400 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { 
        error: "Failed to process PDF. Please try again with a different file.",
        details: (globalThis as any).process?.env?.NODE_ENV === "development" ? error instanceof Error ? error.message : "Unknown error" : undefined
      },
      { status: 500 }
    );
  }
}
