export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
}

class Cache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes default
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, entry);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for this
    };
  }
}

// Create specialized cache instances
export const messageCache = new Cache({ ttl: 10 * 60 * 1000, maxSize: 50 }); // 10 minutes
export const chatCache = new Cache({ ttl: 30 * 60 * 1000, maxSize: 20 }); // 30 minutes
export const userCache = new Cache({ ttl: 60 * 60 * 1000, maxSize: 100 }); // 1 hour
export const pdfCache = new Cache({ ttl: 24 * 60 * 60 * 1000, maxSize: 10 }); // 24 hours

// Cache keys generator
export const cacheKeys = {
  messages: (chatId: number) => `messages:${chatId}`,
  chat: (chatId: number) => `chat:${chatId}`,
  user: (userId: string) => `user:${userId}`,
  pdf: (fileKey: string) => `pdf:${fileKey}`,
  context: (fileKey: string, query: string) => `context:${fileKey}:${query}`,
};

// Cache utilities
export const cacheUtils = {
  // Cache messages for a chat
  cacheMessages: (chatId: number, messages: any[]) => {
    messageCache.set(cacheKeys.messages(chatId), messages);
  },

  // Get cached messages for a chat
  getCachedMessages: (chatId: number) => {
    return messageCache.get(cacheKeys.messages(chatId));
  },

  // Cache chat data
  cacheChat: (chatId: number, chatData: any) => {
    chatCache.set(cacheKeys.chat(chatId), chatData);
  },

  // Get cached chat data
  getCachedChat: (chatId: number) => {
    return chatCache.get(cacheKeys.chat(chatId));
  },

  // Cache user data
  cacheUser: (userId: string, userData: any) => {
    userCache.set(cacheKeys.user(userId), userData);
  },

  // Get cached user data
  getCachedUser: (userId: string) => {
    return userCache.get(cacheKeys.user(userId));
  },

  // Cache PDF metadata
  cachePDF: (fileKey: string, pdfData: any) => {
    pdfCache.set(cacheKeys.pdf(fileKey), pdfData);
  },

  // Get cached PDF metadata
  getCachedPDF: (fileKey: string) => {
    return pdfCache.get(cacheKeys.pdf(fileKey));
  },

  // Cache context for a query
  cacheContext: (fileKey: string, query: string, context: string) => {
    const key = cacheKeys.context(fileKey, query);
    messageCache.set(key, context, 5 * 60 * 1000); // 5 minutes TTL for context
  },

  // Get cached context for a query
  getCachedContext: (fileKey: string, query: string) => {
    const key = cacheKeys.context(fileKey, query);
    return messageCache.get(key);
  },

  // Invalidate cache entries
  invalidate: {
    messages: (chatId: number) => {
      messageCache.delete(cacheKeys.messages(chatId));
    },
    chat: (chatId: number) => {
      chatCache.delete(cacheKeys.chat(chatId));
    },
    user: (userId: string) => {
      userCache.delete(cacheKeys.user(userId));
    },
    pdf: (fileKey: string) => {
      pdfCache.delete(cacheKeys.pdf(fileKey));
    },
    context: (fileKey: string, query: string) => {
      const key = cacheKeys.context(fileKey, query);
      messageCache.delete(key);
    },
  },

  // Clear all caches
  clearAll: () => {
    messageCache.clear();
    chatCache.clear();
    userCache.clear();
    pdfCache.clear();
  },

  // Get cache statistics
  getStats: () => ({
    messages: messageCache.getStats(),
    chats: chatCache.getStats(),
    users: userCache.getStats(),
    pdfs: pdfCache.getStats(),
  }),
};

// Auto-cleanup expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    messageCache.cleanup();
    chatCache.cleanup();
    userCache.cleanup();
    pdfCache.cleanup();
  }, 5 * 60 * 1000);
}