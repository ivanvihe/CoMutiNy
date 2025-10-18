import { FormEvent, useState } from "react";
import { multiplayerClient } from "@multiplayer/client";

const LoginOverlay = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await multiplayerClient.connect(username || "visitante", password);
    } catch (err) {
      console.error(err);
      setError("No fue posible conectar. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div>
          <h1>Bienvenido a CoMutiNy</h1>
          <p className="hint">
            Ingresa para unirte al mundo persistente, construir y charlar con la comunidad.
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nombre de usuario"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Conectando..." : "Entrar"}
          </button>
        </form>
        {error && <p className="hint">{error}</p>}
      </div>
    </div>
  );
};

export default LoginOverlay;
