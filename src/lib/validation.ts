export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FileValidationResult extends ValidationResult {
  fileSize: number;
  fileType: string;
  fileName: string;
}

export interface ChatValidationResult extends ValidationResult {
  messageLength: number;
  hasContent: boolean;
}

// File validation
export function validateFile(file: File): FileValidationResult {
  const errors: string[] = [];
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['application/pdf'];

  if (!file) {
    return {
      isValid: false,
      errors: ['No file provided'],
      fileSize: 0,
      fileType: '',
      fileName: '',
    };
  }

  // Check file size
  if (file.size > maxSize) {
    errors.push(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
  }

  if (file.size === 0) {
    errors.push('File is empty');
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    errors.push('Only PDF files are allowed');
  }

  // Check file name
  if (!file.name || file.name.trim().length === 0) {
    errors.push('File must have a name');
  }

  if (file.name.length > 255) {
    errors.push('File name is too long');
  }

  return {
    isValid: errors.length === 0,
    errors,
    fileSize: file.size,
    fileType: file.type,
    fileName: file.name,
  };
}

// Message validation
export function validateMessage(message: string): ChatValidationResult {
  const errors: string[] = [];
  const maxLength = 1000;
  const minLength = 1;

  if (!message || typeof message !== 'string') {
    return {
      isValid: false,
      errors: ['Message is required'],
      messageLength: 0,
      hasContent: false,
    };
  }

  const trimmedMessage = message.trim();

  if (trimmedMessage.length < minLength) {
    errors.push('Message cannot be empty');
  }

  if (trimmedMessage.length > maxLength) {
    errors.push(`Message must be less than ${maxLength} characters`);
  }

  // Check for potentially harmful content
  const harmfulPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  for (const pattern of harmfulPatterns) {
    if (pattern.test(trimmedMessage)) {
      errors.push('Message contains potentially harmful content');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    messageLength: trimmedMessage.length,
    hasContent: trimmedMessage.length > 0,
  };
}

// Chat ID validation
export function validateChatId(chatId: any): ValidationResult {
  const errors: string[] = [];

  if (!chatId) {
    errors.push('Chat ID is required');
    return { isValid: false, errors };
  }

  const numChatId = Number(chatId);
  if (isNaN(numChatId) || numChatId <= 0 || !Number.isInteger(numChatId)) {
    errors.push('Chat ID must be a positive integer');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// File key validation
export function validateFileKey(fileKey: any): ValidationResult {
  const errors: string[] = [];

  if (!fileKey || typeof fileKey !== 'string') {
    errors.push('File key is required and must be a string');
    return { isValid: false, errors };
  }

  if (fileKey.trim().length === 0) {
    errors.push('File key cannot be empty');
  }

  if (fileKey.length > 255) {
    errors.push('File key is too long');
  }

  // Check for potentially harmful characters
  if (/[<>:"|?*]/.test(fileKey)) {
    errors.push('File key contains invalid characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// File name validation
export function validateFileName(fileName: any): ValidationResult {
  const errors: string[] = [];

  if (!fileName || typeof fileName !== 'string') {
    errors.push('File name is required and must be a string');
    return { isValid: false, errors };
  }

  if (fileName.trim().length === 0) {
    errors.push('File name cannot be empty');
  }

  if (fileName.length > 255) {
    errors.push('File name is too long');
  }

  // Check for potentially harmful characters
  if (/[<>:"|?*]/.test(fileName)) {
    errors.push('File name contains invalid characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Rate limiting validation (basic implementation)
export function validateRateLimit(
  userId: string,
  action: 'upload' | 'chat' | 'message',
  timestamp: number
): ValidationResult {
  const errors: string[] = [];
  
  // This is a basic implementation
  // In production, you'd want to use Redis or a similar service
  const rateLimits = {
    upload: { maxRequests: 10, windowMs: 60000 }, // 10 uploads per minute
    chat: { maxRequests: 50, windowMs: 60000 }, // 50 messages per minute
    message: { maxRequests: 100, windowMs: 60000 }, // 100 messages per minute
  };

  const limit = rateLimits[action];
  
  // For now, we'll just do basic validation
  // In a real implementation, you'd check against stored timestamps
  if (!userId) {
    errors.push('User ID is required for rate limiting');
  }

  if (!timestamp || timestamp <= 0) {
    errors.push('Valid timestamp is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Sanitize user input
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 1000); // Limit length
}

// Validate environment variables
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const requiredVars = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'DATABASE_URL',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET',
    'OPENAI_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_ENVIRONMENT',
  ];

  for (const varName of requiredVars) {
    if (!(globalThis as any).process?.env?.[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}