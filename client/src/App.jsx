import { Alert, Box, CircularProgress, Container, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import AuthForm from './components/AuthForm.jsx';
import AvatarCustomizer from './components/AvatarCustomizer.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import MapViewport from './components/MapViewport.jsx';
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

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          p: { xs: 3, md: 5 },
          borderRadius: 4,
          backdropFilter: 'blur(12px)',
          background: 'rgba(18, 18, 18, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)'
        }}
      >
        <Stack spacing={4}>
          <Box>
            <Typography variant="h3" fontWeight={700} gutterBottom>
              Bienvenido a CoMutiNy
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Personaliza tu tripulante y prepárate para embarcarte en la mutinería más
              cooperativa de la galaxia.
            </Typography>
          </Box>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 4, md: 6 }}
            alignItems="stretch"
          >
            <Box flex={1}>
              {loading ? (
                <Stack justifyContent="center" alignItems="center" sx={{ height: '100%' }}>
                  <CircularProgress />
                </Stack>
              ) : user ? (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                      ¡Hola, {user.username}!
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Tu rol actual es <strong>{user.role}</strong>.
                    </Typography>
                  </Box>
                  {error && (
                    <Alert severity="warning">
                      No se pudo refrescar la sesión automáticamente. Continúa navegando o vuelve a iniciar sesión si es
                      necesario.
                    </Alert>
                  )}
                </Stack>
              ) : (
                <Box>
                  <Tabs
                    value={formMode}
                    onChange={(_, newValue) => setFormMode(newValue)}
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{ mb: 2 }}
                  >
                    {formTabs.map((tab) => (
                      <Tab key={tab.value} value={tab.value} label={tab.label} />
                    ))}
                  </Tabs>
                  {error && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Inicia sesión para continuar.{sessionErrorMessage ? ` (${sessionErrorMessage})` : ''}
                    </Alert>
                  )}
                  <AuthForm mode={formMode} />
                </Box>
              )}
            </Box>

            <Box flex={1}>
              <Stack spacing={3}>
                <AvatarCustomizer appearance={appearance} onChange={setAppearance} />
                <WorldProvider>
                  <MapProvider>
                    <MapViewport />
                  </MapProvider>
                </WorldProvider>
              </Stack>
            </Box>
          </Stack>

          {user?.role === 'admin' && (
            <AdminDashboard />
          )}
        </Stack>
      </Box>
    </Container>
  );
}
