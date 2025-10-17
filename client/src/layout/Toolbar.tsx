import SettingsIcon from '@mui/icons-material/Settings';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useWorld } from '../context/WorldContext.jsx';

const CONNECTION_LABELS: Record<string, string> = {
  idle: 'Sin conectar',
  connecting: 'Conectando…',
  connected: 'Conectado',
  disconnected: 'Desconectado',
  error: 'Con errores',
  terminated: 'Sesión terminada'
};

type ToolbarProps = {
  onOpenSettings: () => void;
};

export default function Toolbar({ onOpenSettings }: ToolbarProps) {
  const { profile, connectionStatus } = useWorld();

  const statusLabel = useMemo(
    () => CONNECTION_LABELS[connectionStatus] ?? connectionStatus,
    [connectionStatus]
  );

  if (!profile?.alias) {
    return null;
  }

  return (
    <Box
      className="game-toolbar"
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1.5,
        borderRadius: 3,
        bgcolor: 'rgba(4, 20, 36, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 24px rgba(4, 12, 28, 0.45)'
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', mr: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#e0f2ff' }}>
          {profile.alias}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(224, 242, 255, 0.65)' }}>
          {statusLabel}
        </Typography>
      </Box>
      <Tooltip title="Abrir preferencias">
        <IconButton
          color="inherit"
          onClick={onOpenSettings}
          size="small"
          sx={{
            bgcolor: 'rgba(41, 182, 246, 0.18)',
            border: '1px solid rgba(41, 182, 246, 0.4)',
            '&:hover': {
              bgcolor: 'rgba(41, 182, 246, 0.35)'
            }
          }}
          aria-label="Abrir preferencias"
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
