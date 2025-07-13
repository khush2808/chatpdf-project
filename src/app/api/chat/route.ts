import { NextRequest, NextResponse } from "next/server";
import { getContext } from "@/lib/pinecone";
import { db } from "@/lib/db";
import { chats, messages } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

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
    const { chatId, message } = body;

    if (!chatId || !message) {
      return NextResponse.json(
        { error: "Missing required fields: chatId and message" },
        { status: 400 }
      );
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      );
    }

    // 3. Get the chat details and verify ownership
    const chat = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat.length) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
      );
    }

    if (chat[0].userId !== userId) {
      return NextResponse.json(
        { error: "Access denied - You don't own this chat" },
        { status: 403 }
      );
    }

    // 4. Save the user message to the database
    await db.insert(messages).values({
      chatId: chatId,
      content: message.trim(),
      role: "user",
    });

    // 5. Get relevant context from Pinecone
    console.log("Getting context for query:", message.substring(0, 100) + "...");
    const context = await getContext(message, chat[0].fileKey);

    // 6. Create an enhanced prompt for the AI
    const systemPrompt = `You are a helpful AI assistant that answers questions about PDF documents. You have access to the document content and should provide accurate, helpful responses based on the information available.

IMPORTANT GUIDELINES:
- Only answer based on the context provided from the PDF
- If the context doesn't contain relevant information, clearly state that
- Be concise but thorough in your responses
- If asked about specific pages or sections, reference them when possible
- If the question is unclear, ask for clarification
- Do not make up information that's not in the document

Document context:
${context}

User question: ${message}

Please provide a helpful response based on the document content.`;

    // 7. Call OpenAI API with streaming
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(globalThis as any).process?.env?.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: false, // Set to false for now, can be enabled for streaming
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenAI API error:", errorData);
      
      // Save error message to database
      await db.insert(messages).values({
        chatId: chatId,
        content: "Sorry, I encountered an error while processing your request. Please try again.",
        role: "system",
      });

      return NextResponse.json(
        { error: "Failed to generate response" },
        { status: 500 }
      );
    }

    const aiResponse = await response.json();
    const aiMessage = aiResponse.choices?.[0]?.message?.content || 
                     "I couldn't generate a response. Please try again.";

    // 8. Save the AI response to the database
    await db.insert(messages).values({
      chatId: chatId,
      content: aiMessage,
      role: "system",
    });

    // 9. Return the response
    return NextResponse.json({
      message: aiMessage,
      context: context.length > 0 ? "Context found" : "No relevant context found",
      chatId: chatId,
    });

  } catch (error) {
    console.error("Error in chat API:", error);

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
    }

    return NextResponse.json(
      { 
        error: "Failed to process your message. Please try again.",
        details: (globalThis as any).process?.env?.NODE_ENV === "development" ? error instanceof Error ? error.message : "Unknown error" : undefined
      },
      { status: 500 }
    );
  }
}
