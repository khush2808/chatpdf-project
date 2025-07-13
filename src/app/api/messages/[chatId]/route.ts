import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { messages, chats } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const chatId = parseInt(params.chatId);

    // Verify the chat belongs to the user
    const chat = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .limit(1);

    if (!chat.length) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Get all messages for this chat
    const chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);

    return NextResponse.json(chatMessages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
