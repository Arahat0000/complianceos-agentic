import React, { createContext, useContext } from "react";
import type { Message } from "@/components/ask-ai-drawer";

export interface AskAIContextType {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggle: () => void;
  messages: Message[];
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isThinking: boolean;
  thinkingStep: number;
  handleSend: (textToSend?: string) => void;
  handleReset: () => void;
}

export const AskAIContext = createContext<AskAIContextType | null>(null);

export function useAskAI() {
  const ctx = useContext(AskAIContext);
  if (!ctx) {
    throw new Error("useAskAI must be used within an AskAIProvider");
  }
  return ctx;
}
