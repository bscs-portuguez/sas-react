import { useEffect, useRef } from "react";

function MessageList({ messages, loading, onAction, onQuickReply, quickReplies }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="chatbot-messages">
      {messages.map((msg, idx) => (
        <div key={idx} className={`chatbot-message chatbot-message--${msg.role}`}>
          <div className="chatbot-bubble">
            {msg.text.split("\n").map((line, i) => (
              <div key={i} className="chatbot-bubble-line">
                {line || " "}
              </div>
            ))}
          </div>
          {msg.actions && msg.actions.length > 0 && (
            <div className="chatbot-actions">
              {msg.actions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  className="chatbot-action-btn"
                  onClick={() => onAction(action)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {msg.showQuickReplies && quickReplies && quickReplies.length > 0 && (
            <div className="chatbot-quick-replies">
              {quickReplies.map((qr, i) => (
                <button
                  key={i}
                  type="button"
                  className="chatbot-quick-reply"
                  onClick={() => onQuickReply(qr)}
                >
                  {qr}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {loading && (
        <div className="chatbot-message chatbot-message--bot">
          <div className="chatbot-bubble chatbot-bubble--typing">
            <span className="chatbot-dot" />
            <span className="chatbot-dot" />
            <span className="chatbot-dot" />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

export default MessageList;
