import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  Slider,
  Stack,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AvatarCustomizer from './AvatarCustomizer.jsx';
import { useWorld } from '../context/WorldContext.jsx';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_ZOOM_RANGE,
  getUserPreferences,
  setUserPreferences,
  updateUserPreferences
} from '../state/userPreferences.js';
import { fetchPreferences, savePreferences } from '../api/preferences.js';
import {
  DEFAULT_CHARACTER_APPEARANCE,
  normaliseCharacterAppearance
} from '../game/characters/customization.js';

const clamp = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

type PreferencesDraft = {
  mapZoom: number;
  appearance: Record<string, string>;
};

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

const ZOOM_MIN = DEFAULT_ZOOM_RANGE.min;
const ZOOM_MAX = DEFAULT_ZOOM_RANGE.max;
const ZOOM_STEP = 0.1;

const createDraftFromPreferences = (raw: Partial<PreferencesDraft> | null | undefined): PreferencesDraft => {
  const base = raw && typeof raw === 'object' ? raw : {};
  const local = getUserPreferences();
  const appearance = normaliseCharacterAppearance({
    ...DEFAULT_CHARACTER_APPEARANCE,
    ...(local.appearance ?? {}),
    ...(base.appearance ?? {})
  }) as Record<string, string>;

  return {
    mapZoom: clamp(base.mapZoom ?? local.mapZoom ?? DEFAULT_PREFERENCES.mapZoom, ZOOM_MIN, ZOOM_MAX),
    appearance
  };
};

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { profile, appearance, setAppearance } = useWorld();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PreferencesDraft>(() => createDraftFromPreferences(null));
  const [dirty, setDirty] = useState(false);

  const alias = profile?.alias ?? '';

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setLoading(true);

    if (!alias) {
      setDraft(createDraftFromPreferences(null));
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetchPreferences(alias)
      .then((remote) => {
        if (cancelled) {
          return;
        }
        const nextDraft = createDraftFromPreferences(remote);
        setDraft(nextDraft);
        setDirty(false);
        setUserPreferences((current) => ({ ...current, ...nextDraft }));
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }
        console.error('No se pudieron cargar las preferencias del jugador:', fetchError);
        setError('No se pudieron cargar tus preferencias. Intenta nuevamente.');
        setDraft(createDraftFromPreferences(null));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [alias, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft((current) => ({
      ...current,
      appearance: normaliseCharacterAppearance({
        ...current.appearance,
        ...appearance
      }) as Record<string, string>
    }));
  }, [appearance, open]);

  const handleAppearanceChange = useCallback(
    (nextAppearance: Record<string, string>) => {
      setDraft((current) => ({
        ...current,
        appearance: normaliseCharacterAppearance({
          ...current.appearance,
          ...nextAppearance
        }) as Record<string, string>
      }));
      setDirty(true);
    },
    []
  );

  const handleZoomChange = useCallback((event: Event, value: number | number[]) => {
    const numeric = Array.isArray(value) ? value[0] : value;
    setDraft((current) => ({ ...current, mapZoom: clamp(numeric, ZOOM_MIN, ZOOM_MAX) }));
    setDirty(true);
  }, []);

  const handleReset = useCallback(() => {
    const resetDraft = createDraftFromPreferences(DEFAULT_PREFERENCES);
    setDraft(resetDraft);
    setDirty(true);
  }, []);

  const saveDisabled = useMemo(() => {
    if (!alias) {
      return true;
    }
    return !dirty && !loading;
  }, [alias, dirty, loading]);

  const handleSave = useCallback(async () => {
    if (!alias) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        mapZoom: clamp(draft.mapZoom, ZOOM_MIN, ZOOM_MAX),
        appearance: { ...draft.appearance }
      };
      const stored = await savePreferences(alias, payload);
      const sanitized = createDraftFromPreferences(stored);
      setDraft(sanitized);
      updateUserPreferences(sanitized);
      setAppearance(sanitized.appearance);
      setDirty(false);
      onClose();
    } catch (saveError) {
      console.error('No se pudieron guardar las preferencias del jugador:', saveError);
      setError('No se pudieron guardar tus preferencias. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [alias, draft, onClose, setAppearance]);

  const handleClose = useCallback(() => {
    if (loading) {
      return;
    }
    onClose();
  }, [loading, onClose]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" aria-labelledby="settings-modal">
      <DialogTitle id="settings-modal">Preferencias de la experiencia</DialogTitle>
      {loading ? <LinearProgress color="secondary" /> : null}
      <DialogContent dividers sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <AvatarCustomizer appearance={draft.appearance} onChange={handleAppearanceChange} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={3} sx={{ height: '100%' }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'rgba(4, 20, 36, 0.6)',
                    border: '1px solid',
                    borderColor: 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Preferencias generales
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Ajusta opciones persistentes para personalizar tu experiencia en CoMutiNy.
                  </Typography>

                  <Divider sx={{ my: 2, opacity: 0.25 }} />

                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Zoom predeterminado del mapa
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Establece el nivel de zoom con el que se abrirán los mapas por defecto.
                      </Typography>
                      <Box sx={{ px: 1.5, pt: 2 }}>
                        <Slider
                          value={draft.mapZoom}
                          min={ZOOM_MIN}
                          max={ZOOM_MAX}
                          step={ZOOM_STEP}
                          onChange={handleZoomChange}
                          valueLabelDisplay="auto"
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Nivel actual: {(draft.mapZoom * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Sesión activa
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {alias || 'Sesión invitada'}
                    </Typography>
                  </Stack>
                  <Button variant="text" color="inherit" onClick={handleReset} disabled={loading}>
                    Restablecer
                  </Button>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saveDisabled}>
          Guardar cambios
        </Button>
      </DialogActions>
    </Dialog>
  );
}
