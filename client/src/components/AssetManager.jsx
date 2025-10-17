import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import SpriteCanvasEditor from './SpriteCanvasEditor.jsx';

import {
  createLandscapeAsset,
  createSpriteAsset,
  deleteLandscapeAsset,
  deleteSpriteAsset,
  fetchLandscapeAssets,
  fetchSpriteAssets,
  updateLandscapeAsset,
  updateSpriteAsset
} from '../api/admin.js';

const assetConfig = {
  sprite: {
    title: 'Assets de sprites',
    queryKey: ['admin', 'assets', 'sprites'],
    fetcher: fetchSpriteAssets,
    createMutation: createSpriteAsset,
    updateMutation: updateSpriteAsset,
    deleteMutation: deleteSpriteAsset
  },
  landscape: {
    title: 'Assets de paisajes',
    queryKey: ['admin', 'assets', 'landscapes'],
    fetcher: fetchLandscapeAssets,
    createMutation: createLandscapeAsset,
    updateMutation: updateLandscapeAsset,
    deleteMutation: deleteLandscapeAsset
  }
};

const rowsPerPageOptions = [5, 10, 25];

const emptyForm = {
  name: '',
  category: '',
  imageUrl: '',
  metadata: ''
};

export default function AssetManager({ kind }) {
  const config = assetConfig[kind] ?? assetConfig.sprite;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [formValues, setFormValues] = useState(() => ({ ...emptyForm }));
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [spriteMetadata, setSpriteMetadata] = useState(null);

  const queryKey = useMemo(
    () => [...config.queryKey, { page, limit: rowsPerPage }],
    [config, page, rowsPerPage]
  );

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => config.fetcher({ limit: rowsPerPage, offset: page * rowsPerPage }),
    keepPreviousData: true
  });

  const createMutation = useMutation({
    mutationFn: (payload) => config.createMutation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      closeDialog();
      setFeedback({ type: 'success', message: 'Asset creado correctamente.' });
    },
    onError: (mutationError) => {
      const message = mutationError?.response?.data?.message ?? 'No se pudo crear el asset.';
      setFormError(message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => config.updateMutation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      closeDialog();
      setFeedback({ type: 'success', message: 'Asset actualizado.' });
    },
    onError: (mutationError) => {
      const message = mutationError?.response?.data?.message ?? 'No se pudo actualizar el asset.';
      setFormError(message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => config.deleteMutation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      setFeedback({ type: 'success', message: 'Asset eliminado.' });
    },
    onError: (mutationError) => {
      const message = mutationError?.response?.data?.message ?? 'No se pudo eliminar el asset.';
      setFeedback({ type: 'error', message });
    }
  });

  const isSpriteKind = config === assetConfig.sprite;

  const openCreateDialog = () => {
    setDialogMode('create');
    setSelectedAsset(null);
    setFormValues({ ...emptyForm });
    setFormError('');
    setDialogOpen(true);
    setSpriteMetadata(null);
  };

  const openEditDialog = (asset) => {
    setDialogMode('edit');
    setSelectedAsset(asset);
    setFormValues({
      name: asset.name ?? '',
      category: asset.category ?? '',
      imageUrl: asset.imageUrl ?? '',
      metadata: asset.metadata ? JSON.stringify(asset.metadata, null, 2) : ''
    });
    setFormError('');
    setDialogOpen(true);
    setSpriteMetadata(asset.metadata ?? null);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFormError('');
    setSpriteMetadata(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const payload = {
      name: formValues.name.trim(),
      category: formValues.category.trim(),
      imageUrl: formValues.imageUrl.trim()
    };

    if (!payload.name || !payload.category || !payload.imageUrl) {
      setFormError('Completa nombre, categoría e imagen.');
      return;
    }

    if (formValues.metadata.trim()) {
      try {
        payload.metadata = JSON.parse(formValues.metadata);
      } catch (parseError) {
        setFormError('El campo metadata debe contener JSON válido.');
        return;
      }
    } else if (dialogMode === 'edit' || selectedAsset?.metadata) {
      payload.metadata = null;
    }

    if (dialogMode === 'create') {
      createMutation.mutate({ ...payload, metadata: payload.metadata ?? null });
    } else if (selectedAsset) {
      updateMutation.mutate({ id: selectedAsset.id, payload });
    }
  };

  const handleSpriteChange = useCallback(({ imageUrl, metadata }) => {
    setFormValues((prev) => ({
      ...prev,
      imageUrl
    }));

    if (metadata) {
      setSpriteMetadata(metadata);
      setFormValues((prev) => ({
        ...prev,
        metadata: JSON.stringify(metadata, null, 2)
      }));
    }
  }, []);

  const handleDelete = (asset) => {
    if (!window.confirm(`¿Eliminar "${asset.name}"?`)) {
      return;
    }

    deleteMutation.mutate(asset.id);
  };

  const rows = data?.assets ?? [];
  const total = data?.total ?? 0;

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          {config.title}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {(isFetching || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending) && (
            <CircularProgress size={20} />
          )}
          <Button variant="contained" onClick={openCreateDialog}>
            Añadir asset
          </Button>
        </Stack>
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
          {error?.response?.data?.message ?? 'No se pudieron cargar los assets.'}
        </Alert>
      )}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Nombre</TableCell>
            <TableCell>Categoría</TableCell>
            <TableCell>Imagen</TableCell>
            <TableCell>Metadata</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} align="center">
                <CircularProgress size={24} />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center">
                <Typography variant="body2" color="text.secondary">
                  No hay assets registrados.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((asset) => (
              <TableRow key={asset.id} hover>
                <TableCell>{asset.name}</TableCell>
                <TableCell>{asset.category}</TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    color="primary"
                    component="a"
                    href={asset.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver recurso
                  </Typography>
                </TableCell>
                <TableCell sx={{ maxWidth: 220 }}>
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    {asset.metadata ? JSON.stringify(asset.metadata, null, 2) : '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="outlined" onClick={() => openEditDialog(asset)}>
                      Editar
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleDelete(asset)}
                      disabled={deleteMutation.isPending}
                    >
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))
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

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm" component="form" onSubmit={handleSubmit}>
        <DialogTitle>{dialogMode === 'create' ? 'Crear asset' : 'Editar asset'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Nombre"
                  name="name"
                  value={formValues.name}
                  onChange={handleChange}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Categoría"
                  name="category"
                  value={formValues.category}
                  onChange={handleChange}
                  fullWidth
                  required
                />
              </Grid>
            </Grid>
            {isSpriteKind ? (
              <Stack spacing={2}>
                <SpriteCanvasEditor
                  key={dialogMode === 'edit' ? selectedAsset?.id ?? 'edit' : 'create'}
                  initialImage={selectedAsset?.imageUrl ?? null}
                  initialMetadata={spriteMetadata}
                  onChange={handleSpriteChange}
                />
                <TextField
                  label="Datos del sprite (PNG en base64)"
                  name="imageUrl"
                  value={formValues.imageUrl}
                  onChange={handleChange}
                  fullWidth
                  multiline
                  minRows={2}
                  InputProps={{ readOnly: true }}
                  helperText="El editor genera automáticamente este campo."
                  required
                />
                <TextField
                  label="Metadata"
                  name="metadata"
                  value={formValues.metadata}
                  onChange={handleChange}
                  fullWidth
                  minRows={3}
                  multiline
                  helperText="Puedes complementar la información generada por el editor si lo necesitas."
                />
              </Stack>
            ) : (
              <>
                <TextField
                  label="URL de la imagen"
                  name="imageUrl"
                  value={formValues.imageUrl}
                  onChange={handleChange}
                  fullWidth
                  required
                />
                <TextField
                  label="Metadata (JSON)"
                  name="metadata"
                  value={formValues.metadata}
                  onChange={handleChange}
                  fullWidth
                  minRows={4}
                  multiline
                  placeholder={'{ "tema": "espacio" }'}
                />
              </>
            )}
            {formError && (
              <Alert severity="error" onClose={() => setFormError('')}>
                {formError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
