import { Avatar, Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import Face6TwoToneIcon from '@mui/icons-material/Face6TwoTone';
import CheckroomTwoToneIcon from '@mui/icons-material/CheckroomTwoTone';
import DirectionsRunTwoToneIcon from '@mui/icons-material/DirectionsRunTwoTone';
import BrushTwoToneIcon from '@mui/icons-material/BrushTwoTone';

const ICONS = {
  hair: <BrushTwoToneIcon fontSize="small" />,
  face: <Face6TwoToneIcon fontSize="small" />,
  outfit: <CheckroomTwoToneIcon fontSize="small" />,
  shoes: <DirectionsRunTwoToneIcon fontSize="small" />
};

export default function AvatarPreview({ appearance }) {
  return (
    <Stack spacing={2} alignItems="center" textAlign="center">
      <Tooltip title="Representación visual de la persona participante" arrow placement="top">
        <Avatar
          sx={{
            width: 120,
            height: 120,
            fontSize: 48,
            bgcolor: 'primary.main',
            boxShadow: '0 0 0 6px rgba(255,255,255,0.08)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}
        >
          🤝
        </Avatar>
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
        {Object.entries(appearance).map(([key, value]) => (
          <Chip
            key={key}
            label={`${keyToLabel(key)}: ${value}`}
            color="secondary"
            variant="outlined"
            icon={ICONS[key]}
            sx={{ borderRadius: 2 }}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function keyToLabel(key) {
  switch (key) {
    case 'hair':
      return 'Cabello';
    case 'face':
      return 'Rostro';
    case 'outfit':
      return 'Ropa';
    case 'shoes':
      return 'Calzado';
    default:
      return key;
  }
}
