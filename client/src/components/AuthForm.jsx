import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { z } from 'zod';

const baseSchema = {
  email: z.string().email('Introduce un correo electrónico válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
};

const registerSchema = z
  .object({
    ...baseSchema,
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword']
  });

const loginSchema = z.object(baseSchema);

const schemaByMode = {
  login: loginSchema,
  register: registerSchema
};

const labelsByMode = {
  login: {
    submit: 'Entrar',
    helper: '¿Olvidaste tu contraseña?'
  },
  register: {
    submit: 'Crear cuenta',
    helper: 'Al registrarte aceptas el código pirata.'
  }
};

export default function AuthForm({ mode }) {
  const schema = useMemo(() => schemaByMode[mode] ?? loginSchema, [mode]);
  const labels = labelsByMode[mode] ?? labelsByMode.login;
  const {
    handleSubmit,
    register,
    formState: { errors }
  } = useForm({
    mode: 'onBlur',
    resolver: zodResolver(schema)
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });

  const onSubmit = async (data) => {
    setSubmitting(true);
    setStatus({ type: null, message: '' });

    await new Promise((resolve) => setTimeout(resolve, 800));

    setSubmitting(false);
    setStatus({
      type: 'success',
      message:
        mode === 'login'
          ? 'Sesión iniciada correctamente. ¡Bienvenido a bordo!'
          : 'Cuenta creada. Ya formas parte de la tripulación.'
    });
    console.log(`${mode} form submitted`, data);
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2.5}>
        {status.type && (
          <Alert severity={status.type} variant="outlined">
            {status.message}
          </Alert>
        )}

        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register('email')}
        />

        <TextField
          label="Contraseña"
          type={showPassword ? 'text' : 'password'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          error={Boolean(errors.password)}
          helperText={errors.password?.message}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword((value) => !value)} edge="end">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            )
          }}
          {...register('password')}
        />

        {mode === 'register' && (
          <TextField
            label="Confirmar contraseña"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        )}

        <Box>
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={submitting}
            endIcon={submitting ? <CircularProgress color="inherit" size={18} /> : null}
            sx={{ fontWeight: 600, py: 1.2 }}
          >
            {labels.submit}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {labels.helper}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
