import {
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack
} from '@mui/material';
import AvatarPreview from './AvatarPreview.jsx';

const OPTIONS = {
  hair: ['Corto', 'Largo', 'Trenzas', 'Rizado'],
  face: ['Clásica', 'Sonriente', 'Freckles', 'Cyber'],
  outfit: ['Casual', 'Creativo', 'Profesional', 'Festivo'],
  shoes: ['Botas', 'Tenis', 'Sandalias', 'Sin calzado']
};

export default function AvatarCustomizer({ appearance, onChange }) {
  const handleChange = (key) => (event) => {
    onChange({ ...appearance, [key]: event.target.value });
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
          <AvatarPreview appearance={appearance} />

          <Divider sx={{ opacity: 0.25 }} />

          <Stack spacing={2}>
            {Object.entries(OPTIONS).map(([key, values]) => (
              <FormControl key={key} fullWidth>
                <InputLabel id={`${key}-label`}>{keyToLabel(key)}</InputLabel>
                <Select
                  labelId={`${key}-label`}
                  label={keyToLabel(key)}
                  value={appearance[key]}
                  onChange={handleChange(key)}
                >
                  {values.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
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
