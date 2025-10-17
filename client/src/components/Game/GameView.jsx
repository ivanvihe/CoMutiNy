import { useCallback, useState } from 'react';
import MapViewport from '../MapViewport.jsx';
import ChatPanel from '../Chat/ChatPanel.jsx';
import SettingsModal from '../SettingsModal.tsx';
import Toolbar from '../../layout/Toolbar.tsx';
import '../../styles/game.css';

export default function GameView() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  return (
    <div className="game-view">
      <div className="game-view__map">
        <MapViewport />
        <Toolbar onOpenSettings={handleOpenSettings} />
      </div>
      <aside className="game-view__chat">
        <ChatPanel />
      </aside>
      <SettingsModal open={settingsOpen} onClose={handleCloseSettings} />
    </div>
  );
}
