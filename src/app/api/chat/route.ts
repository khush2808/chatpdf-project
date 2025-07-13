import { NextRequest, NextResponse } from "next/server";
import { getContext } from "@/lib/pinecone";
import { db } from "@/lib/db";
import { chats, messages } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { chatId, message } = body;

    // Get the chat details to find the file key
    const chat = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat.length || chat[0].userId !== userId) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Save the user message to the database
    await db.insert(messages).values({
      chatId: chatId,
      content: message,
      role: "user",
    });

    // Get relevant context from Pinecone
    const context = await getContext(message, chat[0].fileKey);

    // Create a prompt for the AI with context
    const prompt = `
      You are a helpful AI assistant that answers questions about PDF documents.
      
      Context from the document:
      ${context}
      
      User question: ${message}
      
      Please provide a helpful and accurate answer based on the context provided. If the context doesn't contain relevant information, please say so.
    `;

    // Call OpenAI API for the response
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    const aiResponse = await response.json();
    const aiMessage =
      aiResponse.choices[0]?.message?.content ||
      "I couldn't generate a response.";

    // Save the AI response to the database
    await db.insert(messages).values({
      chatId: chatId,
      content: aiMessage,
      role: "system",
    });

    return NextResponse.json({
      message: aiMessage,
      context: context,
    });
  } catch (error) {
    console.error("Error in chat:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
