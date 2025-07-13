import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import ChatSideBar from "@/components/ChatSideBar";
import PDFViewer from "@/components/PDFViewer";
import ChatMessages from "@/components/ChatMessages";

type Props = {
  params: {
    chatId: string;
  };
};

const ChatPage = async ({ params: { chatId } }: Props) => {
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  // Get all chats for the sidebar
  const _chats = await db.select().from(chats).where(eq(chats.userId, userId));

  if (!_chats) {
    return redirect("/");
  }

  // Find the current chat
  const currentChat = _chats.find((chat) => chat.id === parseInt(chatId));

  if (!currentChat) {
    return redirect("/");
  }

  return (
    <div className="flex max-h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="flex w-full max-h-screen overflow-hidden">
        {/* Chat Sidebar */}
        <div className="flex-[1] max-w-xs">
          <ChatSideBar chats={_chats} chatId={parseInt(chatId)} />
        </div>

        {/* PDF Viewer */}
        <div className="max-h-screen p-4 overflow-auto flex-[5]">
          <PDFViewer pdf_url={currentChat.pdfUrl} />
        </div>

        {/* Chat Messages */}
        <div className="flex-[3] border-l-4 border-l-slate-200">
          <ChatMessages chatId={parseInt(chatId)} />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
