import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { messages, chats } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    // 1. Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    // 2. Validate chatId parameter
    const chatId = parseInt(params.chatId);
    if (isNaN(chatId) || chatId <= 0) {
      return NextResponse.json(
        { error: "Invalid chat ID" },
        { status: 400 }
      );
    }

    // 3. Verify the chat belongs to the user
    const chat = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .limit(1);

    if (!chat.length) {
      return NextResponse.json(
        { error: "Chat not found or access denied" },
        { status: 404 }
      );
    }

    // 4. Get all messages for this chat
    const chatMessages = await db
      .select({
        id: messages.id,
        content: messages.content,
        role: messages.role,
        createdAt: messages.createdAt,
        chatId: messages.chatId,
      })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);

    console.log(`Retrieved ${chatMessages.length} messages for chat ${chatId}`);

    return NextResponse.json(chatMessages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("database")) {
        return NextResponse.json(
          { error: "Database connection error" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: "Failed to load messages",
        details: (globalThis as any).process?.env?.NODE_ENV === "development" ? error instanceof Error ? error.message : "Unknown error" : undefined
      },
      { status: 500 }
    );
  }
}
