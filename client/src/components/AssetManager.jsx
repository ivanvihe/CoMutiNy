import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  MenuItem,
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
  fetchSpriteGenerators,
  generateSpriteFromDescription,
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
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);
  const [generationForm, setGenerationForm] = useState({
    description: '',
    generator: 'procedural',
    width: 32,
    height: 32,
    palette: '',
    frames: 1,
    name: '',
    category: 'generated',
    stylePreset: 'pixel-art'
  });
  const [generationResult, setGenerationResult] = useState(null);
  const [generationError, setGenerationError] = useState('');

  const queryKey = useMemo(
    () => [...config.queryKey, { page, limit: rowsPerPage }],
    [config, page, rowsPerPage]
  );

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => config.fetcher({ limit: rowsPerPage, offset: page * rowsPerPage }),
    keepPreviousData: true
  });

  const generatorQuery = useQuery({
    queryKey: ['admin', 'assets', 'sprites', 'generators'],
    queryFn: fetchSpriteGenerators,
    enabled: isSpriteKind
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

  const generateMutation = useMutation({
    mutationFn: (payload) => generateSpriteFromDescription(payload),
    onSuccess: (result) => {
      setGenerationResult(result);
      setGenerationError('');
      queryClient.invalidateQueries({ queryKey: config.queryKey });
    },
    onError: (mutationError) => {
      const message = mutationError?.response?.data?.message ?? 'No se pudo generar el sprite.';
      setGenerationError(message);
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

  const openGenerationDialog = () => {
    setGenerationDialogOpen(true);
    setGenerationResult(null);
    setGenerationError('');
  };

  const closeGenerationDialog = () => {
    setGenerationDialogOpen(false);
    setGenerationError('');
    setGenerationResult(null);
  };

  const handleGenerationChange = (event) => {
    const { name: fieldName, value } = event.target;
    setGenerationForm((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmitGeneration = (event) => {
    event.preventDefault();

    const palette = generationForm.palette
      .split(',')
      .map((color) => color.trim())
      .filter(Boolean);

    const payload = {
      description: generationForm.description,
      generator: generationForm.generator,
      width: Number(generationForm.width) || undefined,
      height: Number(generationForm.height) || undefined,
      frames: Number(generationForm.frames) || undefined,
      palette: palette.length ? palette : undefined,
      name: generationForm.name || undefined,
      category: generationForm.category || undefined,
      stylePreset: generationForm.stylePreset || undefined
    };

    setGenerationError('');
    setGenerationResult(null);
    generateMutation.mutate(payload);
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
          {isSpriteKind && (
            <Button variant="outlined" onClick={openGenerationDialog}>
              Generar desde descripción
            </Button>
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

      {isSpriteKind && (
        <Dialog
          open={generationDialogOpen}
          onClose={closeGenerationDialog}
          fullWidth
          maxWidth="sm"
          component="form"
          onSubmit={handleSubmitGeneration}
        >
          <DialogTitle>Generar sprite automáticamente</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Descripción"
                name="description"
                value={generationForm.description}
                onChange={handleGenerationChange}
                required
                multiline
                minRows={3}
                helperText="Describe el sprite que quieres obtener."
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Generador"
                    name="generator"
                    value={generationForm.generator}
                    onChange={handleGenerationChange}
                    disabled={generatorQuery.isLoading}
                    helperText="Selecciona la estrategia disponible"
                  >
                    {(generatorQuery.data ?? []).map((generator) => (
                      <MenuItem key={generator.id} value={generator.id} disabled={!generator.available}>
                        {generator.name}
                        {!generator.available ? ' (no disponible)' : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Ancho"
                    name="width"
                    type="number"
                    value={generationForm.width}
                    onChange={handleGenerationChange}
                    inputProps={{ min: 8, max: 256 }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Alto"
                    name="height"
                    type="number"
                    value={generationForm.height}
                    onChange={handleGenerationChange}
                    inputProps={{ min: 8, max: 256 }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Frames"
                    name="frames"
                    type="number"
                    value={generationForm.frames}
                    onChange={handleGenerationChange}
                    helperText="Sprites por fila"
                    inputProps={{ min: 1, max: 12 }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Paleta"
                    name="palette"
                    value={generationForm.palette}
                    onChange={handleGenerationChange}
                    placeholder="#ff00aa,#00ffaa"
                    helperText="Colores hex separados por coma"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nombre"
                    name="name"
                    value={generationForm.name}
                    onChange={handleGenerationChange}
                    helperText="Opcional"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Categoría"
                    name="category"
                    value={generationForm.category}
                    onChange={handleGenerationChange}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Estilo"
                    name="stylePreset"
                    value={generationForm.stylePreset}
                    onChange={handleGenerationChange}
                    helperText="Preset para modelos externos"
                  />
                </Grid>
              </Grid>

              <DialogContentText>
                La salida se normaliza a un PNG {`${generationForm.width}×${generationForm.height}`} compatible con el motor, con
                paletas adaptadas automáticamente si es necesario.
              </DialogContentText>

              {generationError && (
                <Alert severity="error" onClose={() => setGenerationError('')}>
                  {generationError}
                </Alert>
              )}

              {generationResult?.resources?.image && (
                <Stack spacing={1} alignItems="center">
                  <Typography variant="subtitle2">Sprite generado</Typography>
                  <Box
                    component="img"
                    src={generationResult.resources.image}
                    alt={generationResult.asset?.name ?? 'Sprite generado'}
                    sx={{
                      width: 96,
                      height: 96,
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.12)',
                      imageRendering: 'pixelated'
                    }}
                  />
                  <Typography variant="body2" color="text.secondary" align="center">
                    {generationResult.asset?.name} disponible en {generationResult.asset?.imageUrl}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeGenerationDialog}>Cerrar</Button>
            <Button type="submit" variant="contained" disabled={generateMutation.isPending}>
              {generateMutation.isPending ? 'Generando…' : 'Generar'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
