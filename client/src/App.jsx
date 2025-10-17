import { Alert, CircularProgress, Tab, Tabs } from '@mui/material';
import { useState } from 'react';
import AuthForm from './components/AuthForm.jsx';
import AvatarCustomizer from './components/AvatarCustomizer.jsx';
import MapViewport from './components/MapViewport.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { MapProvider } from './context/MapContext.jsx';
import { WorldProvider } from './context/WorldContext.jsx';

const formTabs = [
  { value: 'login', label: 'Iniciar sesión' },
  { value: 'register', label: 'Crear cuenta' }
];

export default function App() {
  const { user, loading, error } = useAuth();
  const [formMode, setFormMode] = useState('login');
  const [appearance, setAppearance] = useState({
    hair: 'Corto',
    face: 'Clásica',
    outfit: 'Aventurero',
    shoes: 'Botas'
  });

  const sessionErrorMessage = error?.response?.data?.message ?? '';

  const handleChangeTab = (_, newValue) => setFormMode(newValue);

  return (
    <WorldProvider>
      <MapProvider>
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
              {loading ? (
                <div className="dock-loading">
                  <CircularProgress size={28} />
                </div>
              ) : user ? (
                <div className="dock-section">
                  <h2 className="dock-heading">Hola, {user.username}</h2>
                  <p className="dock-text">
                    Ya puedes colaborar con la tripulación y seguir explorando la nave.
                  </p>
                  {error && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      No se pudo refrescar la sesión automáticamente. Continúa navegando o vuelve a
                      iniciar sesión si es necesario.
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="dock-section">
                  <Tabs
                    value={formMode}
                    onChange={handleChangeTab}
                    textColor="primary"
                    indicatorColor="primary"
                    variant="fullWidth"
                  >
                    {formTabs.map((tab) => (
                      <Tab key={tab.value} value={tab.value} label={tab.label} />
                    ))}
                  </Tabs>
                  {error && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Inicia sesión para continuar.
                      {sessionErrorMessage ? ` (${sessionErrorMessage})` : ''}
                    </Alert>
                  )}
                  <AuthForm mode={formMode} />
                </div>
              )}
            </div>

            <div className="dock-card dock-card--scroll">
              <AvatarCustomizer appearance={appearance} onChange={setAppearance} />
            </div>
          </aside>
        </div>
      </MapProvider>
    </WorldProvider>
  );
}
