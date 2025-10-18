import { FormEvent, useState } from "react";
import { multiplayerClient } from "@multiplayer/client";
import { useClientState } from "@multiplayer/state";

const ChatPanel = () => {
  const [message, setMessage] = useState("");
  const { session } = useClientState();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }
    multiplayerClient.getRoom()?.send("chat", { text: message });
    setMessage("");
  };

  return (
    <div className="chat-panel" aria-live="polite">
      <div className="chat-messages">
        <p>Conecta y empieza a conversar con tu comunidad.</p>
        <p>
          Presiona <strong>Enter</strong> para enfocar el chat y comparte ideas,
          eventos o coordina construcciones.
        </p>
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={session ? "Escribe un mensaje" : "Inicia sesión para chatear"}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!session}
        />
        <button type="submit" disabled={!session}>
          Enviar
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
