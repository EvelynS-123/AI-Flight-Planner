"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COPY, airportCity, type Locale } from "./i18n";
import type { FlightResult } from "./flight-results";
import { groupFlightResults } from "./flights/group-results";

type SearchParams = Record<string, unknown> & {
  explorationHubOptions?: unknown;
  explorationHubs?: unknown;
  explorationHubReasons?: unknown;
};

type ExplorationHubOption = {
  code: string;
  city: string;
  reason: string;
};

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
  onSearchComplete: (flights: FlightResult[], searchParams: SearchParams) => void;
  onSearchFailure: () => void;
};

function hubSelectorCopy(locale: Locale) {
  if (locale === "zh") return {
    title: "限定中转城市",
    hint: "仅探索你选择的城市，最多 3 个",
    selected: (count: number) => `已选 ${count}/3`,
    searches: (count: number) => `预计 ${1 + count * 2} 次实时搜索`,
  };
  if (locale === "ja") return {
    title: "乗り継ぎ都市を選択",
    hint: "選択した都市のみ探索、最大3都市",
    selected: (count: number) => `${count}/3 選択済み`,
    searches: (count: number) => `リアルタイム検索は約${1 + count * 2}回`,
  };
  if (locale === "ko") return {
    title: "경유 도시 선택",
    hint: "선택한 도시만 탐색하며 최대 3개까지 가능합니다",
    selected: (count: number) => `${count}/3 선택됨`,
    searches: (count: number) => `실시간 검색 약 ${1 + count * 2}회`,
  };
  return {
    title: "Choose stopover cities",
    hint: "Only selected cities are explored, up to 3",
    selected: (count: number) => `${count}/3 selected`,
    searches: (count: number) => `About ${1 + count * 2} live searches`,
  };
}

function normalizeHubOptions(params: SearchParams): ExplorationHubOption[] {
  const options = Array.isArray(params.explorationHubOptions)
    ? params.explorationHubOptions
    : [];
  const reasons = params.explorationHubReasons && typeof params.explorationHubReasons === "object"
    ? params.explorationHubReasons as Record<string, unknown>
    : {};
  const legacyCodes = Array.isArray(params.explorationHubs)
    ? params.explorationHubs
    : [];
  const candidates = options.length
    ? options
    : legacyCodes.map((code) => ({ code, city: code, reason: reasons[String(code)] }));
  const seen = new Set<string>();

  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const value = candidate as Record<string, unknown>;
    const code = typeof value.code === "string"
      ? value.code.trim().toUpperCase()
      : "";
    if (!/^[A-Z]{3}$/.test(code) || seen.has(code)) return [];
    seen.add(code);
    return [{
      code,
      city: typeof value.city === "string" && value.city.trim()
        ? value.city.trim()
        : code,
      reason: typeof value.reason === "string"
        ? value.reason.trim()
        : typeof reasons[code] === "string"
          ? String(reasons[code]).trim()
          : "",
    }];
  }).slice(0, 12);
}

function verifiedHubOptions(
  params: SearchParams,
  flights: FlightResult[],
  locale: Locale,
): ExplorationHubOption[] {
  const suggested = normalizeHubOptions(params);
  const suggestionByCode = new Map(suggested.map((option) => [option.code, option]));
  const seen = new Set<string>();
  const verifiedCopy = locale === "zh"
    ? "实时联程航线已验证"
    : locale === "ja"
      ? "リアルタイムの乗り継ぎ便を確認済み"
      : locale === "ko"
        ? "실시간 연결편 확인됨"
        : "Verified in live connecting itineraries";
  const options: ExplorationHubOption[] = [];

  for (const flight of flights) {
    if (flight.isSelfTransfer) continue;
    for (const codeValue of flight.stopAirports || []) {
      const code = String(codeValue).trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code) || seen.has(code)) continue;
      seen.add(code);
      const creative = suggestionByCode.get(code);
      options.push({
        code,
        city: creative?.city || airportCity(code, locale, flight.airportNames?.[code]),
        reason: creative?.reason || verifiedCopy,
      });
    }
  }

  return options
    .sort((left, right) => {
      const leftSuggested = suggestionByCode.has(left.code) ? 1 : 0;
      const rightSuggested = suggestionByCode.has(right.code) ? 1 : 0;
      return rightSuggested - leftSuggested;
    })
    .slice(0, 12);
}

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
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  const [hubOptions, setHubOptions] = useState<ExplorationHubOption[]>([]);
  const [selectedHubs, setSelectedHubs] = useState<string[]>([]);
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
        const hasRequiredMultiLegRoute =
          Array.isArray(data.params.legs) && data.params.legs.length > 1;
        if (hasRequiredMultiLegRoute) {
          setHubOptions([]);
        } else {
          const discovery = await searchFlights({
            ...data.params,
            explorationHubs: [],
          });
          setHubOptions(
            discovery.flights
              ? verifiedHubOptions(data.params, discovery.flights, locale)
              : [],
          );
        }
        setSelectedHubs([]);
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
      const submittedParams = {
        ...searchParams,
        explorationHubs: selectedHubs,
      };
      const result = await searchFlights(submittedParams);
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
      onSearchComplete(flights, submittedParams);
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

  function toggleHub(code: string) {
    setSelectedHubs((current) => {
      if (current.includes(code)) return current.filter((item) => item !== code);
      if (current.length >= 3) return current;
      return [...current, code];
    });
  }

  const hubCopy = hubSelectorCopy(locale);

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
          {hubOptions.length > 0 && (
            <div className="chat-hub-selector">
              <div className="chat-hub-selector-heading">
                <div>
                  <strong>{hubCopy.title}</strong>
                  <span>{hubCopy.hint}</span>
                </div>
                <div>
                  <strong>{hubCopy.selected(selectedHubs.length)}</strong>
                  <span>{hubCopy.searches(selectedHubs.length)}</span>
                </div>
              </div>
              <div className="chat-hub-options" role="group" aria-label={hubCopy.title}>
                {hubOptions.map((option) => {
                  const selected = selectedHubs.includes(option.code);
                  const disabled = !selected && selectedHubs.length >= 3;
                  return (
                    <button
                      key={option.code}
                      className={`chat-hub-option${selected ? " selected" : ""}`}
                      type="button"
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => toggleHub(option.code)}
                    >
                      <span>
                        <strong>{option.city}</strong>
                        <i>{option.code}</i>
                      </span>
                      {option.reason && <small>{option.reason}</small>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
