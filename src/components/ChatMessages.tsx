"use client";
import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Send, Loader2 } from "lucide-react";
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

const ChatMessages = ({ chatId }: Props) => {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);

  // Fetch existing messages
  const { data, isLoading } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const response = await axios.get(`/api/messages/${chatId}`);
      return response.data;
    },
  });

  React.useEffect(() => {
    if (data) {
      setMessages(data);
    }
  }, [data]);

  // Send message mutation
  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async (message: string) => {
      const response = await axios.post("/api/chat", {
        chatId,
        message,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Add user message
      const userMessage: Message = {
        id: Date.now(),
        content: input,
        role: "user",
        createdAt: new Date().toISOString(),
      };

      // Add AI response
      const aiMessage: Message = {
        id: Date.now() + 1,
        content: data.message,
        role: "system",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage, aiMessage]);
      setInput("");
    },
    onError: () => {
      toast.error("Error sending message");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
  };

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="relative max-h-screen overflow-scroll">
      {/* Header */}
      <div className="sticky top-0 inset-x-0 p-3 bg-white h-fit">
        <h3 className="text-xl font-bold">Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-2 px-4">
        {isLoading && (
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-lg px-3 py-2 max-w-sm lg:max-w-md ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-900"
              }`}
            >
              <p className="text-sm">{message.content}</p>
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-900 rounded-lg px-3 py-2 max-w-sm lg:max-w-md">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 inset-x-0 px-4 py-4 bg-white"
      >
        <div className="flex">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask any question about your PDF..."
            className="w-full px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isPending}
          />
          <Button
            className="rounded-l-none"
            type="submit"
            disabled={isPending || !input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatMessages;
