import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorld } from '../../context/WorldContext.jsx';
import '../../styles/game.css';

export default function ChatPanel() {
  const { chatMessages, sendChatMessage, joinStatus, profile } = useWorld();
  const [message, setMessage] = useState('');
  const listRef = useRef(null);
  const canSend = useMemo(() => joinStatus === 'ready', [joinStatus]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [chatMessages]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    try {
      await sendChatMessage(trimmed);
      setMessage('');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-panel__header">
        <div className="chat-panel__title">Chat de tripulación</div>
        {profile?.alias ? (
          <div className="chat-panel__subtitle">Conectado como {profile.alias}</div>
        ) : null}
      </div>

      <div className="chat-panel__messages" ref={listRef}>
        {chatMessages.length === 0 ? (
          <div className="chat-panel__empty">Aún no hay mensajes. ¡Saluda a la tripulación!</div>
        ) : (
          chatMessages.map((entry) => (
            <div key={entry.id} className="chat-panel__message">
              <span className="chat-panel__author">{entry.author}:</span>
              <span className="chat-panel__content">{entry.content}</span>
            </div>
          ))
        )}
      </div>

      <form className="chat-panel__form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={canSend ? 'Escribe un mensaje…' : 'Conéctate para chatear'}
          disabled={!canSend}
        />
        <button type="submit" disabled={!canSend || !message.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
