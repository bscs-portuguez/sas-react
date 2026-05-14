import { useState, useCallback, useEffect } from "react";
import MessageList from "./MessageList";
import { matchIntent, quickReplies } from "./intents";
import "./Chatbot.css";

const initialMessage = () => ({
  role: "bot",
  text: "Hi! I'm the SAS Portal assistant. I can answer questions about your documents, the approval pipeline, and how to navigate the app. Try one of the suggestions below or type a question.",
  showQuickReplies: true,
});

function Chatbot({ user, userRole, orgType }) {
  const isAdmin = userRole === "Admin";
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => [initialMessage()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const ctx = { user, userRole, orgType, isAdmin };

  const respondTo = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
      setLoading(true);
      try {
        const reply = await matchIntent(trimmed, ctx);
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: reply.text,
            actions: reply.actions,
            showQuickReplies: reply.intentId === "fallback",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    // ctx is rebuilt each render — values inside are stable for a given session
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, userRole, orgType],
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    const text = input;
    setInput("");
    respondTo(text);
  };

  const handleAction = (action) => {
    window.dispatchEvent(new CustomEvent(action.event, { detail: action.detail }));
    setIsOpen(false);
  };

  const handleQuickReply = (text) => {
    respondTo(text);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          className="chatbot-fab"
          onClick={() => setIsOpen(true)}
          aria-label="Open SAS assistant"
          title="Need help? Ask me anything"
        >
          💬
        </button>
      )}
      {isOpen && (
        <div className="chatbot-panel" role="dialog" aria-label="SAS Portal assistant">
          <div className="chatbot-header">
            <div className="chatbot-header-title">
              <span>SAS Assistant</span>
              <span className="chatbot-header-subtitle">
                {isAdmin ? "Admin view" : "Student view"}
              </span>
            </div>
            <button
              type="button"
              className="chatbot-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
            >
              ×
            </button>
          </div>
          <MessageList
            messages={messages}
            loading={loading}
            onAction={handleAction}
            onQuickReply={handleQuickReply}
            quickReplies={quickReplies}
          />
          <form className="chatbot-input-row" onSubmit={handleSubmit}>
            <input
              type="text"
              className="chatbot-input"
              placeholder="Ask about your documents or the app…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default Chatbot;
