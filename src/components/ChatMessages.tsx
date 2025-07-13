"use client";
import React, { useRef, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Send, Loader2, AlertCircle, RefreshCw, User, Bot } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "react-hot-toast";

type Props = {
  chatId: number;
};

type Message = {
  id: number;
  content: string;
  role: "user" | "system";
  createdAt: string;
};

interface ChatResponse {
  message: string;
  context: string;
  chatId: number;
}

const ChatMessages = ({ chatId }: Props) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch existing messages
  const { 
    data, 
    isLoading, 
    error: fetchError,
    refetch 
  } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      try {
        const response = await axios.get(`/api/messages/${chatId}`);
        return response.data;
      } catch (error: any) {
        console.error("Error fetching messages:", error);
        throw new Error(error.response?.data?.error || "Failed to load messages");
      }
    },
    retry: 3,
    retryDelay: 1000,
  });

  // Update messages when data changes
  useEffect(() => {
    if (data) {
      setMessages(data);
    }
  }, [data]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message mutation
  const { 
    mutate: sendMessage, 
    isPending,
    error: sendError,
    reset: resetSendMutation
  } = useMutation({
    mutationFn: async (message: string): Promise<ChatResponse> => {
      try {
        const response = await axios.post("/api/chat", {
          chatId,
          message,
        });
        return response.data;
      } catch (error: any) {
        console.error("Error sending message:", error);
        throw new Error(error.response?.data?.error || "Failed to send message");
      }
    },
    onMutate: () => {
      // Add user message immediately for better UX
      const userMessage: Message = {
        id: Date.now(),
        content: input,
        role: "user",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev: Message[]) => [...prev, userMessage]);
      setInput("");
      setIsTyping(true);
    },
    onSuccess: (data) => {
      setIsTyping(false);
      
      // Add AI response
      const aiMessage: Message = {
        id: Date.now() + 1,
        content: data.message,
        role: "system",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev: Message[]) => [...prev, aiMessage]);
      
      // Show context info if available
      if (data.context && data.context !== "No relevant context found.") {
        toast.success("Found relevant context for your question");
      }
    },
    onError: (error: any) => {
      setIsTyping(false);
      
      // Remove the user message if sending failed
      setMessages((prev: Message[]) => prev.slice(0, -1));
      
      const errorMessage = error.message || "Failed to send message";
      toast.error(errorMessage);
      
      // Add error message to chat
      const errorMsg: Message = {
        id: Date.now() + 1,
        content: "Sorry, I encountered an error. Please try again.",
        role: "system",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev: Message[]) => [...prev, errorMsg]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isPending) return;
    
    const trimmedInput = input.trim();
    if (trimmedInput.length === 0) return;
    
    sendMessage(trimmedInput);
  };

  const handleRetry = () => {
    if (sendError) {
      resetSendMutation();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Failed to Load Messages
        </h3>
        <p className="text-gray-600 text-center mb-4 max-w-md">
          {fetchError.message || "Unable to load chat messages"}
        </p>
        <Button onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <h3 className="text-lg font-semibold text-gray-900">Chat</h3>
        {isLoading && (
          <p className="text-sm text-gray-500 mt-1">Loading messages...</p>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div className="flex items-start gap-3 max-w-[80%]">
              {message.role === "system" && (
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div
                className={`rounded-lg px-4 py-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.role === "user" ? "text-blue-100" : "text-gray-500"
                }`}>
                  {formatTime(message.createdAt)}
                </p>
              </div>
              
              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-start gap-3 max-w-[80%]">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-xs text-gray-500 ml-2">AI is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {sendError && (
          <div className="flex justify-start">
            <div className="flex items-start gap-3 max-w-[80%]">
              <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3">
                <p className="text-sm">Failed to send message</p>
                <button 
                  onClick={handleRetry}
                  className="text-xs text-red-600 hover:text-red-800 underline mt-1"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask any question about your PDF..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            disabled={isPending || isTyping}
          />
          <Button
            type="submit"
            disabled={isPending || isTyping || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
        
        {messages.length === 0 && !isLoading && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Start a conversation by asking a question about your PDF
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatMessages;
