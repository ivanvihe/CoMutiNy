import { useMemo } from 'react';
import { Avatar, Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import {
  CHARACTER_MESHES,
  CHARACTER_TEXTURES,
  DEFAULT_CHARACTER_APPEARANCE,
  normaliseCharacterAppearance
} from '../game/characters/customization.js';
import useCharacterTexturePreview from '../hooks/useCharacterTexturePreview.js';

const ICONS = {
  texture: 'Textura',
  mesh: 'Fisonomía',
  visorColor: 'Visor',
  accentColor: 'Detalles'
};

export default function AvatarPreview({ appearance }) {
  const normalized = useMemo(
    () =>
      normaliseCharacterAppearance({
        ...DEFAULT_CHARACTER_APPEARANCE,
        ...(appearance ?? {})
      }),
    [appearance]
  );

  const texture = CHARACTER_TEXTURES[normalized.texture] ?? null;
  const mesh = CHARACTER_MESHES[normalized.mesh] ?? null;
  const texturePreview = useCharacterTexturePreview(normalized.texture);
  const textureSwatch = texture?.swatch ?? null;
  const textureLabel = texture?.label ?? normalized.texture;
  const meshLabel = mesh?.label ?? normalized.mesh;

  return (
    <Stack spacing={2} alignItems="center" textAlign="center">
      <Tooltip title="Vista previa del personaje según tu configuración" arrow placement="top">
        <Box
          sx={{
            width: 180,
            height: 220,
            position: 'relative',
            borderRadius: 4,
            overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.18)',
            background: `linear-gradient(180deg, ${withOpacity(
              normalized.accentColor,
              0.25
            )} 0%, rgba(7,26,47,0.9) 100%)`,
            boxShadow: '0 16px 32px rgba(0,0,0,0.35)'
          }}
        >
          {texturePreview ? (
            <Box
              component="img"
              src={texturePreview}
              alt={textureLabel}
              sx={{
                position: 'absolute',
                bottom: -4,
                left: '50%',
                width: '130%',
                transform: 'translateX(-50%)',
                imageRendering: 'pixelated'
              }}
            />
          ) : (
            <Avatar
              variant="rounded"
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 120,
                height: 140,
                bgcolor: normalized.accentColor,
                opacity: 0.6
              }}
            >
              🤝
            </Avatar>
          )}

          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.65)',
              backgroundColor: normalized.visorColor,
              boxShadow: '0 0 12px rgba(0,0,0,0.35)'
            }}
            aria-hidden
          />
        </Box>
      </Tooltip>

      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Perfil comunitario
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Tu estilo define cómo te verán quienes compartan este espacio.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
        <Chip
          label={`${ICONS.texture}: ${textureLabel}`}
          variant="outlined"
          color="secondary"
          icon={
            <TextureIcon
              preview={texturePreview}
              swatch={textureSwatch}
              label={textureLabel}
            />
          }
          sx={{ borderRadius: 2 }}
        />
        <Chip
          label={`${ICONS.mesh}: ${meshLabel}`}
          variant="outlined"
          color="secondary"
          sx={{ borderRadius: 2 }}
        />
        <Chip
          label={`${ICONS.visorColor}: ${normalized.visorColor}`}
          variant="outlined"
          color="secondary"
          icon={<ColorDot color={normalized.visorColor} />}
          sx={{ borderRadius: 2 }}
        />
        <Chip
          label={`${ICONS.accentColor}: ${normalized.accentColor}`}
          variant="outlined"
          color="secondary"
          icon={<ColorDot color={normalized.accentColor} />}
          sx={{ borderRadius: 2 }}
        />
      </Stack>
    </Stack>
  );
}

function TextureIcon({ preview, swatch, label }) {
  return (
    <Box
      component="span"
      sx={{
        width: 20,
        height: 20,
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.25)',
        backgroundColor: 'rgba(255,255,255,0.12)',
        backgroundImage: swatch ?? undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {preview ? (
        <Box
          component="img"
          src={preview}
          alt={label}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
        />
      ) : null}
    </Box>
  );
}

function ColorDot({ color }) {
  return (
    <Box
      component="span"
      sx={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.4)',
        backgroundColor: color
      }}
    />
  );
}

function withOpacity(hex, opacity) {
  if (typeof hex !== 'string') {
    return `rgba(26, 32, 44, ${opacity})`;
  }
  const trimmed = hex.replace('#', '');
  if (trimmed.length !== 6) {
    return `rgba(26, 32, 44, ${opacity})`;
  }
  const numeric = Number.parseInt(trimmed, 16);
  const r = (numeric >> 16) & 0xff;
  const g = (numeric >> 8) & 0xff;
  const b = numeric & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
