import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useEffect, useMemo, useState } from 'react'
import {
  createMap,
  createMapObject,
  deleteMap,
  deleteMapObject,
  fetchMapById,
  fetchMaps,
  updateMap,
  updateMapObject
} from '../../api/maps.js'
import { useWorld } from '../../context/WorldContext.jsx'

const generateLocalId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `local-${Math.random().toString(36).slice(2, 10)}`
}

const createInitialMapForm = () => ({
  name: '',
  slug: '',
  biome: '',
  description: '',
  width: '7',
  height: '7',
  spawnX: '0',
  spawnY: '0',
  paletteText: '#2b2d42\n#8d99ae\n#edf2f4',
  metadataText: '',
  blockedAreas: []
})

const createBlockedAreaEntry = (area = {}) => ({
  localId: generateLocalId(),
  x: area.x !== undefined ? String(area.x) : '0',
  y: area.y !== undefined ? String(area.y) : '0',
  width: area.width !== undefined ? String(area.width) : '1',
  height: area.height !== undefined ? String(area.height) : '1'
})

const stringifyPalette = (palette) => {
  if (!Array.isArray(palette) || palette.length === 0) {
    return ''
  }
  return palette.join('\n')
}

const stringifyMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') {
    return ''
  }
  try {
    return JSON.stringify(metadata, null, 2)
  } catch (error) {
    return ''
  }
}

const createEmptyActionForm = (action = {}) => ({
  localId: generateLocalId(),
  id: action.id ?? null,
  type: action.type ?? '',
  label: action.label ?? '',
  payloadText: (() => {
    if (action.payload === undefined || action.payload === null) {
      return ''
    }
    if (typeof action.payload === 'string') {
      return action.payload
    }
    try {
      return JSON.stringify(action.payload, null, 2)
    } catch (error) {
      return ''
    }
  })(),
  metadataText: stringifyMetadata(action.metadata ?? null)
})

const objectToForm = (object) => ({
  id: object?.id ?? null,
  name: object?.name ?? '',
  type: object?.type ?? '',
  description: object?.description ?? '',
  solid: Boolean(object?.solid),
  positionX: object?.position?.x !== undefined ? String(object.position.x) : '0',
  positionY: object?.position?.y !== undefined ? String(object.position.y) : '0',
  width: object?.size?.width !== undefined ? String(object.size.width) : '1',
  height: object?.size?.height !== undefined ? String(object.size.height) : '1',
  paletteText: stringifyPalette(object?.palette ?? []),
  metadataText: stringifyMetadata(object?.metadata ?? null),
  actions: Array.isArray(object?.actions)
    ? object.actions.map((action) => createEmptyActionForm(action))
    : []
})

const createInitialObjectForm = () => ({
  id: null,
  name: '',
  type: '',
  description: '',
  solid: false,
  positionX: '0',
  positionY: '0',
  width: '1',
  height: '1',
  paletteText: '',
  metadataText: '',
  actions: []
})

const paletteFromText = (text) => {
  if (!text) {
    return []
  }
  return text
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean)
}

const parseJsonText = (text) => {
  if (!text || !text.trim()) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error('JSON inválido. Revisa la estructura e inténtalo de nuevo.')
  }
}

const parseNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const mapToForm = (map) => {
  const base = createInitialMapForm()
  if (!map) {
    return base
  }
  return {
    name: map.name ?? '',
    slug: map.slug ?? '',
    biome: map.biome ?? '',
    description: map.description ?? '',
    width: map.size?.width !== undefined ? String(map.size.width) : base.width,
    height: map.size?.height !== undefined ? String(map.size.height) : base.height,
    spawnX: map.spawn?.x !== undefined ? String(map.spawn.x) : base.spawnX,
    spawnY: map.spawn?.y !== undefined ? String(map.spawn.y) : base.spawnY,
    paletteText: stringifyPalette(map.palette ?? []),
    metadataText: stringifyMetadata(map.metadata ?? null),
    blockedAreas: Array.isArray(map.blockedAreas)
      ? map.blockedAreas.map((area) => createBlockedAreaEntry(area))
      : []
  }
}

const buildMapPayload = (form) => {
  const name = form.name.trim()
  if (!name) {
    throw new Error('El nombre del mapa es obligatorio.')
  }

  const slugInput = form.slug.trim()
  const biome = form.biome.trim()
  const description = form.description.trim()
  const palette = paletteFromText(form.paletteText)
  const metadata = form.metadataText ? parseJsonText(form.metadataText) : null
  const blockedAreas = form.blockedAreas.map((area) => ({
    x: parseNumber(area.x, 0),
    y: parseNumber(area.y, 0),
    width: Math.max(1, parseNumber(area.width, 1)),
    height: Math.max(1, parseNumber(area.height, 1))
  }))

  return {
    name,
    slug: slugInput || name,
    biome,
    description,
    size: {
      width: Math.max(1, parseNumber(form.width, 1)),
      height: Math.max(1, parseNumber(form.height, 1))
    },
    spawn: {
      x: parseNumber(form.spawnX, 0),
      y: parseNumber(form.spawnY, 0)
    },
    palette,
    blockedAreas,
    metadata
  }
}

const buildObjectPayload = (form) => {
  const name = form.name.trim()
  if (!name) {
    throw new Error('El nombre del objeto es obligatorio.')
  }

  const palette = paletteFromText(form.paletteText)
  const metadata = form.metadataText ? parseJsonText(form.metadataText) : null

  const actions = form.actions
    .map((action) => {
      const type = action.type.trim()
      if (!type) {
        return null
      }

      let payload = null
      if (action.payloadText && action.payloadText.trim()) {
        try {
          payload = JSON.parse(action.payloadText)
        } catch (error) {
          payload = action.payloadText.trim()
        }
      }

      const metadataValue = action.metadataText ? parseJsonText(action.metadataText) : null

      return {
        id: action.id ?? action.localId,
        type,
        ...(action.label && action.label.trim() ? { label: action.label.trim() } : {}),
        ...(payload !== null ? { payload } : {}),
        ...(metadataValue ? { metadata: metadataValue } : {})
      }
    })
    .filter(Boolean)

  return {
    name,
    type: form.type.trim(),
    description: form.description.trim(),
    solid: Boolean(form.solid),
    position: {
      x: parseNumber(form.positionX, 0),
      y: parseNumber(form.positionY, 0)
    },
    size: {
      width: Math.max(1, parseNumber(form.width, 1)),
      height: Math.max(1, parseNumber(form.height, 1))
    },
    palette,
    metadata,
    actions
  }
}

const MapEditor = () => {
  const { profile } = useWorld()
  const [maps, setMaps] = useState([])
  const [selectedMapId, setSelectedMapId] = useState(null)
  const [mapForm, setMapForm] = useState(createInitialMapForm)
  const [currentObjects, setCurrentObjects] = useState([])
  const [selectedObjectId, setSelectedObjectId] = useState(null)
  const [objectForm, setObjectForm] = useState(createInitialObjectForm)
  const [loading, setLoading] = useState(true)
  const [loadingMap, setLoadingMap] = useState(false)
  const [savingMap, setSavingMap] = useState(false)
  const [savingObject, setSavingObject] = useState(false)
  const [deletingMapState, setDeletingMapState] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const isAdmin = useMemo(() => {
    if (!profile?.alias) {
      return false
    }
    return profile.alias.toLowerCase().includes('admin')
  }, [profile])

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }

    const loadMaps = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await fetchMaps({ limit: 100, offset: 0 })
        const results = Array.isArray(data?.results) ? data.results : []
        setMaps(results)
        if (results.length > 0) {
          await handleSelectMap(results[0].id, { silent: true })
        } else {
          handleCreateNewMap()
        }
      } catch (err) {
        const message = err?.response?.data?.message ?? err?.message ?? 'No se pudieron cargar los mapas.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadMaps()
  }, [isAdmin])

  const handleCreateNewMap = () => {
    setSelectedMapId('new')
    setMapForm(createInitialMapForm())
    setCurrentObjects([])
    setSelectedObjectId(null)
    setObjectForm(createInitialObjectForm())
    setFeedback('')
  }

  const handleSelectMap = async (mapId, { silent = false } = {}) => {
    if (!mapId) {
      return
    }
    if (!silent) {
      setLoadingMap(true)
    }
    setError('')
    try {
      const map = await fetchMapById(mapId)
      setSelectedMapId(mapId)
      setMapForm(mapToForm(map))
      setCurrentObjects(Array.isArray(map.objects) ? map.objects : [])
      if (map.objects?.length) {
        setSelectedObjectId(map.objects[0].id)
        setObjectForm(objectToForm(map.objects[0]))
      } else {
        setSelectedObjectId(null)
        setObjectForm(createInitialObjectForm())
      }
      setMaps((previous) => {
        const exists = previous.some((item) => item.id === map.id)
        if (!exists) {
          return [...previous, map]
        }
        return previous.map((item) => (item.id === map.id ? map : item))
      })
      if (!silent) {
        setFeedback('Mapa cargado correctamente.')
      }
    } catch (err) {
      const message = err?.response?.data?.message ?? err?.message ?? 'No se pudo cargar el mapa.'
      setError(message)
    } finally {
      if (!silent) {
        setLoadingMap(false)
      }
    }
  }

  const handleMapFieldChange = (field, value) => {
    setMapForm((previous) => ({
      ...previous,
      [field]: value
    }))
  }

  const handleBlockedAreaChange = (localId, field, value) => {
    setMapForm((previous) => ({
      ...previous,
      blockedAreas: previous.blockedAreas.map((area) =>
        area.localId === localId ? { ...area, [field]: value } : area
      )
    }))
  }

  const handleAddBlockedArea = () => {
    setMapForm((previous) => ({
      ...previous,
      blockedAreas: [...previous.blockedAreas, createBlockedAreaEntry()]
    }))
  }

  const handleRemoveBlockedArea = (localId) => {
    setMapForm((previous) => ({
      ...previous,
      blockedAreas: previous.blockedAreas.filter((area) => area.localId !== localId)
    }))
  }

  const handleObjectFieldChange = (field, value) => {
    setObjectForm((previous) => ({
      ...previous,
      [field]: value
    }))
  }

  const handleActionFieldChange = (localId, field, value) => {
    setObjectForm((previous) => ({
      ...previous,
      actions: previous.actions.map((action) =>
        action.localId === localId ? { ...action, [field]: value } : action
      )
    }))
  }

  const handleAddAction = () => {
    setObjectForm((previous) => ({
      ...previous,
      actions: [...previous.actions, createEmptyActionForm()]
    }))
  }

  const handleRemoveAction = (localId) => {
    setObjectForm((previous) => ({
      ...previous,
      actions: previous.actions.filter((action) => action.localId !== localId)
    }))
  }

  const handleSelectObject = (objectId) => {
    if (!objectId) {
      setSelectedObjectId(null)
      setObjectForm(createInitialObjectForm())
      return
    }

    if (objectId === 'new') {
      setSelectedObjectId('new')
      setObjectForm(createInitialObjectForm())
      return
    }

    const object = currentObjects.find((item) => item.id === objectId)
    if (object) {
      setSelectedObjectId(objectId)
      setObjectForm(objectToForm(object))
    }
  }

  const handleSaveMap = async () => {
    setError('')
    setFeedback('')
    try {
      const payload = buildMapPayload(mapForm)
      setSavingMap(true)
      let result
      if (selectedMapId === 'new') {
        result = await createMap(payload)
        setMaps((previous) => [...previous, result])
        setSelectedMapId(result.id)
      } else if (selectedMapId) {
        result = await updateMap(selectedMapId, payload)
        setMaps((previous) =>
          previous.map((item) => (item.id === result.id ? { ...item, ...result } : item))
        )
      }

      if (result) {
        setMapForm(mapToForm(result))
        setCurrentObjects(Array.isArray(result.objects) ? result.objects : currentObjects)
        setFeedback('Mapa guardado correctamente.')
      }
    } catch (err) {
      const message = err?.response?.data?.message ?? err?.message ?? 'No se pudo guardar el mapa.'
      setError(message)
    } finally {
      setSavingMap(false)
    }
  }

  const handleDeleteMap = async () => {
    if (!selectedMapId || selectedMapId === 'new') {
      return
    }
    setError('')
    setFeedback('')
    setDeletingMapState(true)
    try {
      await deleteMap(selectedMapId)
      setMaps((previous) => previous.filter((map) => map.id !== selectedMapId))
      handleCreateNewMap()
      setFeedback('Mapa eliminado correctamente.')
    } catch (err) {
      const message = err?.response?.data?.message ?? err?.message ?? 'No se pudo eliminar el mapa.'
      setError(message)
    } finally {
      setDeletingMapState(false)
    }
  }

  const handleSaveObject = async () => {
    if (!selectedMapId || selectedMapId === 'new') {
      setError('Debes guardar el mapa antes de añadir objetos.')
      return
    }

    setError('')
    setFeedback('')
    try {
      const payload = buildObjectPayload(objectForm)
      setSavingObject(true)
      let result
      if (selectedObjectId === 'new' || !selectedObjectId) {
        result = await createMapObject(selectedMapId, payload)
        setCurrentObjects((previous) => [...previous, result])
        setMaps((previous) =>
          previous.map((map) =>
            map.id === selectedMapId
              ? { ...map, objects: [...(map.objects ?? []), result] }
              : map
          )
        )
      } else {
        result = await updateMapObject(selectedMapId, selectedObjectId, payload)
        setCurrentObjects((previous) =>
          previous.map((object) => (object.id === result.id ? result : object))
        )
        setMaps((previous) =>
          previous.map((map) => {
            if (map.id !== selectedMapId) {
              return map
            }
            const objects = Array.isArray(map.objects) ? map.objects : []
            return {
              ...map,
              objects: objects.map((object) => (object.id === result.id ? result : object))
            }
          })
        )
      }

      if (result) {
        setSelectedObjectId(result.id)
        setObjectForm(objectToForm(result))
        setFeedback('Objeto guardado correctamente.')
      }
    } catch (err) {
      const message = err?.response?.data?.message ?? err?.message ?? 'No se pudo guardar el objeto.'
      setError(message)
    } finally {
      setSavingObject(false)
    }
  }

  const handleDeleteObject = async () => {
    if (!selectedMapId || selectedMapId === 'new' || !selectedObjectId || selectedObjectId === 'new') {
      return
    }

    setError('')
    setFeedback('')
    setSavingObject(true)
    try {
      await deleteMapObject(selectedMapId, selectedObjectId)
      setCurrentObjects((previous) => previous.filter((object) => object.id !== selectedObjectId))
      setMaps((previous) =>
        previous.map((map) =>
          map.id === selectedMapId
            ? { ...map, objects: (map.objects ?? []).filter((object) => object.id !== selectedObjectId) }
            : map
        )
      )
      setSelectedObjectId(null)
      setObjectForm(createInitialObjectForm())
      setFeedback('Objeto eliminado correctamente.')
    } catch (err) {
      const message = err?.response?.data?.message ?? err?.message ?? 'No se pudo eliminar el objeto.'
      setError(message)
    } finally {
      setSavingObject(false)
    }
  }

  const adminWarning = !profile?.alias
    ? 'Necesitas iniciar sesión en el mundo para acceder al editor.'
    : 'Tu perfil no tiene permisos de edición. Usa un alias administrativo.'

  if (!isAdmin) {
    return (
      <Box p={4} maxWidth={720} mx="auto">
        <Alert severity="warning">{adminWarning}</Alert>
      </Box>
    )
  }

  return (
    <Box p={4} sx={{ bgcolor: '#0b1020', minHeight: '100vh', color: '#f5f5f5' }}>
      <Typography variant="h4" gutterBottom>
        Editor de mapas isométricos
      </Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Configura dimensiones, paletas y objetos interactivos para sincronizarlos con el motor interactivo.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {feedback && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {feedback}
        </Alert>
      )}

      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} md={3}>
          <Paper elevation={3} sx={{ p: 2, height: '100%', bgcolor: '#131b33', color: 'inherit' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Mapas</Typography>
              <Tooltip title="Crear un nuevo mapa">
                <IconButton color="primary" onClick={handleCreateNewMap} size="small">
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            {loading ? (
              <Typography variant="body2">Cargando mapas…</Typography>
            ) : maps.length === 0 ? (
              <Typography variant="body2">No hay mapas creados.</Typography>
            ) : (
              <List dense disablePadding>
                {maps.map((map) => (
                  <ListItem key={map.id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      selected={selectedMapId === map.id}
                      onClick={() => handleSelectMap(map.id)}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemText
                        primary={map.name}
                        secondary={map.slug}
                        primaryTypographyProps={{ color: 'inherit' }}
                        secondaryTypographyProps={{ color: 'rgba(255,255,255,0.5)' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={9}>
          <Stack spacing={3}>
            <Paper elevation={3} sx={{ p: 3, bgcolor: '#131b33', color: 'inherit' }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Configuración del mapa</Typography>
                {selectedMapId && selectedMapId !== 'new' ? (
                  <Chip
                    label="Mapa guardado"
                    color="success"
                    size="small"
                    variant="outlined"
                  />
                ) : (
                  <Chip
                    label="Nuevo mapa"
                    color="warning"
                    size="small"
                    variant="outlined"
                  />
                )}
              </Stack>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Nombre"
                    value={mapForm.name}
                    onChange={(event) => handleMapFieldChange('name', event.target.value)}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Identificador (slug)"
                    value={mapForm.slug}
                    onChange={(event) => handleMapFieldChange('slug', event.target.value)}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Bioma"
                    value={mapForm.biome}
                    onChange={(event) => handleMapFieldChange('biome', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Descripción"
                    value={mapForm.description}
                    onChange={(event) => handleMapFieldChange('description', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Ancho"
                    type="number"
                    value={mapForm.width}
                    onChange={(event) => handleMapFieldChange('width', event.target.value)}
                    fullWidth
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Alto"
                    type="number"
                    value={mapForm.height}
                    onChange={(event) => handleMapFieldChange('height', event.target.value)}
                    fullWidth
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Spawn X"
                    type="number"
                    value={mapForm.spawnX}
                    onChange={(event) => handleMapFieldChange('spawnX', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField
                    label="Spawn Y"
                    type="number"
                    value={mapForm.spawnY}
                    onChange={(event) => handleMapFieldChange('spawnY', event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Paleta cromática"
                    value={mapForm.paletteText}
                    onChange={(event) => handleMapFieldChange('paletteText', event.target.value)}
                    fullWidth
                    multiline
                    minRows={4}
                    helperText="Separa los valores por comas o saltos de línea."
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Metadata"
                    value={mapForm.metadataText}
                    onChange={(event) => handleMapFieldChange('metadataText', event.target.value)}
                    fullWidth
                    multiline
                    minRows={4}
                    helperText="JSON opcional con configuraciones avanzadas."
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.12)' }} />

              <Stack spacing={2} sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1">Zonas bloqueadas</Typography>
                  <Button
                    startIcon={<AddIcon />}
                    variant="outlined"
                    size="small"
                    onClick={handleAddBlockedArea}
                  >
                    Añadir zona
                  </Button>
                </Stack>

                {mapForm.blockedAreas.length === 0 ? (
                  <Typography variant="body2" color="rgba(255,255,255,0.6)">
                    No se han definido áreas bloqueadas.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {mapForm.blockedAreas.map((area) => (
                      <Stack
                        key={area.localId}
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        alignItems="center"
                      >
                        <TextField
                          label="X"
                          type="number"
                          value={area.x}
                          onChange={(event) => handleBlockedAreaChange(area.localId, 'x', event.target.value)}
                          size="small"
                        />
                        <TextField
                          label="Y"
                          type="number"
                          value={area.y}
                          onChange={(event) => handleBlockedAreaChange(area.localId, 'y', event.target.value)}
                          size="small"
                        />
                        <TextField
                          label="Ancho"
                          type="number"
                          value={area.width}
                          onChange={(event) => handleBlockedAreaChange(area.localId, 'width', event.target.value)}
                          size="small"
                        />
                        <TextField
                          label="Alto"
                          type="number"
                          value={area.height}
                          onChange={(event) => handleBlockedAreaChange(area.localId, 'height', event.target.value)}
                          size="small"
                        />
                        <Tooltip title="Eliminar zona">
                          <IconButton color="error" onClick={() => handleRemoveBlockedArea(area.localId)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Stack>

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveMap}
                  disabled={savingMap || loadingMap}
                >
                  Guardar mapa
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => (selectedMapId === 'new' ? handleCreateNewMap() : handleSelectMap(selectedMapId))}
                  disabled={savingMap || loadingMap}
                >
                  Restaurar cambios
                </Button>
                <Box flexGrow={1} />
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteMap}
                  disabled={!selectedMapId || selectedMapId === 'new' || deletingMapState}
                >
                  Eliminar mapa
                </Button>
              </Stack>
            </Paper>

            <Paper elevation={3} sx={{ p: 3, bgcolor: '#131b33', color: 'inherit' }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">Objetos interactivos</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => handleSelectObject('new')}
                  disabled={!selectedMapId || selectedMapId === 'new'}
                >
                  Nuevo objeto
                </Button>
              </Stack>

              {selectedMapId === 'new' ? (
                <Alert severity="info">
                  Guarda el mapa antes de añadir objetos o acciones asociadas.
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: '#1a2442', height: '100%' }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Objetos ({currentObjects.length})
                      </Typography>
                      {currentObjects.length === 0 ? (
                        <Typography variant="body2" color="rgba(255,255,255,0.6)">
                          No hay objetos registrados.
                        </Typography>
                      ) : (
                        <List dense disablePadding>
                          {currentObjects.map((object) => (
                            <ListItem key={object.id} disablePadding sx={{ mb: 0.5 }}>
                              <ListItemButton
                                selected={selectedObjectId === object.id}
                                onClick={() => handleSelectObject(object.id)}
                                sx={{ borderRadius: 1 }}
                              >
                                <ListItemText
                                  primary={object.name}
                                  secondary={object.type}
                                  primaryTypographyProps={{ color: 'inherit' }}
                                  secondaryTypographyProps={{ color: 'rgba(255,255,255,0.5)' }}
                                />
                              </ListItemButton>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={8}>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: '#1a2442' }}>
                      <Typography variant="subtitle1" sx={{ mb: 2 }}>
                        {selectedObjectId && selectedObjectId !== 'new'
                          ? 'Editar objeto'
                          : 'Nuevo objeto'}
                      </Typography>

                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Nombre"
                            value={objectForm.name}
                            onChange={(event) => handleObjectFieldChange('name', event.target.value)}
                            fullWidth
                            required
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Tipo"
                            value={objectForm.type}
                            onChange={(event) => handleObjectFieldChange('type', event.target.value)}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Descripción"
                            value={objectForm.description}
                            onChange={(event) => handleObjectFieldChange('description', event.target.value)}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField
                            label="Posición X"
                            type="number"
                            value={objectForm.positionX}
                            onChange={(event) => handleObjectFieldChange('positionX', event.target.value)}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField
                            label="Posición Y"
                            type="number"
                            value={objectForm.positionY}
                            onChange={(event) => handleObjectFieldChange('positionY', event.target.value)}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField
                            label="Ancho"
                            type="number"
                            value={objectForm.width}
                            onChange={(event) => handleObjectFieldChange('width', event.target.value)}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField
                            label="Alto"
                            type="number"
                            value={objectForm.height}
                            onChange={(event) => handleObjectFieldChange('height', event.target.value)}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2">Colisiona</Typography>
                            <Switch
                              checked={objectForm.solid}
                              onChange={(event) => handleObjectFieldChange('solid', event.target.checked)}
                            />
                          </Stack>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Paleta"
                            value={objectForm.paletteText}
                            onChange={(event) => handleObjectFieldChange('paletteText', event.target.value)}
                            fullWidth
                            multiline
                            minRows={3}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Metadata"
                            value={objectForm.metadataText}
                            onChange={(event) => handleObjectFieldChange('metadataText', event.target.value)}
                            fullWidth
                            multiline
                            minRows={3}
                          />
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.12)' }} />

                      <Stack spacing={1} sx={{ mb: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2">Acciones</Typography>
                          <Button startIcon={<AddIcon />} size="small" variant="outlined" onClick={handleAddAction}>
                            Añadir acción
                          </Button>
                        </Stack>

                        {objectForm.actions.length === 0 ? (
                          <Typography variant="body2" color="rgba(255,255,255,0.6)">
                            Este objeto no tiene acciones configuradas.
                          </Typography>
                        ) : (
                          <Stack spacing={2}>
                            {objectForm.actions.map((action) => (
                              <Paper key={action.localId} variant="outlined" sx={{ p: 2, borderColor: 'rgba(255,255,255,0.2)', bgcolor: '#111a33' }}>
                                <Grid container spacing={1}>
                                  <Grid item xs={12} sm={6}>
                                    <TextField
                                      label="Tipo"
                                      value={action.type}
                                      onChange={(event) => handleActionFieldChange(action.localId, 'type', event.target.value)}
                                      fullWidth
                                      required
                                    />
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <TextField
                                      label="Etiqueta"
                                      value={action.label}
                                      onChange={(event) => handleActionFieldChange(action.localId, 'label', event.target.value)}
                                      fullWidth
                                    />
                                  </Grid>
                                  <Grid item xs={12}>
                                    <TextField
                                      label="Payload"
                                      value={action.payloadText}
                                      onChange={(event) => handleActionFieldChange(action.localId, 'payloadText', event.target.value)}
                                      fullWidth
                                      multiline
                                      minRows={3}
                                      helperText="Introduce JSON o texto plano con los parámetros de la acción."
                                    />
                                  </Grid>
                                  <Grid item xs={12}>
                                    <TextField
                                      label="Metadata"
                                      value={action.metadataText}
                                      onChange={(event) => handleActionFieldChange(action.localId, 'metadataText', event.target.value)}
                                      fullWidth
                                      multiline
                                      minRows={2}
                                    />
                                  </Grid>
                                </Grid>
                                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                                  <Tooltip title="Eliminar acción">
                                    <IconButton color="error" size="small" onClick={() => handleRemoveAction(action.localId)}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </Paper>
                            ))}
                          </Stack>
                        )}
                      </Stack>

                      <Stack direction="row" spacing={2}>
                        <Button
                          variant="contained"
                          startIcon={<SaveIcon />}
                          onClick={handleSaveObject}
                          disabled={savingObject}
                        >
                          Guardar objeto
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<RefreshIcon />}
                          onClick={() =>
                            selectedObjectId && selectedObjectId !== 'new'
                              ? handleSelectObject(selectedObjectId)
                              : setObjectForm(createInitialObjectForm())
                          }
                          disabled={savingObject}
                        >
                          Restablecer
                        </Button>
                        <Box flexGrow={1} />
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={handleDeleteObject}
                          disabled={!selectedObjectId || selectedObjectId === 'new' || savingObject}
                        >
                          Eliminar objeto
                        </Button>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              )}
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}

export default MapEditor
