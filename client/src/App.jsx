import { Alert, Stack } from '@mui/material';
import { useEffect, useState } from 'react';
import AliasEntry from './components/AliasEntry.jsx';
import AvatarCustomizer from './components/AvatarCustomizer.jsx';
import MapViewport from './components/MapViewport.jsx';
import { MapProvider } from './context/MapContext.jsx';
import { WorldProvider, useWorld } from './context/WorldContext.jsx';

function AppContent() {
  const { connectionStatus, connectionError, profile, updateLocalPlayerState } = useWorld();
  const [appearance, setAppearance] = useState({
    hair: 'Corto',
    face: 'Clásica',
    outfit: 'Aventurero',
    shoes: 'Botas'
  });

  useEffect(() => {
    updateLocalPlayerState({ metadata: { appearance } });
  }, [appearance, updateLocalPlayerState]);

  const showConnectionError = connectionStatus === 'error' && connectionError;
  const showTermination = connectionStatus === 'terminated';
  const showDisconnected = connectionStatus === 'disconnected' && profile;

  return (
    <div className="app-shell">
      <div className="game-stage">
        <MapViewport />
      </div>

      <aside className="ui-dock ui-dock--left">
        <div className="dock-card">
          <h1 className="app-title">CoMutiNy</h1>
          <p className="app-subtitle">
            Coopera, explora y mantén la mutinería en marcha dentro de la nave.
          </p>
        </div>

        <div className="dock-card dock-card--scroll">
          <div className="dock-section">
            <Stack spacing={3}>
              <div>
                <h2 className="dock-heading">
                  {profile?.alias ? `Tripulante ${profile.alias}` : 'Únete a la tripulación'}
                </h2>
                <p className="dock-text">
                  {profile?.alias
                    ? 'Puedes actualizar tu alias en cualquier momento para que la tripulación pueda encontrarte.'
                    : 'Configura un alias visible para el resto de tripulantes antes de entrar en la nave.'}
                </p>
              </div>

              <AliasEntry />

              {showConnectionError ? (
                <Alert severity="error">
                  {connectionError?.message ?? 'No se pudo conectar con el servidor.'}
                </Alert>
              ) : null}

              {showTermination ? (
                <Alert severity="warning">
                  La sesión fue terminada por el servidor. Selecciona un alias para volver a unirte.
                </Alert>
              ) : null}

              {showDisconnected ? (
                <Alert severity="info">
                  Se perdió la conexión. Intentaremos reconectar automáticamente en cuanto sea posible.
                </Alert>
              ) : null}
            </Stack>
          </div>
        </div>

        <div className="dock-card dock-card--scroll">
          <AvatarCustomizer appearance={appearance} onChange={setAppearance} />
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <WorldProvider>
      <MapProvider>
        <AppContent />
      </MapProvider>
    </WorldProvider>
  );
}
