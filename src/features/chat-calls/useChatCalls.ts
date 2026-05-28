import { useContext } from "react";

import { ChatCallsContext } from "@/features/chat-calls/chat-calls-context";

export function useChatCalls() {
  const context = useContext(ChatCallsContext);
  if (!context) {
    throw new Error("useChatCalls must be used within ChatCallsProvider");
  }
  return context;
}
