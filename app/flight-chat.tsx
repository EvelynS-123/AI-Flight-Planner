"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COPY, type Locale } from "./i18n";
import type { FlightResult } from "./flight-results";
import { groupFlightResults } from "./flights/group-results";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  searching?: boolean;
  systemMsgKey?: keyof typeof COPY["en"];
};

type Phase = "chat" | "ready" | "searching";

type FlightChatProps = {
  locale: Locale;
  preferenceContext?: unknown;
  isOpen: boolean;
  onClose: () => void;
  onSearchStart: () => void;
  onSearchComplete: (flights: FlightResult[]) => void;
  onSearchFailure: () => void;
};

export function FlightChat({
  locale,
  preferenceContext,
  isOpen,
  onClose,
  onSearchStart,
  onSearchComplete,
  onSearchFailure,
}: FlightChatProps) {
  const copy = COPY[locale];
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "", systemMsgKey: "chatGreeting" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("chat");
  const [searchParams, setSearchParams] = useState<unknown>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isOpen || phase !== "chat") return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, phase]);

  async function searchFlights(params: unknown) {
    try {
      const response = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { error: error.error || "search_failed" };
      }
      const data = await response.json();
      return { flights: (data.results || []) as FlightResult[] };
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
      const apiMessages = newMessages
        .filter((message) => !message.searching && message.content)
        .map((message) => ({ role: message.role, content: message.content }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, locale, preferenceContext }),
      });

      if (!response.ok) {
        setMessages((current) => [
          ...current,
          { role: "assistant", content: "", systemMsgKey: "chatError" },
        ]);
        return;
      }

      const data = await response.json();
      setMessages((current) => [
        ...current,
        data.reply
          ? { role: "assistant", content: data.reply }
          : { role: "assistant", content: "", systemMsgKey: "chatError" },
      ]);

      if (data.searchReady && data.params) {
        setSearchParams(data.params);
        setPhase("ready");
      }
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "", systemMsgKey: "chatError" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchConfirm() {
    if (!searchParams || loading) return;

    setLoading(true);
    setPhase("searching");
    setMessages((current) => [
      ...current,
      { role: "assistant", content: "", systemMsgKey: "chatSearching", searching: true },
    ]);
    onSearchStart();

    try {
      const result = await searchFlights(searchParams);
      const withoutSearching = (current: ChatMessage[]) => current.filter((message) => !message.searching);

      if (result.error) {
        setMessages((current) => [
          ...withoutSearching(current),
          { role: "assistant", content: "", systemMsgKey: "chatError" },
        ]);
        setPhase("ready");
        onSearchFailure();
        return;
      }

      const flights = result.flights || [];
      if (flights.length === 0) {
        setMessages((current) => [
          ...withoutSearching(current),
          { role: "assistant", content: "", systemMsgKey: "chatNoResults" },
        ]);
        setPhase("ready");
        onSearchFailure();
        return;
      }

      setMessages((current) => [
        ...withoutSearching(current),
        {
          role: "assistant",
          content: copy.chatResultsTitle(groupFlightResults(flights).length),
        },
      ]);
      setPhase("chat");
      onSearchComplete(flights);
    } catch {
      setMessages((current) => [
        ...current.filter((message) => !message.searching),
        { role: "assistant", content: "", systemMsgKey: "chatError" },
      ]);
      setPhase("ready");
      onSearchFailure();
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <section className="flight-chat" aria-label="Flight search chat">
      <div className="flight-chat-header">
        <div className="flight-chat-header-main">
          <div className="flight-chat-icon" aria-hidden="true">✈</div>
          <div>
            <strong>Via Flight Assistant</strong>
            <span>{copy.chatAssistantHint}</span>
          </div>
        </div>
        <button className="flight-chat-close" type="button" onClick={onClose} aria-label={copy.chatClose}>×</button>
      </div>

      <div className="flight-chat-messages" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.role}`}>
            {message.searching ? (
              <div className="chat-searching">
                <div className="chat-searching-dots" aria-hidden="true">
                  <span /><span /><span />
                </div>
                <span>{copy.chatSearching}</span>
              </div>
            ) : message.systemMsgKey ? (
              <div className="chat-bubble">{copy[message.systemMsgKey]}</div>
            ) : message.content ? (
              <div className="chat-bubble">{message.content}</div>
            ) : null}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {phase === "ready" ? (
        <div className="chat-search-action">
          <button className="search-button" type="button" onClick={handleSearchConfirm} disabled={loading}>
            <span>{copy.search}</span>
            <i aria-hidden="true">→</i>
          </button>
        </div>
      ) : phase === "searching" ? (
        <div className="chat-search-status" role="status">
          <span className="chat-send-loading" aria-hidden="true" />
          {copy.chatSearching}
        </div>
      ) : (
        <div className="flight-chat-input-area">
          <input
            ref={inputRef}
            type="text"
            className="flight-chat-input"
            placeholder={copy.chatPlaceholder}
            value={input}
            onChange={(event) => setInput(event.target.value)}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
