import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bot,
  User,
  Copy,
  Check,
  ArrowRight,
  FileText,
  Loader2,
  ChevronDown,
  Plus,
  Maximize2,
  Minimize2,
  X,
  ArrowUp,
  RefreshCw,
  Rocket,
  Box,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AskAIContext, useAskAI } from "@/components/ask-ai-context";
import { generateComplianceAiResponse } from "@/data/complianceAiData";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  title?: string;
  citations?: string[];
  relatedAction?: {
    label: string;
    href: string;
  };
  timestamp: string;
}

const AGENT_THINKING_STEPS = [
  "Searching regulatory knowledge base...",
  "Cross-referencing circular obligations...",
  "Synthesizing compliance guidance...",
];

interface QuickActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  prompt: string;
}

const HERO_ACTION_ITEMS: QuickActionItem[] = [
  {
    id: "bind-regulations",
    title: "Bind Regulations to Controls",
    subtitle: "Connect circular obligations to unified controls",
    icon: Layers,
    prompt: "How does the AI mapper link regulations to controls and assessment questions?",
  },
  {
    id: "resolve-gaps",
    title: "Resolve Critical Gaps",
    subtitle: "Walk me through the unblocking process",
    icon: RefreshCw,
    prompt: "Why is export blocked and how do I resolve critical gaps?",
  },
  {
    id: "audit-readiness",
    title: "Deploy Audit Readiness",
    subtitle: "Help me get started with signoff",
    icon: Rocket,
    prompt: "How does the formal Risk Acceptance workflow work for auditors?",
  },
  {
    id: "statutory-obligations",
    title: "Statutory Obligations",
    subtitle: "Explain how RBI & SEBI mandates work",
    icon: Box,
    prompt: "What are the mandatory obligations under RBI Cyber Resilience Direction?",
  },
  {
    id: "incident-rules",
    title: "Incident Disclosure Rules",
    subtitle: "Add or update 6-hour reporting workflows",
    icon: SlidersHorizontal,
    prompt: "What are the CERT-In and RBI mandatory cybersecurity incident disclosure timelines?",
  },
];

function ShieldMoonLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center select-none py-2", className)}>
      <img
        src="/icon.svg"
        alt="ComplianceOS"
        className="h-12 w-12 object-contain"
      />
    </div>
  );
}

export function AskAIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);

  const location = useLocation();

  const toggle = () => setIsOpen((prev) => !prev);

  // Cycle thinking steps
  useEffect(() => {
    if (!isThinking) return;
    const interval = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % AGENT_THINKING_STEPS.length);
    }, 600);
    return () => clearInterval(interval);
  }, [isThinking]);

  const handleSend = (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isThinking) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);
    setThinkingStep(0);

    // Simulate agentic compliance reasoning
    setTimeout(() => {
      const result = generateComplianceAiResponse(query, location.pathname);

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        title: result.title,
        content: result.response,
        citations: result.citations,
        relatedAction: result.relatedAction,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);
    }, 900);
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
    toast.info("Started new conversation");
  };

  return (
    <AskAIContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggle,
        messages,
        input,
        setInput,
        isThinking,
        thinkingStep,
        handleSend,
        handleReset,
      }}
    >
      {children}
    </AskAIContext.Provider>
  );
}

/**
 * The cleanly styled side-by-side right panel with /icon.svg logo and minimal input controls
 */
export function AskAIPanel() {
  const {
    isOpen,
    setIsOpen,
    messages,
    input,
    setInput,
    isThinking,
    thinkingStep,
    handleSend,
    handleReset,
  } = useAskAI();

  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning.";
    if (hour < 17) return "Good afternoon.";
    return "Good evening.";
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages, isThinking]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleActionClick = (href: string) => {
    navigate(href);
  };

  const panelWidth = isExpanded ? 640 : 440;

  return (
    <aside
      aria-hidden={!isOpen}
      style={{
        width: isOpen ? `${panelWidth}px` : 0,
        minWidth: isOpen ? `${panelWidth}px` : 0,
      }}
      className={cn(
        "relative flex flex-col shrink-0 h-full overflow-hidden transition-[width,min-width,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] z-20",
        isOpen ? "border-l border-border/40" : "border-l border-transparent"
      )}
    >
      <div
        style={{ width: `${panelWidth}px` }}
        className={cn(
          "absolute top-0 right-0 bottom-0 flex flex-col h-full bg-background transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
          isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        )}
      >
            {/* 1. Header with subtle divider */}
            <div className="h-12 border-b border-border/40 px-4 flex items-center justify-between shrink-0 bg-background">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer focus:outline-none">
                    <span>New conversation</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 rounded-xl">
                  <DropdownMenuItem onClick={handleReset}>
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    New conversation
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSend("Why is export blocked and how do I resolve critical gaps?")}>
                    <FileText className="h-3.5 w-3.5 mr-2" />
                    Audit Export Block Review
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSend("What are the mandatory obligations under RBI Cyber Resilience Direction?")}>
                    <FileText className="h-3.5 w-3.5 mr-2" />
                    RBI Cyber Resilience Obligations
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handleReset}
                  title="New conversation"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  title={isExpanded ? "Collapse to standard width" : "Expand panel"}
                >
                  {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                  title="Close panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 2. Main Content Area */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-background">
              {messages.length === 0 ? (
                /* Empty / Hero State with /icon.svg Logo (No background color) */
                <div className="p-5 flex flex-col items-center justify-center min-h-full space-y-5">
                  {/* Shield Moon Logo from /icon.svg directly */}
                  <ShieldMoonLogo />

                  {/* Greeting */}
                  <div className="text-center space-y-1">
                    <h3 className="text-base font-semibold text-foreground tracking-tight">
                      {getGreeting()}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      What are we doing today?
                    </p>
                  </div>

                  {/* 5 Clean Action Buttons (Border-free, subtle pill surfaces) */}
                  <div className="w-full max-w-[380px] space-y-1.5 pt-1">
                    {HERO_ACTION_ITEMS.map((item) => {
                      const IconComp = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSend(item.prompt)}
                          className="w-full flex items-center gap-3.5 p-2.5 px-3 rounded-xl bg-muted/40 hover:bg-muted/80 transition-colors text-left group cursor-pointer active:scale-[0.99]"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-foreground tracking-tight line-clamp-1">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-muted-foreground line-clamp-1">
                              {item.subtitle}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Conversation Message Stream */
                <div className="p-4 space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col gap-1.5 max-w-[94%]",
                        msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start w-full"
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                        {msg.role === "assistant" ? (
                          <>
                            <Bot className="h-3 w-3 text-primary" />
                            <span className="font-semibold text-foreground">{msg.title || "Compliance AI"}</span>
                          </>
                        ) : (
                          <>
                            <User className="h-3 w-3" />
                            <span>You</span>
                          </>
                        )}
                        <span className="text-muted-foreground/60">• {msg.timestamp}</span>
                      </div>

                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed transition-all",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-xs"
                            : "bg-muted/40 text-foreground rounded-tl-xs w-full"
                        )}
                      >
                        {msg.role === "user" ? (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        ) : (
                          <div className="prose prose-xs dark:prose-invert max-w-none text-xs leading-relaxed break-words">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ children }) => <h1 className="text-sm font-bold text-foreground mt-2 mb-1">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-xs font-bold text-foreground mt-2 mb-1">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-xs font-semibold text-foreground mt-1.5 mb-1">{children}</h3>,
                                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                code: ({ className, children, ...props }) => {
                                  const isInline = !className;
                                  return isInline ? (
                                    <code className="px-1 py-0.5 rounded bg-muted/80 font-mono text-[11px] text-foreground border border-border/40">
                                      {children}
                                    </code>
                                  ) : (
                                    <pre className="p-2.5 rounded-lg bg-background/80 overflow-x-auto my-2 font-mono text-[11px] border border-border/50">
                                      <code {...props}>{children}</code>
                                    </pre>
                                  );
                                },
                                table: ({ children }) => (
                                  <div className="my-2.5 w-full overflow-x-auto rounded-lg border border-border/50 shadow-2xs">
                                    <table className="w-full text-[11px] border-collapse text-left">{children}</table>
                                  </div>
                                ),
                                thead: ({ children }) => <thead className="bg-muted/60 border-b border-border/50 text-foreground font-semibold">{children}</thead>,
                                tbody: ({ children }) => <tbody className="divide-y divide-border/30">{children}</tbody>,
                                tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
                                th: ({ children }) => <th className="p-1.5 px-2 font-semibold text-foreground">{children}</th>,
                                td: ({ children }) => <td className="p-1.5 px-2">{children}</td>,
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-2 border-primary/60 pl-2.5 my-2 italic text-muted-foreground">
                                    {children}
                                  </blockquote>
                                ),
                                a: ({ href, children }) => (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline hover:text-primary/80 transition-colors"
                                  >
                                    {children}
                                  </a>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}

                        {/* Citations badge list */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-border/30 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-medium mr-1">Citations:</span>
                            {msg.citations.map((cite, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-4 bg-background/80 text-muted-foreground border-none font-mono"
                              >
                                <FileText className="h-2.5 w-2.5 mr-1 text-primary" />
                                {cite}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Related deep link action */}
                        {msg.relatedAction && (
                          <div className="mt-2.5 pt-2 border-t border-border/30">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] px-2 bg-background hover:bg-muted font-medium border-border/60 text-primary gap-1"
                              onClick={() => handleActionClick(msg.relatedAction!.href)}
                            >
                              <span>{msg.relatedAction.label}</span>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1 px-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                            onClick={() => handleCopy(msg.id, msg.content)}
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="h-2.5 w-2.5 text-emerald-500" />
                                <span className="text-emerald-500">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-2.5 w-2.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Thinking state */}
                  {isThinking && (
                    <div className="mr-auto items-start max-w-[90%] space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                        <Bot className="h-3 w-3 text-primary" />
                        <span className="font-semibold text-foreground">Compliance AI</span>
                        <span className="text-muted-foreground/60">• Thinking…</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-xs px-3.5 py-2.5 bg-muted/40 text-xs flex items-center gap-2.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        <span className="text-muted-foreground font-mono text-[11px]">
                          {AGENT_THINKING_STEPS[thinkingStep]}
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* 3. Bottom Input Box (Clean container without ask/settings icons) */}
            <div className="p-3.5 pt-2 bg-background shrink-0">
              <div className="relative rounded-2xl bg-muted/40 focus-within:bg-muted/60 focus-within:ring-1 focus-within:ring-primary/20 transition-all p-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type @ to tag a resource or ? for shortcuts"
                  rows={2}
                  disabled={isThinking}
                  className="w-full resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                />
                <div className="flex items-center justify-end mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isThinking}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:hover:bg-primary transition-colors cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
      </div>
    </aside>
  );
}
