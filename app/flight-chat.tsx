"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { COPY, type Locale } from "./i18n";
import { FlightResults, type FlightResult } from "./flight-results";
import { WeightPanel } from "./weight-panel";
import type { RouteWeights } from "./route-data";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  flights?: FlightResult[];
  searching?: boolean;
  systemMsgKey?: keyof typeof COPY["en"];
};

type SortKey = "price" | "duration" | "departure";

type Phase = "chat" | "weights" | "searching" | "results";

export function FlightChat({ locale, weights, onWeightsChange, onSearchComplete }: { locale: Locale, weights: RouteWeights, onWeightsChange: (w: RouteWeights) => void, onSearchComplete?: (flights: FlightResult[]) => void }) {
  const copy = COPY[locale];
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "", systemMsgKey: "chatGreeting" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [phase, setPhase] = useState<Phase>("chat");
  const [searchParams, setSearchParams] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function searchFlights(params: any) {
    try {
      const res = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { error: err.error || "search_failed" };
      }
      const data = await res.json();
      return { flights: data.results || [] };
    } catch {
      return { error: "network" };
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Send to chat API for AI processing
      const apiMessages = newMessages
        .filter((m) => !m.searching && !m.flights)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, locale }),
      });

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", systemMsgKey: "chatError" },
        ]);
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (data.searchReady && data.params) {
        // AI has enough info — transition to weights phase
        setSearchParams(data.params);
        setPhase("weights");
        setMessages((prev) => [
          ...prev,
          data.reply ? { role: "assistant", content: data.reply } : { role: "assistant", content: "", systemMsgKey: "chatSearching" },
        ]);
      } else {
        // Still gathering info — show AI reply
        setMessages((prev) => [
          ...prev,
          data.reply ? { role: "assistant", content: data.reply } : { role: "assistant", content: "", systemMsgKey: "chatSearching" },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", systemMsgKey: "chatError" },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleWeightsConfirm() {
    setPhase("searching");
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", systemMsgKey: "chatSearching", searching: true },
    ]);

    try {
      const analyzeRes = await fetch("/api/chat/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: searchParams, weights, locale }),
      });
      let finalParams = searchParams;
      if (analyzeRes.ok) {
        const analyzeData = await analyzeRes.json();
        if (analyzeData.params) finalParams = analyzeData.params;
      }

      const result = await searchFlights(finalParams);

      if (result.flights && onSearchComplete) {
        onSearchComplete(result.flights);
      }

      setPhase("results");
      setMessages((prev) => {
        const updated = prev.filter((m) => !m.searching);
        if (result.error) {
          return [...updated, { role: "assistant", content: "", systemMsgKey: "chatError" }];
        }
        if (!result.flights || result.flights.length === 0) {
          return [...updated, { role: "assistant", content: "", systemMsgKey: "chatNoResults" }];
        }
        return [
          ...updated,
          { role: "assistant", content: "", flights: result.flights },
        ];
      });
    } catch {
      setPhase("chat");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", systemMsgKey: "chatError" },
      ]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <section className="flight-chat" aria-label="Flight search chat">
      <div className="flight-chat-header">
        <div className="flight-chat-icon">✈</div>
        <span>Via Flight Assistant</span>
      </div>

      <div className="flight-chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            {msg.searching ? (
              <div className="chat-searching">
                <div className="chat-searching-dots">
                  <span /><span /><span />
                </div>
                <span>{copy.chatSearching}</span>
              </div>
            ) : msg.flights ? (
              <FlightResults
                flights={msg.flights}
                copy={copy}
                locale={locale}
                sortKey={sortKey}
                onSortChange={setSortKey}
              />
            ) : msg.systemMsgKey ? (
              <div className="chat-bubble">{copy[msg.systemMsgKey]}</div>
            ) : msg.content ? (
              <div className="chat-bubble">{msg.content}</div>
            ) : null}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {phase === "weights" ? (
        <WeightPanel
          weights={weights}
          onChange={onWeightsChange}
          copy={copy}
          onConfirm={handleWeightsConfirm}
        />
      ) : (
        <div className="flight-chat-input-area">
          <input
            ref={inputRef}
            type="text"
            className="flight-chat-input"
            placeholder={copy.chatPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoComplete="off"
          />
          <button
            className="flight-chat-send"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label={copy.chatSend}
          >
            {loading ? (
              <span className="chat-send-loading" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
