import { NextRequest, NextResponse } from "next/server";
import { getContext } from "@/lib/pinecone";
import { db } from "@/lib/db";
import { chats, messages } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withCors } from "@/lib/cors";

const ChatSchema = z.object({
  chatId: z.number().int().positive(),
  message: z.string().min(1),
});

// Utility to parse the chunked SSE stream returned by OpenAI when `stream: true`.
// It yields incremental content strings.
function streamOpenAIChunks(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder("utf-8");
  const encoder = new TextEncoder();

  let buffer = "";
  let accumulated = "";

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // keep last partial line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.replace("data:", "").trim();

            if (dataStr === "[DONE]") {
              controller.close();
              return;
            }

            let json;
            try {
              json = JSON.parse(dataStr);
            } catch {
              continue; // malformed line – skip
            }

            const content = json.choices?.[0]?.delta?.content ?? "";
            if (content) {
              accumulated += content;
              controller.enqueue(encoder.encode(content));
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return { readable, getAccumulated: () => accumulated };
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  const json = await req.json();

  const parseRes = ChatSchema.safeParse(json);
  if (!parseRes.success) {
    return withCors(NextResponse.json({ error: "Invalid payload" }, { status: 400 }));
  }

  const { chatId, message } = parseRes.data;

  try {
    // ------------------------------------------------------------------
    // Verify chat belongs to user & obtain file key
    // ------------------------------------------------------------------
    const chat = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat.length || chat[0].userId !== userId) {
      return withCors(NextResponse.json({ error: "Chat not found" }, { status: 404 }));
    }

    // ------------------------------------------------------------------
    // Persist user's message immediately (fire-and-forget)
    // ------------------------------------------------------------------
    await db.insert(messages).values({
      chatId,
      content: message,
      role: "user",
    });

    // ------------------------------------------------------------------
    // Retrieve RAG context from Pinecone
    // ------------------------------------------------------------------
    const context = await getContext(message, chat[0].fileKey);

    // ------------------------------------------------------------------
    // Build conversation prompt
    // ------------------------------------------------------------------
    const prompt = `You are a helpful AI assistant that answers questions about PDF documents.\n\nContext from the document:\n${context}\n\nUser question: ${message}\n\nPlease provide a concise answer based on the context. If the context doesn't contain relevant information, say so.`;

    // ------------------------------------------------------------------
    // Call OpenAI with streaming enabled
    // ------------------------------------------------------------------
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        stream: true,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!openaiRes.ok || !openaiRes.body) {
      throw new Error(`OpenAI request failed with status ${openaiRes.status}`);
    }

    const { readable, getAccumulated } = streamOpenAIChunks(openaiRes.body);

    // When the streaming is done, store the AI's full message in DB.
    readable
      .pipeTo(new WritableStream({
        write() {},
        close() {
          const aiMessage = getAccumulated();
          db.insert(messages)
            .values({ chatId, content: aiMessage, role: "system" })
            .catch(console.error);
        },
      }))
      .catch(console.error);

    // Return streaming response to client
    return withCors(new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    }));
  } catch (error) {
    console.error("Error in chat:", error);
    return withCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
  }
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 200 }));
}
