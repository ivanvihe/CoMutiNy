import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import GameView from './components/Game/GameView.jsx';
import MapEditor from './components/Admin/MapEditor.jsx';
import { MapProvider } from './context/MapContext.jsx';
import { WorldProvider, useWorld } from './context/WorldContext.jsx';

function AdminRoute({ children }) {
  const { profile } = useWorld();
  const isAdmin = profile?.alias && profile.alias.toLowerCase().includes('admin');

  if (!profile) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  const { profile } = useWorld();
  const canAccessWorld = Boolean(profile?.alias);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/world"
        element={canAccessWorld ? <GameView /> : <Navigate to="/" replace />}
      />
      <Route
        path="/admin/maps"
        element={
          <AdminRoute>
            <MapEditor />
          </AdminRoute>
        }
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
