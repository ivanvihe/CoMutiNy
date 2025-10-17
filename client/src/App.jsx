import { Box, Container, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import AuthForm from './components/AuthForm.jsx';
import AvatarCustomizer from './components/AvatarCustomizer.jsx';

const formTabs = [
  { value: 'login', label: 'Iniciar sesión' },
  { value: 'register', label: 'Crear cuenta' }
];

export default function App() {
  const [formMode, setFormMode] = useState('login');
  const [appearance, setAppearance] = useState({
    hair: 'Corto',
    face: 'Clásica',
    outfit: 'Aventurero',
    shoes: 'Botas'
  });

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
              <AuthForm mode={formMode} />
            </Box>

            <Box flex={1}>
              <AvatarCustomizer appearance={appearance} onChange={setAppearance} />
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
}
