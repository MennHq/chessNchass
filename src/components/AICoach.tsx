import { Bot, Send, User, Sparkles } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { ProfileData, StatsData } from "../types";

interface AICoachProps {
  profile: ProfileData | null;
  stats: StatsData | null;
}

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
}

const QUICK_PROMPTS = [
  "How to stop tilting after losses?",
  "Opening recommendation for my style",
  "Analyze my win/loss ratio",
  "How can I reach the next rating tier?"
];

export default function AICoach({ profile, stats }: AICoachProps) {
  const username = profile?.username || "Player";
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "ai",
      content: `Arrey ${username}! Tera dashboard live hai. Bata kya chal raha hai — openings improve karni hai, tilt rokna hai, ya match analyze karwana hai?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Update greeting when user profile switches
  useEffect(() => {
    if (profile?.username) {
      setMessages([
        {
          id: `init-${profile.username}`,
          role: "ai",
          content: `Arrey ${profile.username}! Board aur ratings ready hain. Bata coaching chahiye, opening advice, ya seedha game review?`,
        },
      ]);
    }
  }, [profile?.username]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !profile || loading) return;

    const userMessage = textToSend.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: userMessage },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/coach/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, stats, intent: userMessage }),
      });

      if (!res.ok) throw new Error("Network error");
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "ai", content: data.analysis },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: "Connection thoda slow ho gaya boss. Lekin advice simple hai: blunder kam kar aur time pe dhyan de!",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex h-full w-full flex-col rounded-[24px] border border-white/10 bg-white/[0.02] backdrop-blur-xl flex-1 min-h-[460px]">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/10 bg-white/5 shadow-sm">
            <Bot className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-sans font-medium text-white tracking-wide">AI Tactical Coach</h3>
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mt-0.5">
              Personalized Hinglish Mentor &bull; {username}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Ready
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar max-h-[340px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 ${
              m.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${
                m.role === "user"
                  ? "bg-white text-black shadow-sm"
                  : "bg-white/5 text-neutral-300 border border-white/10"
              }`}
            >
              {m.role === "user" ? <User size={15} strokeWidth={2} /> : <Bot size={15} />}
            </div>
            <div
              className={`max-w-[85%] rounded-[18px] p-3.5 text-xs sm:text-[13px] leading-relaxed tracking-wide font-sans ${
                m.role === "user"
                  ? "bg-white text-black rounded-tr-[4px] font-medium"
                  : "bg-white/5 text-neutral-300 border border-white/5 rounded-tl-[4px] max-w-none prose-strong:text-white"
              }`}
            >
              {m.role === "ai" ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: m.content
                      .replace(/\n\n/g, "<br/><br/>")
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\*(.*?)\*/g, "<em>$1</em>"),
                  }}
                />
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 flex-row">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-neutral-400 border border-white/10">
              <Bot size={15} />
            </div>
            <div className="flex items-center rounded-[18px] rounded-tl-[4px] bg-white/[0.02] border border-white/5 p-4">
              <div className="flex gap-1.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="px-5 pt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => sendMessage(prompt)}
            disabled={loading}
            className="shrink-0 text-[10px] font-sans text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-full border border-white/5 transition-all disabled:opacity-40"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="border-t border-white/10 p-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 rounded-full bg-white/[0.02] p-1 border border-white/10 focus-within:border-white/30 transition-colors"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask coach about ${username}'s openings, tactics, tilt...`}
            className="flex-1 bg-transparent px-4 py-2 text-xs sm:text-[13px] font-sans tracking-wide text-white outline-none placeholder:text-neutral-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-neutral-200 disabled:opacity-50 disabled:hover:bg-white shrink-0 shadow-sm"
          >
            <Send className="h-3.5 w-3.5 ml-0.5" strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>
  );
}
