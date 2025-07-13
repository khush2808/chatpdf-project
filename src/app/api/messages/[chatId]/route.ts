import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { messages, chats } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withCors } from "@/lib/cors";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  try {
    const ParamSchema = z.object({ chatId: z.string().regex(/^\d+$/) });
    const parseRes = ParamSchema.safeParse(params);
    if (!parseRes.success) {
      return withCors(NextResponse.json({ error: "Invalid chatId" }, { status: 400 }));
    }

    const chatId = Number(parseRes.data.chatId);

    // Verify the chat belongs to the user
    const chat = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .limit(1);

    if (!chat.length) {
      return withCors(NextResponse.json({ error: "Chat not found" }, { status: 404 }));
    }

    // Get all messages for this chat
    const chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);

    return withCors(NextResponse.json(chatMessages));
  } catch (error) {
    console.error("Error fetching messages:", error);
    return withCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
  }
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 200 }));
}
