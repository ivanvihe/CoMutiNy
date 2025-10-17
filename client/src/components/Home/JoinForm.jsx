import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AvatarCustomizer from '../AvatarCustomizer.jsx';
import { useWorld } from '../../context/WorldContext.jsx';
import '../../styles/home.css';

const CONNECTION_LABELS = {
  idle: 'Sin conectar',
  connecting: 'Conectando…',
  connected: 'Conectado',
  disconnected: 'Desconectado',
  error: 'Con errores',
  terminated: 'Sesión terminada'
};

export default function JoinForm() {
  const navigate = useNavigate();
  const {
    profile,
    joinWorld,
    joinStatus,
    joinError,
    connectionStatus,
    appearance,
    setAppearance
  } = useWorld();
  const [alias, setAlias] = useState(profile?.alias ?? '');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (profile?.alias) {
      setAlias(profile.alias);
    }
  }, [profile]);

  const isPending = joinStatus === 'pending';
  const connectionLabel = useMemo(
    () => CONNECTION_LABELS[connectionStatus] ?? connectionStatus,
    [connectionStatus]
  );

  const combinedError = useMemo(() => {
    if (localError) {
      return localError;
    }
    if (!joinError) {
      return '';
    }
    return joinError.message ?? 'No se pudo crear la sesión.';
  }, [joinError, localError]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmed = alias.trim();
    if (!trimmed) {
      setLocalError('Introduce un alias para unirte.');
      return;
    }

    setLocalError('');

    try {
      await joinWorld(trimmed);
      navigate('/world');
    } catch (error) {
      setLocalError(error?.message ?? 'No se pudo crear la sesión.');
    }
  };

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-card__intro">
          <Typography component="h1" variant="h3" className="join-title">
            Bienvenido a CoMutiNy
          </Typography>
          <Typography variant="body1" className="join-subtitle">
            Prepara tu identidad y apariencia antes de abordar la nave.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate className="join-form">
            <Stack spacing={2.5}>
              <Typography variant="body2" color="text.secondary">
                Elige un alias visible para el resto de la tripulación e ingresa cuando estés listo.
              </Typography>

              {combinedError && <Alert severity="error">{combinedError}</Alert>}

              {joinStatus === 'ready' && profile ? (
                <Alert severity="success">Alias configurado como {profile.alias}.</Alert>
              ) : null}

              <TextField
                label="Alias"
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
                autoComplete="nickname"
                disabled={isPending}
                inputProps={{ maxLength: 40 }}
              />

              <Box>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isPending || !alias.trim()}
                  endIcon={isPending ? <CircularProgress color="inherit" size={18} /> : null}
                  className="join-submit"
                >
                  {profile ? 'Actualizar y entrar' : 'Entrar a la nave'}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Estado de conexión: {connectionLabel}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </div>

        <div className="join-card__customizer">
          <AvatarCustomizer appearance={appearance} onChange={setAppearance} />
        </div>
      </div>
    </div>
  );
}
