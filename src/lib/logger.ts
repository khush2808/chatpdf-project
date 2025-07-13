export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = (globalThis as any).process?.env?.NODE_ENV === 'development';
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    const errorStr = error ? ` | Error: ${error.message}` : '';
    
    return `[${timestamp}] ${levelName}: ${message}${contextStr}${errorStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context, error);
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedMessage);
        break;
    }

    // In production, you might want to send logs to a service like Sentry, LogRocket, etc.
    if (level >= LogLevel.ERROR && !this.isDevelopment) {
      this.sendToExternalService(level, message, context, error);
    }
  }

  private sendToExternalService(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    // This is where you'd integrate with external logging services
    // For now, we'll just log to console
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    // Example: Send to external service
    // await fetch('/api/logs', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(logEntry),
    // });
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  // Specialized logging methods for different parts of the application
  logUpload(userId: string, fileKey: string, fileName: string, fileSize: number): void {
    this.info('File upload started', {
      userId,
      fileKey,
      fileName,
      fileSize,
      action: 'upload',
    });
  }

  logUploadSuccess(userId: string, fileKey: string, chatId: number): void {
    this.info('File upload completed successfully', {
      userId,
      fileKey,
      chatId,
      action: 'upload_success',
    });
  }

  logUploadError(userId: string, fileKey: string, error: Error): void {
    this.error('File upload failed', {
      userId,
      fileKey,
      action: 'upload_error',
    }, error);
  }

  logChatMessage(userId: string, chatId: number, messageLength: number): void {
    this.info('Chat message sent', {
      userId,
      chatId,
      messageLength,
      action: 'chat_message',
    });
  }

  logChatResponse(userId: string, chatId: number, responseLength: number, contextFound: boolean): void {
    this.info('Chat response generated', {
      userId,
      chatId,
      responseLength,
      contextFound,
      action: 'chat_response',
    });
  }

  logChatError(userId: string, chatId: number, error: Error): void {
    this.error('Chat message failed', {
      userId,
      chatId,
      action: 'chat_error',
    }, error);
  }

  logPDFProcessing(fileKey: string, pagesProcessed: number, chunksCreated: number): void {
    this.info('PDF processing completed', {
      fileKey,
      pagesProcessed,
      chunksCreated,
      action: 'pdf_processing',
    });
  }

  logPDFProcessingError(fileKey: string, error: Error): void {
    this.error('PDF processing failed', {
      fileKey,
      action: 'pdf_processing_error',
    }, error);
  }

  logVectorUpload(fileKey: string, vectorsCount: number, namespace: string): void {
    this.info('Vectors uploaded to Pinecone', {
      fileKey,
      vectorsCount,
      namespace,
      action: 'vector_upload',
    });
  }

  logVectorUploadError(fileKey: string, error: Error): void {
    this.error('Vector upload failed', {
      fileKey,
      action: 'vector_upload_error',
    }, error);
  }

  logAPICall(endpoint: string, method: string, statusCode: number, duration: number): void {
    this.info('API call completed', {
      endpoint,
      method,
      statusCode,
      duration,
      action: 'api_call',
    });
  }

  logAPIError(endpoint: string, method: string, error: Error): void {
    this.error('API call failed', {
      endpoint,
      method,
      action: 'api_error',
    }, error);
  }

  logAuthentication(userId: string, action: 'sign_in' | 'sign_up' | 'sign_out'): void {
    this.info('Authentication event', {
      userId,
      action,
    });
  }

  logAuthorization(userId: string, resource: string, action: string, allowed: boolean): void {
    this.info('Authorization check', {
      userId,
      resource,
      action,
      allowed,
    });
  }
}

// Create a singleton instance
export const logger = new Logger();

// Export convenience functions
export const logDebug = (message: string, context?: Record<string, any>) => logger.debug(message, context);
export const logInfo = (message: string, context?: Record<string, any>) => logger.info(message, context);
export const logWarn = (message: string, context?: Record<string, any>, error?: Error) => logger.warn(message, context, error);
export const logError = (message: string, context?: Record<string, any>, error?: Error) => logger.error(message, context, error);
export const logFatal = (message: string, context?: Record<string, any>, error?: Error) => logger.fatal(message, context, error);