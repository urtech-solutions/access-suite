import { useState } from "react";
import { Image, Paperclip, Phone, Search, Send, Video } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/features/shared/PageHeader";
import { appendChatMessage, listChats } from "@/services/mobile-app.service";

const ChatPage = () => {
  const queryClient = useQueryClient();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const chatsQuery = useQuery({
    queryKey: ["local-chats"],
    queryFn: async () => listChats(),
  });

  const chats = chatsQuery.data ?? [];
  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;

  function handleVoiceFeature() {
    toast.message("Chamadas de voz entram na próxima fase do backend de comunicação.");
  }

  function handleSend() {
    if (!selectedChat || !message.trim()) return;
    appendChatMessage(selectedChat.id, message.trim());
    setMessage("");
    queryClient.invalidateQueries({ queryKey: ["local-chats"] });
  }

  if (selectedChat) {
    return (
      <div className="flex h-screen max-w-md flex-col">
        <div className="bg-primary px-4 pb-4 pt-8 text-primary-foreground">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setSelectedChatId(null)}
            >
              <span className="text-lg leading-none">‹</span>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">{selectedChat.name}</h1>
              <p className="mt-1 text-sm text-primary-foreground/70">
                {selectedChat.online ? "Online agora" : "Responderá quando voltar"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="rounded-full text-primary-foreground hover:bg-primary-foreground/10" onClick={handleVoiceFeature}>
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full text-primary-foreground hover:bg-primary-foreground/10" onClick={handleVoiceFeature}>
                <Video className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-muted/50 px-4 py-4">
          {selectedChat.messages.map((chatMessage) => (
            <motion.div
              key={chatMessage.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${chatMessage.sender === "me" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] rounded-[22px] px-4 py-3 text-sm ${
                  chatMessage.sender === "me"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border bg-card text-foreground"
                }`}
              >
                <p>{chatMessage.text}</p>
                <p className={`mt-2 text-[10px] ${chatMessage.sender === "me" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {chatMessage.time}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="safe-bottom flex items-center gap-2 border-t border-border bg-card px-4 py-3">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Image className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Input
            className="rounded-full border-0 bg-muted"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Mensagem..."
          />
          <Button variant="accent" size="icon" className="rounded-full" onClick={handleSend}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-6 pt-8">
      <PageHeader
        title="Chat condominial"
        subtitle="Portaria, zeladoria e gestão em uma camada de comunicação evolutiva."
        backTo="/"
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-full border-0 bg-muted pl-10"
          placeholder="Buscar conversa..."
        />
      </div>

      <div className="space-y-2">
        {chats
          .filter((chat) => chat.name.toLowerCase().includes(search.toLowerCase()))
          .map((chat, index) => (
            <motion.button
              key={chat.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex w-full items-center gap-3 rounded-[22px] border border-border bg-card p-3 text-left shadow-sm"
              onClick={() => setSelectedChatId(chat.id)}
            >
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-sm font-semibold text-secondary-foreground">
                {chat.avatar}
                {chat.online ? <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-success" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{chat.name}</p>
                  <span className="text-[11px] text-muted-foreground">{chat.time}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">{chat.last_message}</p>
                  {chat.unread > 0 ? <Badge variant="warning">{chat.unread}</Badge> : null}
                </div>
              </div>
            </motion.button>
          ))}
      </div>
    </div>
  );
};

export default ChatPage;
