import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import JoinForm from './components/Home/JoinForm.jsx';
import GameView from './components/Game/GameView.jsx';
import { MapProvider } from './context/MapContext.jsx';
import { WorldProvider, useWorld } from './context/WorldContext.jsx';

function AppRoutes() {
  const { profile } = useWorld();
  const canAccessWorld = Boolean(profile?.alias);

  return (
    <Routes>
      <Route path="/" element={<JoinForm />} />
      <Route
        path="/world"
        element={canAccessWorld ? <GameView /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <WorldProvider>
      <MapProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </MapProvider>
    </WorldProvider>
  );
}
