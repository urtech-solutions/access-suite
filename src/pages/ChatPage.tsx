import { useState } from "react";
import { ArrowLeft, Send, Phone, Video, Image, Paperclip, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface ChatContact {
  id: string;
  name: string;
  role: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatar: string;
  online: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: "me" | "other";
  time: string;
}

const contacts: ChatContact[] = [
  { id: "1", name: "Portaria", role: "Equipe", lastMessage: "Seu visitante chegou!", time: "14:30", unread: 2, avatar: "🏢", online: true },
  { id: "2", name: "Síndico - Roberto", role: "Gestão", lastMessage: "Reunião confirmada para sexta", time: "12:00", unread: 0, avatar: "👔", online: true },
  { id: "3", name: "Zelador - Marcos", role: "Manutenção", lastMessage: "Problema resolvido!", time: "Ontem", unread: 0, avatar: "🔧", online: false },
  { id: "4", name: "Vizinho 302 - Ana", role: "Morador", lastMessage: "Obrigada pela informação!", time: "Ontem", unread: 0, avatar: "👩", online: false },
];

const mockMessages: Message[] = [
  { id: "1", text: "Olá! Meu visitante já chegou?", sender: "me", time: "14:25" },
  { id: "2", text: "Sim! O João Silva acabou de chegar na portaria.", sender: "other", time: "14:28" },
  { id: "3", text: "Seu visitante chegou!", sender: "other", time: "14:30" },
  { id: "4", text: "Pode liberar, por favor!", sender: "me", time: "14:30" },
  { id: "5", text: "Liberado! Ele está subindo. 👍", sender: "other", time: "14:31" },
];

const ChatPage = () => {
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState<ChatContact | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  if (selectedChat) {
    return (
      <div className="flex flex-col h-screen max-w-md mx-auto">
        {/* Chat Header */}
        <div className="bg-primary px-4 pt-12 pb-4 space-y-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setSelectedChat(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-primary-foreground/20 rounded-full flex items-center justify-center text-lg">
                {selectedChat.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary-foreground text-sm">{selectedChat.name}</p>
                <p className="text-xs text-primary-foreground/70">
                  {selectedChat.online ? "Online" : "Offline"}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Phone className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Video className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/50">
          {mockMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.sender === "me"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card text-foreground border border-border rounded-bl-md"
                }`}
              >
                <p>{msg.text}</p>
                <p className={`text-[10px] mt-1 ${msg.sender === "me" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {msg.time}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Input */}
        <div className="bg-card border-t border-border px-4 py-3 flex items-center gap-2 safe-bottom">
          <Button variant="ghost" size="icon" className="shrink-0">
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0">
            <Image className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Input
            className="flex-1 rounded-full bg-muted border-0"
            placeholder="Mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button variant="accent" size="icon" className="rounded-full shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-12 pb-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground flex-1">Chat</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 rounded-full bg-muted border-0"
          placeholder="Buscar conversa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        {contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map((contact, i) => (
          <motion.button
            key={contact.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
            onClick={() => setSelectedChat(contact)}
          >
            <div className="relative">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-xl">
                {contact.avatar}
              </div>
              {contact.online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-card" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground text-sm">{contact.name}</p>
                <span className="text-[10px] text-muted-foreground">{contact.time}</span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-muted-foreground truncate pr-2">{contact.lastMessage}</p>
                {contact.unread > 0 && (
                  <Badge variant="default" className="h-5 min-w-[20px] flex items-center justify-center bg-accent text-accent-foreground text-[10px] px-1.5">
                    {contact.unread}
                  </Badge>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ChatPage;
