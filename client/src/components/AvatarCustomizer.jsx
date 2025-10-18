import { useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography
} from '@mui/material';
import AvatarPreview from './AvatarPreview.jsx';
import {
  CHARACTER_CUSTOMIZATION_SCHEMA,
  CHARACTER_TEXTURES,
  DEFAULT_CHARACTER_APPEARANCE,
  normaliseCharacterAppearance
} from '../game/characters/customization.js';
import { ensureCharacterTexture } from '../game/characters/textureLoader.js';
import useCharacterTexturePreview from '../hooks/useCharacterTexturePreview.js';

export default function AvatarCustomizer({ appearance, onChange }) {
  const normalized = useMemo(
    () =>
      normaliseCharacterAppearance({
        ...DEFAULT_CHARACTER_APPEARANCE,
        ...(appearance ?? {})
      }),
    [appearance]
  );

  useEffect(() => {
    if (normalized.texture) {
      ensureCharacterTexture(normalized.texture);
    }
  }, [normalized.texture]);

  const handleChange = (fieldId) => (event) => {
    const nextValue = event.target.value;
    const nextAppearance = normaliseCharacterAppearance({
      ...normalized,
      [fieldId]: nextValue
    });
    onChange(nextAppearance);
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title="Tu presencia"
        subheader="Elige el aspecto con el que participarás en la comunidad"
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Stack spacing={3} sx={{ flex: 1 }}>
          <AvatarPreview appearance={normalized} />

          <Divider sx={{ opacity: 0.25 }} />

          <Stack spacing={2}>
            {CHARACTER_CUSTOMIZATION_SCHEMA.map((field) => (
              <FormControl key={field.id} fullWidth>
                <InputLabel id={`${field.id}-label`}>{field.label}</InputLabel>
                <Select
                  labelId={`${field.id}-label`}
                  label={field.label}
                  value={normalized[field.id]}
                  onChange={handleChange(field.id)}
                >
                  {field.options.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      <OptionLabel type={field.type} option={option} />
                    </MenuItem>
                  ))}
                </Select>
                {field.description ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: 'block' }}
                  >
                    {field.description}
                  </Typography>
                ) : null}
              </FormControl>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function OptionLabel({ type, option }) {
  if (type === 'color') {
    const color = option.preview ?? option.id;
    return (
      <Stack direction="row" spacing={1.5} alignItems="center">
        <ColorSwatch color={color} />
        <Typography variant="body2">{option.label}</Typography>
      </Stack>
    );
  }

  if (type === 'texture') {
    const definition = CHARACTER_TEXTURES[option.id] ?? null;
    const swatch = definition?.swatch ?? null;
    const palette = definition?.palette ?? null;
    return (
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextureThumbnail
          textureId={option.id}
          label={option.label}
          swatch={swatch}
          palette={palette}
        />
        <Stack spacing={0.25}>
          <Typography variant="body2">{option.label}</Typography>
          {option.description ? (
            <Typography variant="caption" color="text.secondary">
              {option.description}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    );
  }

  return <Typography variant="body2">{option.label}</Typography>;
}

function ColorSwatch({ color }) {
  return (
    <Box
      sx={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.3)',
        backgroundColor: color
      }}
    />
  );
}

function TextureThumbnail({ textureId, label, swatch, palette }) {
  const preview = useCharacterTexturePreview(textureId);

  const backgroundStyles = swatch
    ? {
        backgroundImage: swatch,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : {
        backgroundColor: palette?.suit ?? 'rgba(255,255,255,0.08)'
      };

  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.16)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...backgroundStyles
      }}
    >
      {preview ? (
        <Box
          component="img"
          src={preview}
          alt={label}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            width: '60%',
            height: '60%',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.16)'
          }}
        />
      )}
    </Box>
  );
}
