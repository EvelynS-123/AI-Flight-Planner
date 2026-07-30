"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { LOCALE_OPTIONS, type Locale } from "./i18n";
import {
  defaultTravelPreferences,
  sanitizeTravelPreferences,
  type TravelPreferenceState,
} from "./travel-preferences";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type PreferenceChatProps = {
  locale: Locale;
  memory: TravelPreferenceState | null;
  onLocaleChange: (locale: Locale) => void;
  onClose: () => void;
  onSave: (memory: TravelPreferenceState) => void;
};

const CHAT_COPY: Record<Locale, {
  eyebrow: string;
  title: string;
  body: string;
  newGreeting: string;
  returningGreeting: (summary: string) => string;
  placeholder: string;
  send: string;
  sending: string;
  later: string;
  save: string;
  savedHint: string;
  error: string;
  close: string;
}> = {
  zh: {
    eyebrow: "旅行偏好助手",
    title: "聊聊你喜欢怎样旅行",
    body: "我会每次问一个问题，并把答案用于航线排序和中转建议。",
    newGreeting: "先不聊选项。你平时最喜欢做什么，或者旅行中什么体验最容易让你觉得这一趟很值得？",
    returningGreeting: (summary) => summary
      ? `我记得你的偏好是：${summary}。这次想修改或补充什么？`
      : "欢迎回来。这次想修改或补充什么旅行偏好？",
    placeholder: "输入你的想法",
    send: "发送",
    sending: "正在整理",
    later: "以后再说",
    save: "确认并保存",
    savedHint: "我已经整理出一份可保存的偏好总结，你也可以继续补充。",
    error: "刚才没有整理成功，请重试一次。",
    close: "关闭旅行偏好助手",
  },
  en: {
    eyebrow: "Travel preference assistant",
    title: "Tell me how you like to travel",
    body: "I will ask one question at a time and use your answers for route ranking and stopover advice.",
    newGreeting: "Let us start without a checklist. What do you enjoy doing in everyday life, or what kind of experience makes a trip feel worthwhile to you?",
    returningGreeting: (summary) => summary
      ? `I remember: ${summary}. What would you like to change or add?`
      : "Welcome back. What travel preference would you like to change or add?",
    placeholder: "Share your preference",
    send: "Send",
    sending: "Organizing",
    later: "Maybe later",
    save: "Confirm and save",
    savedHint: "I have a preference summary ready to save. You can also keep refining it.",
    error: "I could not organize that response. Please try once more.",
    close: "Close travel preference assistant",
  },
  ko: {
    eyebrow: "여행 선호 도우미",
    title: "좋아하는 여행 방식을 알려주세요",
    body: "한 번에 한 가지씩 묻고 답변을 항공편 순위와 경유지 추천에 반영합니다.",
    newGreeting: "항공편을 고를 때 무엇을 가장 중요하게 보시나요? 가격, 환승, 시간대, 항공사부터 말해도 좋아요.",
    returningGreeting: (summary) => summary
      ? `기억하고 있는 선호는 다음과 같습니다. ${summary} 무엇을 바꾸거나 추가할까요?`
      : "다시 오셨네요. 바꾸거나 추가하고 싶은 여행 선호가 있나요?",
    placeholder: "선호를 입력하세요",
    send: "보내기",
    sending: "정리 중",
    later: "나중에",
    save: "확인하고 저장",
    savedHint: "저장할 수 있는 선호 요약을 만들었습니다. 계속 보완해도 됩니다.",
    error: "방금 답변을 정리하지 못했습니다. 다시 시도해 주세요.",
    close: "여행 선호 도우미 닫기",
  },
  ja: {
    eyebrow: "旅行の好みアシスタント",
    title: "好きな旅のスタイルを教えてください",
    body: "一度に一つずつ質問し、回答をルート順位と乗り継ぎ提案に反映します。",
    newGreeting: "フライトを選ぶとき、何を一番大切にしますか。価格、乗り継ぎ、時間帯、航空会社から話しても構いません。",
    returningGreeting: (summary) => summary
      ? `覚えている希望は「${summary}」です。何を変更または追加しますか。`
      : "おかえりなさい。変更または追加したい旅行の好みはありますか。",
    placeholder: "希望を入力",
    send: "送信",
    sending: "整理中",
    later: "あとで",
    save: "確認して保存",
    savedHint: "保存できる希望のまとめができました。さらに追加することもできます。",
    error: "回答を整理できませんでした。もう一度お試しください。",
    close: "旅行の好みアシスタントを閉じる",
  },
};

export default function PreferenceChat({
  locale,
  memory,
  onLocaleChange,
  onClose,
  onSave,
}: PreferenceChatProps) {
  const copy = CHAT_COPY[locale];
  const [messages, setMessages] = useState<Message[]>([]);
  const [draftMemory, setDraftMemory] = useState<TravelPreferenceState>(
    memory ?? defaultTravelPreferences(),
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [readyToSave, setReadyToSave] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const nextMemory = memory ?? defaultTravelPreferences();
    setDraftMemory(nextMemory);
    setMessages([{
      role: "assistant",
      content: memory?.mode === "personalized"
        ? CHAT_COPY[locale].returningGreeting(memory.summary)
        : CHAT_COPY[locale].newGreeting,
    }]);
    setInput("");
    setLoading(false);
    setReadyToSave(false);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [memory]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = input.replace(/\s+/g, " ").trim();
    if (!content || loading) return;
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/preferences/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          messages: nextMessages,
          currentMemory: draftMemory,
        }),
      });
      if (!response.ok) throw new Error("preference_chat_failed");
      const data = await response.json() as {
        reply?: string;
        readyToSave?: boolean;
        memory?: unknown;
      };
      const nextMemory = sanitizeTravelPreferences(data.memory);
      if (!data.reply || !nextMemory) throw new Error("invalid_preference_response");
      setDraftMemory(nextMemory);
      setReadyToSave(data.readyToSave === true);
      setMessages((current) => [...current, { role: "assistant", content: data.reply! }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: copy.error }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled])",
    ) ?? [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="preference-overlay">
      <section
        className="preference-dialog preference-chat-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preference-title"
        ref={panelRef}
        onKeyDown={handleKeyDown}
      >
        <header className="preference-header">
          <div>
            <p>{copy.eyebrow}</p>
            <h2 id="preference-title">{copy.title}</h2>
            <span>{copy.body}</span>
          </div>
          <div className="preference-header-actions">
            <label className="language-picker quiz-language-picker">
              <span className="sr-only">{copy.title}</span>
              <select
                value={locale}
                onChange={(event) => onLocaleChange(event.target.value as Locale)}
                aria-label={copy.title}
              >
                {LOCALE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </label>
            <button className="quiz-close" type="button" onClick={onClose} aria-label={copy.close}>×</button>
          </div>
        </header>

        <div className="preference-chat-log" aria-live="polite">
          {messages.map((message, index) => (
            <div className={`preference-chat-message ${message.role}`} key={`${message.role}-${index}`}>
              <span>{message.role === "assistant" ? "Via" : locale === "zh" ? "你" : "You"}</span>
              <p>{message.content}</p>
            </div>
          ))}
          {loading && (
            <div className="preference-chat-message assistant loading">
              <span>Via</span>
              <p>{copy.sending}<i aria-hidden="true">•••</i></p>
            </div>
          )}
        </div>

        {readyToSave && <p className="preference-ready-hint">{copy.savedHint}</p>}

        <form className="preference-chat-compose" onSubmit={submit}>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={copy.placeholder}
            maxLength={800}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>{copy.send}</button>
        </form>

        <footer className="preference-footer preference-chat-footer">
          <button className="quiz-skip" type="button" onClick={onClose}>{copy.later}</button>
          <button
            className="quiz-primary"
            type="button"
            disabled={!readyToSave || loading}
            onClick={() => onSave(draftMemory)}
          >
            {copy.save}<span aria-hidden="true">✓</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
