import EngineCanvas from "@engine/EngineCanvas";
import ChatPanel from "@ui/ChatPanel";
import HUD from "@ui/HUD";
import LoginOverlay from "@ui/LoginOverlay";
import { useClientState } from "@multiplayer/state";

const App = () => {
  const { session } = useClientState();

  return (
    <div className="app-shell">
      <EngineCanvas />
      <HUD />
      <ChatPanel />
      {!session && <LoginOverlay />}
    </div>
  );
};

export default App;
