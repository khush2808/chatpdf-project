import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function getEmbeddings(text: string) {
  console.log("🧠 Starting embedding generation...");
  console.log(`   - Text length: ${text.length} characters`);
  console.log(`   - Text preview: "${text.substring(0, 100)}..."`);

  try {
    console.log("🔧 Initializing Gemini embedding model...");
    const model = genAI.getGenerativeModel({ model: "embedding-001" });

    console.log("⚡ Generating embeddings...");
    const result = await model.embedContent(text);
    const embedding = result.embedding;

    if (!embedding.values) {
      console.error("❌ No embedding values returned from Gemini");
      throw new Error("Failed to generate embeddings");
    }

    console.log("✅ Embeddings generated successfully:");
    console.log(`   - Embedding dimensions: ${embedding.values.length}`);
    console.log(
      `   - First 5 values: [${embedding.values
        .slice(0, 5)
        .map((v) => v.toFixed(4))
        .join(", ")}...]`
    );

    return embedding.values;
  } catch (error) {
    console.error("❌ Error generating embeddings:", error);

    // More specific error handling
    if (error instanceof Error) {
      console.error("   - Error message:", error.message);
      console.error("   - Error stack:", error.stack);
    }

    throw error;
  }
}
