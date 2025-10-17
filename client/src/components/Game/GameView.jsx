import MapViewport from '../MapViewport.jsx';
import ChatPanel from '../Chat/ChatPanel.jsx';
import '../../styles/game.css';

export default function GameView() {
  return (
    <div className="game-view">
      <div className="game-view__map">
        <MapViewport />
      </div>
      <aside className="game-view__chat">
        <ChatPanel />
      </aside>
    </div>
  );
}
