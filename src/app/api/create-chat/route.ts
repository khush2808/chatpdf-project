import { NextRequest, NextResponse } from "next/server";
import { loadS3IntoPinecone } from "@/lib/pinecone";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { getS3Url } from "@/lib/s3";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { file_key, file_name } = body;

    console.log("Processing file:", file_key, file_name);

    // Load the PDF into Pinecone (this processes the PDF and creates embeddings)
    const pages = await loadS3IntoPinecone(file_key);

    // Create a new chat entry in the database
    const chat_id = await db
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

    console.log("Chat created with ID:", chat_id[0].insertedId);

    return NextResponse.json(
      {
        chat_id: chat_id[0].insertedId,
        message: "PDF processed and chat created successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing PDF:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
