import { NextRequest, NextResponse } from "next/server";
import { loadS3IntoPinecone } from "@/lib/pinecone";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { getS3Url } from "@/lib/s3";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { withCors } from "@/lib/cors";

// ---------------------------------------------------------------------------
// Request body schema – ensures we get the minimal data required to kick off
// PDF processing & chat creation.
// ---------------------------------------------------------------------------
const CreateChatSchema = z.object({
  file_key: z.string().min(1),
  file_name: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  try {
    const json = await req.json();

    // Validate input; reply 400 on failure without leaking internals.
    const parsed = CreateChatSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const { file_key, file_name } = parsed.data;

    console.log("Processing file:", file_key, file_name);

    // Load the PDF into Pinecone (this processes the PDF and creates embeddings)
    await loadS3IntoPinecone(file_key);

    // Create a new chat entry in the database
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

    const chat_id = chatResult[0].insertedId;

    console.log("Chat created with ID:", chat_id);

    return withCors(NextResponse.json(
      {
        chat_id,
        message: "PDF processed and chat created successfully",
      },
      { status: 200 }
    ));
  } catch (error) {
    console.error("Error processing PDF:", error);
    return withCors(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    );
  }
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 200 }));
}
