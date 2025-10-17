import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import { DeleteOutline, Security, SecurityUpdateGood } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext.jsx';
import {
  deleteUser,
  fetchUsers,
  updateUserRole
} from '../api/admin.js';

const rowsPerPageOptions = [5, 10, 25];

export default function AdminUserTable() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[1]);
  const [feedback, setFeedback] = useState(null);

  const queryKey = useMemo(
    () => ['admin', 'users', { page, limit: rowsPerPage }],
    [page, rowsPerPage]
  );

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => fetchUsers({ limit: rowsPerPage, offset: page * rowsPerPage }),
    keepPreviousData: true
  });

  const promoteMutation = useMutation({
    mutationFn: ({ id, role }) => updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setFeedback({ type: 'success', message: 'Usuario actualizado correctamente.' });
    },
    onError: (mutationError) => {
      const message = mutationError?.response?.data?.message ?? 'No se pudo actualizar el usuario.';
      setFeedback({ type: 'error', message });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setFeedback({ type: 'success', message: 'Usuario eliminado.' });
    },
    onError: (mutationError) => {
      const message = mutationError?.response?.data?.message ?? 'No se pudo eliminar el usuario.';
      setFeedback({ type: 'error', message });
    }
  });

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handlePromote = (id, nextRole) => {
    promoteMutation.mutate({ id, role: nextRole });
  };

  const handleDelete = (id) => {
    if (!window.confirm('¿Eliminar este usuario? Esta acción es irreversible.')) {
      return;
    }

    deleteMutation.mutate(id);
  };

  const rows = data?.users ?? [];
  const total = data?.total ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Gestión de usuarios
        </Typography>
        {(isFetching || promoteMutation.isPending || deleteMutation.isPending) && (
          <CircularProgress size={20} />
        )}
      </Stack>

      {feedback && (
        <Alert
          severity={feedback.type}
          onClose={() => setFeedback(null)}
          sx={{ mb: 2 }}
        >
          {feedback.message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.response?.data?.message ?? 'No se pudo cargar la lista de usuarios.'}
        </Alert>
      )}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Usuario</TableCell>
            <TableCell>Correo</TableCell>
            <TableCell>Rol</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} align="center">
                <CircularProgress size={24} />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center">
                <Typography variant="body2" color="text.secondary">
                  No hay usuarios para mostrar.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const isSelf = row.id === currentUser?.id;
              const nextRole = row.role === 'admin' ? 'user' : 'admin';

              return (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={600}>{row.username}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(row.createdAt).toLocaleString()}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{row.role}</TableCell>
                  <TableCell align="right">
                    <Tooltip
                      title={
                        row.role === 'admin' ? 'Convertir en usuario estándar' : 'Conceder rol de administrador'
                      }
                    >
                      <span>
                        <IconButton
                          color={row.role === 'admin' ? 'default' : 'primary'}
                          size="small"
                          onClick={() => handlePromote(row.id, nextRole)}
                          disabled={isSelf || promoteMutation.isPending}
                        >
                          {row.role === 'admin' ? <SecurityUpdateGood fontSize="small" /> : <Security fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={isSelf ? 'No puedes eliminar tu cuenta' : 'Eliminar usuario'}>
                      <span>
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => handleDelete(row.id)}
                          disabled={isSelf || deleteMutation.isPending}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={rowsPerPageOptions}
      />
    </Box>
  );
}
