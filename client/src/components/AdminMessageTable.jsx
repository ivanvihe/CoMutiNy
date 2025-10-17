import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { fetchRecentMessages } from '../api/admin.js';
import { resolveUserStatus } from '../utils/userStatus.js';

const rowsPerPageOptions = [10, 25, 50];
const defaultFilters = Object.freeze({ search: '', status: 'all', from: '', to: '' });

const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString();
};

export default function AdminMessageTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);
  const [filterForm, setFilterForm] = useState({ ...defaultFilters });
  const [appliedFilters, setAppliedFilters] = useState({ ...defaultFilters });

  const queryKey = useMemo(
    () => [
      'admin',
      'messages',
      {
        page,
        limit: rowsPerPage,
        filters: appliedFilters
      }
    ],
    [page, rowsPerPage, appliedFilters]
  );

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () =>
      fetchRecentMessages({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        search: appliedFilters.search || undefined,
        status: appliedFilters.status,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined
      }),
    keepPreviousData: true
  });

  const rows = data?.messages ?? [];
  const total = data?.total ?? 0;

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field) => (event) => {
    setFilterForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filterForm });
    setPage(0);
  };

  const handleResetFilters = () => {
    setFilterForm({ ...defaultFilters });
    setAppliedFilters({ ...defaultFilters });
    setPage(0);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Mensajes recientes
        </Typography>
        {isFetching && <CircularProgress size={20} />}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.response?.data?.message ?? 'No se pudieron cargar los mensajes.'}
        </Alert>
      )}

      <Stack
        spacing={2}
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'flex-end' }}
        sx={{ mb: 3 }}
      >
        <TextField
          label="Buscar"
          value={filterForm.search}
          onChange={handleFilterChange('search')}
          placeholder="Contenido, usuario o correo"
          fullWidth
        />
        <TextField
          select
          label="Estado"
          value={filterForm.status}
          onChange={handleFilterChange('status')}
          sx={{ minWidth: { xs: '100%', md: 180 } }}
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="active">Activos</MenuItem>
          <MenuItem value="suspended">Suspendidos</MenuItem>
          <MenuItem value="banned">Baneados</MenuItem>
        </TextField>
        <TextField
          label="Desde"
          type="datetime-local"
          value={filterForm.from}
          onChange={handleFilterChange('from')}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: { xs: '100%', md: 220 } }}
        />
        <TextField
          label="Hasta"
          type="datetime-local"
          value={filterForm.to}
          onChange={handleFilterChange('to')}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: { xs: '100%', md: 220 } }}
        />
        <Stack direction="row" spacing={1} sx={{ py: { xs: 1, md: 0 } }}>
          <Button variant="contained" onClick={handleApplyFilters}>
            Aplicar
          </Button>
          <Button variant="text" onClick={handleResetFilters}>
            Limpiar
          </Button>
        </Stack>
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell>Usuario</TableCell>
            <TableCell>Mensaje</TableCell>
            <TableCell>Estado</TableCell>
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
                  No se encontraron mensajes con los filtros seleccionados.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((message) => {
              const status = resolveUserStatus(message.user);

              return (
                <TableRow key={message.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(message.createdAt)}</TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={600}>{message.user?.username ?? '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {message.user?.email ?? 'Sin correo registrado'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {message.content}
                    </Typography>
                    {message.avatar?.name && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Avatar: {message.avatar.name}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={status.tooltip} arrow>
                      <Chip label={status.label} color={status.chipColor} size="small" sx={{ textTransform: 'none' }} />
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
