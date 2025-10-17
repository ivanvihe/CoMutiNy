import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useWorld } from '../context/WorldContext.jsx';

const CONNECTION_LABELS = {
  idle: 'Sin conectar',
  connecting: 'Conectando…',
  connected: 'Conectado',
  disconnected: 'Desconectado',
  error: 'Con errores',
  terminated: 'Sesión terminada'
};

export default function AliasEntry() {
  const { profile, joinWorld, joinStatus, joinError, connectionStatus } = useWorld();
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
    } catch (error) {
      setLocalError(error?.message ?? 'No se pudo crear la sesión.');
    }
  };

  const actionLabel = profile ? 'Actualizar alias' : 'Unirme a la comunidad';

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={2.5}>
        <Typography variant="body2" color="text.secondary">
          Elige un alias para que el resto de la comunidad pueda identificarte dentro del espacio compartido.
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
            fullWidth
            size="large"
            disabled={isPending || !alias.trim()}
            endIcon={isPending ? <CircularProgress color="inherit" size={18} /> : null}
            sx={{ fontWeight: 600, py: 1.2 }}
          >
            {actionLabel}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Estado de conexión: {connectionLabel}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
