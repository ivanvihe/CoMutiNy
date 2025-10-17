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
import { useAuth } from '../context/AuthContext.jsx';

const baseFields = {
  email: z.string().email('Introduce un correo electrónico válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
};

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
      .max(50, 'El nombre de usuario es demasiado largo'),
    ...baseFields,
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword']
  });

const loginSchema = z.object(baseFields);

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
  const { login, registerUser } = useAuth();
  const {
    handleSubmit,
    register: registerField,
    formState: { errors },
    reset
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

    try {
      if (mode === 'login') {
        await login({
          email: data.email.trim().toLowerCase(),
          password: data.password
        });

        setStatus({
          type: 'success',
          message: 'Sesión iniciada correctamente. ¡Bienvenido a bordo!'
        });
      } else {
        await registerUser({
          username: data.username.trim(),
          email: data.email.trim().toLowerCase(),
          password: data.password
        });

        setStatus({
          type: 'success',
          message: 'Cuenta creada. Ya formas parte de la tripulación.'
        });
      }

      reset();
    } catch (error) {
      const message = error?.response?.data?.message ?? 'No se pudo completar la operación.';
      setStatus({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2.5}>
        {status.type && (
          <Alert severity={status.type} variant="outlined">
            {status.message}
          </Alert>
        )}

        {mode === 'register' && (
          <TextField
            label="Nombre de usuario"
            autoComplete="username"
            error={Boolean(errors.username)}
            helperText={errors.username?.message}
            {...registerField('username')}
          />
        )}

        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...registerField('email')}
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
          {...registerField('password')}
        />

        {mode === 'register' && (
          <TextField
            label="Confirmar contraseña"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
            {...registerField('confirmPassword')}
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
