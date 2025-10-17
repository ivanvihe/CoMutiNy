import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorld } from '../context/WorldContext.jsx';
import { useMap } from '../context/MapContext.jsx';
import '../styles/home.css';

const CONNECTION_LABELS: Record<string, string> = {
  idle: 'Sin conectar',
  connecting: 'Conectando…',
  connected: 'Conectado',
  disconnected: 'Desconectado',
  error: 'Con errores',
  terminated: 'Sesión terminada'
};

export default function Login() {
  const navigate = useNavigate();
  const { profile, joinWorld, joinStatus, joinError, connectionStatus } = useWorld();
  const { maps, currentMapId, switchMap } = useMap();
  const [alias, setAlias] = useState(() => profile?.alias ?? '');
  const [selectedMapId, setSelectedMapId] = useState(() => profile?.mapId ?? currentMapId ?? '');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!profile?.alias) {
      return;
    }
    setAlias(profile.alias);
  }, [profile?.alias]);

  useEffect(() => {
    if (!profile?.mapId) {
      return;
    }
    setSelectedMapId(profile.mapId);
    if (profile.mapId !== currentMapId) {
      switchMap(profile.mapId);
    }
  }, [profile?.mapId, currentMapId, switchMap]);

  const availableMaps = useMemo(() => (Array.isArray(maps) ? maps : []), [maps]);

  useEffect(() => {
    if (selectedMapId && availableMaps.some((map) => map.id === selectedMapId)) {
      return;
    }

    if (availableMaps.length === 0) {
      setSelectedMapId('');
      return;
    }

    const fallback =
      (currentMapId && availableMaps.some((map) => map.id === currentMapId)
        ? currentMapId
        : null) ?? availableMaps[0]?.id ?? '';

    if (!fallback || fallback === selectedMapId) {
      return;
    }

    setSelectedMapId(fallback);
    if (fallback !== currentMapId) {
      switchMap(fallback);
    }
  }, [availableMaps, currentMapId, selectedMapId, switchMap]);

  const selectedMap = useMemo(
    () => availableMaps.find((map) => map.id === selectedMapId) ?? null,
    [availableMaps, selectedMapId]
  );

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = alias.trim();
    if (!trimmed) {
      setLocalError('Introduce un alias para unirte.');
      return;
    }

    setLocalError('');

    const targetMapId = selectedMapId || availableMaps[0]?.id || '';

    try {
      if (targetMapId) {
        await joinWorld({ alias: trimmed, mapId: targetMapId });
      } else {
        await joinWorld({ alias: trimmed });
      }
      navigate('/world');
    } catch (error: unknown) {
      if (error instanceof Error) {
        setLocalError(error.message);
      } else {
        setLocalError('No se pudo crear la sesión.');
      }
    }
  };

  const handleMapChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setSelectedMapId(value);
    if (value) {
      switchMap(value);
    }
  };

  return (
    <div className="join-screen">
      <Box component="form" onSubmit={handleSubmit} noValidate className="join-panel">
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Typography component="h1" variant="h4" className="join-title">
              Bienvenido a CoMutiNy
            </Typography>
            <Typography variant="body2" className="join-subtitle">
              Elige tu alias y punto de partida para entrar a la comunidad.
            </Typography>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Usa un alias visible para el resto de la comunidad y selecciona el mapa donde
            comenzarás tu exploración.
          </Typography>

          {combinedError && <Alert severity="error">{combinedError}</Alert>}

          {joinStatus === 'ready' && profile ? (
            <Alert severity="success">Alias configurado como {profile.alias}.</Alert>
          ) : null}

          <Stack spacing={2}>
            <TextField
              label="Alias"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              autoComplete="nickname"
              disabled={isPending}
              inputProps={{ maxLength: 40 }}
            />

            <FormControl fullWidth disabled={isPending || availableMaps.length === 0}>
              <InputLabel id="map-select-label">Mapa inicial</InputLabel>
              <Select
                labelId="map-select-label"
                label="Mapa inicial"
                value={selectedMapId}
                onChange={handleMapChange}
              >
                {availableMaps.length === 0 ? (
                  <MenuItem value="" disabled>
                    No hay mapas disponibles
                  </MenuItem>
                ) : (
                  availableMaps.map((map) => (
                    <MenuItem key={map.id} value={map.id}>
                      {map.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {selectedMap ? (
              <Box className="join-map" sx={{ borderColor: 'divider' }}>
                <Typography variant="subtitle2" className="join-map__title">
                  {selectedMap.name}
                </Typography>
                {selectedMap.description ? (
                  <Typography variant="body2" color="text.secondary" className="join-map__description">
                    {selectedMap.description}
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary" className="join-map__meta">
                  Bioma: {selectedMap.biome ?? 'Comunidad'} · Tamaño: {selectedMap.size?.width ?? 0}x
                  {selectedMap.size?.height ?? 0}
                </Typography>
              </Box>
            ) : null}
          </Stack>

          <Stack spacing={1}>
            <Button
              type="submit"
              variant="contained"
              size="medium"
              disabled={isPending || !alias.trim()}
              endIcon={isPending ? <CircularProgress color="inherit" size={18} /> : null}
              className="join-submit"
            >
              {profile ? 'Actualizar y entrar' : 'Entrar a la comunidad'}
            </Button>
            <Typography variant="caption" color="text.secondary" className="join-connection">
              Estado de conexión: {connectionLabel}
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </div>
  );
}
