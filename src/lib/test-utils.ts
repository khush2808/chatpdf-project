import { db } from "@/lib/db";
import { chats, messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface TestUser {
  id: string;
  email: string;
}

export interface TestChat {
  id: number;
  fileKey: string;
  pdfName: string;
  userId: string;
}

export interface TestMessage {
  id: number;
  chatId: number;
  content: string;
  role: "user" | "system";
}

export class TestUtils {
  private static testUsers: TestUser[] = [];
  private static testChats: TestChat[] = [];
  private static testMessages: TestMessage[] = [];

  // Create a test user
  static async createTestUser(email: string = "test@example.com"): Promise<TestUser> {
    const user: TestUser = {
      id: `test_user_${Date.now()}`,
      email,
    };
    
    this.testUsers.push(user);
    return user;
  }

  // Create a test chat
  static async createTestChat(userId: string, fileKey: string = "test-file.pdf"): Promise<TestChat> {
    const chat = await db
      .insert(chats)
      .values({
        pdfName: "test-document.pdf",
        pdfUrl: `https://s3.amazonaws.com/bucket/${fileKey}`,
        userId,
        fileKey,
      })
      .returning();

    const testChat: TestChat = {
      id: chat[0].id,
      fileKey,
      pdfName: chat[0].pdfName,
      userId,
    };

    this.testChats.push(testChat);
    return testChat;
  }

  // Create a test message
  static async createTestMessage(
    chatId: number,
    content: string = "Test message",
    role: "user" | "system" = "user"
  ): Promise<TestMessage> {
    const message = await db
      .insert(messages)
      .values({
        chatId,
        content,
        role,
      })
      .returning();

    const testMessage: TestMessage = {
      id: message[0].id,
      chatId,
      content,
      role,
    };

    this.testMessages.push(testMessage);
    return testMessage;
  }

  // Clean up test data
  static async cleanup(): Promise<void> {
    // Clean up test messages
    for (const message of this.testMessages) {
      await db.delete(messages).where(eq(messages.id, message.id));
    }

    // Clean up test chats
    for (const chat of this.testChats) {
      await db.delete(chats).where(eq(chats.id, chat.id));
    }

    // Clear arrays
    this.testMessages = [];
    this.testChats = [];
    this.testUsers = [];
  }

  // Mock PDF file for testing
  static createMockPDFFile(name: string = "test.pdf", size: number = 1024): File {
    const blob = new Blob(["%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test PDF Content) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n297\n%%EOF"], {
      type: "application/pdf",
    });

    return new File([blob], name, { type: "application/pdf" });
  }

  // Mock API response
  static createMockAPIResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Mock fetch for testing
  static mockFetch(response: any, status: number = 200): any {
    return (globalThis as any).jest?.fn?.()?.mockResolvedValue?.(this.createMockAPIResponse(response, status)) || 
           (() => Promise.resolve(this.createMockAPIResponse(response, status)));
  }

  // Wait for async operations
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Generate test data
  static generateTestData() {
    return {
      users: [
        { id: "user1", email: "user1@example.com" },
        { id: "user2", email: "user2@example.com" },
      ],
      chats: [
        { id: 1, fileKey: "file1.pdf", pdfName: "Document 1", userId: "user1" },
        { id: 2, fileKey: "file2.pdf", pdfName: "Document 2", userId: "user1" },
        { id: 3, fileKey: "file3.pdf", pdfName: "Document 3", userId: "user2" },
      ],
      messages: [
        { id: 1, chatId: 1, content: "What is this document about?", role: "user" as const },
        { id: 2, chatId: 1, content: "This document discusses AI and machine learning.", role: "system" as const },
        { id: 3, chatId: 1, content: "Can you summarize it?", role: "user" as const },
        { id: 4, chatId: 1, content: "The document provides an overview of AI technologies.", role: "system" as const },
      ],
    };
  }

  // Validate test data
  static validateTestData(data: any): boolean {
    const required = ["users", "chats", "messages"];
    return required.every(key => Array.isArray(data[key]));
  }

  // Create test environment
  static async setupTestEnvironment(): Promise<{
    users: TestUser[];
    chats: TestChat[];
    messages: TestMessage[];
  }> {
    const testData = this.generateTestData();
    
    // Create test users
    const users = await Promise.all(
      testData.users.map(user => this.createTestUser(user.email))
    );

    // Create test chats
    const chats = await Promise.all(
      testData.chats.map(chat => this.createTestChat(chat.userId, chat.fileKey))
    );

    // Create test messages
    const messages = await Promise.all(
      testData.messages.map(msg => this.createTestMessage(msg.chatId, msg.content, msg.role))
    );

    return { users, chats, messages };
  }

  // Reset database for testing
  static async resetDatabase(): Promise<void> {
    // This would typically truncate all tables
    // For now, we'll just clean up our test data
    await this.cleanup();
  }

  // Mock authentication
  static mockAuth(userId: string = "test_user"): any {
    return {
      userId,
      isSignedIn: true,
      isLoaded: true,
    };
  }

  // Mock file upload response
  static mockUploadResponse(fileKey: string = "test-file-key"): any {
    return {
      file_key: fileKey,
      file_name: "test-document.pdf",
    };
  }

  // Mock chat response
  static mockChatResponse(message: string = "Test response"): any {
    return {
      message,
      context: "Context found",
      chatId: 1,
    };
  }

  // Mock error response
  static mockErrorResponse(error: string = "Test error"): any {
    return {
      error,
      status: 500,
    };
  }
}

// Export convenience functions
export const createTestUser = (email?: string) => TestUtils.createTestUser(email);
export const createTestChat = (userId: string, fileKey?: string) => TestUtils.createTestChat(userId, fileKey);
export const createTestMessage = (chatId: number, content?: string, role?: "user" | "system") => 
  TestUtils.createTestMessage(chatId, content, role);
export const cleanup = () => TestUtils.cleanup();
export const createMockPDFFile = (name?: string, size?: number) => TestUtils.createMockPDFFile(name, size);
export const setupTestEnvironment = () => TestUtils.setupTestEnvironment();
export const resetDatabase = () => TestUtils.resetDatabase();