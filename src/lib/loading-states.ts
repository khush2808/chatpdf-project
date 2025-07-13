export interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
  error?: string;
}

export interface UploadState extends LoadingState {
  isUploading: boolean;
  isProcessing: boolean;
  uploadProgress: number;
  processingProgress: number;
}

export interface ChatState extends LoadingState {
  isTyping: boolean;
  isSending: boolean;
  retryCount: number;
}

export const createLoadingState = (): LoadingState => ({
  isLoading: false,
  progress: 0,
  message: '',
  error: undefined,
});

export const createUploadState = (): UploadState => ({
  isLoading: false,
  isUploading: false,
  isProcessing: false,
  progress: 0,
  uploadProgress: 0,
  processingProgress: 0,
  message: '',
  error: undefined,
});

export const createChatState = (): ChatState => ({
  isLoading: false,
  isTyping: false,
  isSending: false,
  progress: 0,
  message: '',
  error: undefined,
  retryCount: 0,
});

export const loadingMessages = {
  upload: {
    starting: 'Preparing upload...',
    uploading: 'Uploading PDF...',
    processing: 'Processing PDF...',
    vectorizing: 'Creating vector embeddings...',
    complete: 'Upload complete!',
  },
  chat: {
    sending: 'Sending message...',
    thinking: 'AI is thinking...',
    generating: 'Generating response...',
    complete: 'Response received',
  },
  error: {
    upload: 'Upload failed. Please try again.',
    processing: 'PDF processing failed. Please try a different file.',
    chat: 'Failed to send message. Please try again.',
    network: 'Network error. Please check your connection.',
    auth: 'Authentication error. Please sign in again.',
  },
};