import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography
} from '@mui/material';
import { useMemo } from 'react';
import { useMap } from '../context/MapContext.jsx';

const CELL_SIZE = 32;

const DIRECTIONS = [
  { label: 'Arriba', value: 'up' },
  { label: 'Abajo', value: 'down' },
  { label: 'Izquierda', value: 'left' },
  { label: 'Derecha', value: 'right' }
];

const getCellStatus = ({ x, y, map, playerPosition }) => {
  if (playerPosition.x === x && playerPosition.y === y) {
    return { type: 'player' };
  }

  if (map.blockedTiles.has(`${x},${y}`)) {
    return { type: 'blocked' };
  }

  const object = map.objects?.find((item) => {
    const width = item.size?.width ?? 1;
    const height = item.size?.height ?? 1;
    const withinX = x >= item.position.x && x < item.position.x + width;
    const withinY = y >= item.position.y && y < item.position.y + height;
    return withinX && withinY;
  });

  if (object) {
    return { type: 'object', object };
  }

  const portal = map.portals?.find((item) => {
    const area = item.from ?? {};
    const width = area.width ?? 1;
    const height = area.height ?? 1;
    const withinX = x >= area.x && x < area.x + width;
    const withinY = y >= area.y && y < area.y + height;
    return withinX && withinY;
  });

  if (portal) {
    return { type: 'portal', portal };
  }

  return { type: 'empty' };
};

const cellStyles = {
  player: {
    backgroundColor: 'rgba(41, 182, 246, 0.6)',
    border: '2px solid #29b6f6'
  },
  blocked: {
    backgroundColor: 'rgba(255, 112, 67, 0.4)',
    border: '1px dashed rgba(255, 112, 67, 0.8)'
  },
  object: {
    backgroundColor: 'rgba(171, 71, 188, 0.35)',
    border: '1px solid rgba(171, 71, 188, 0.6)'
  },
  portal: {
    backgroundColor: 'rgba(129, 199, 132, 0.35)',
    border: '1px solid rgba(129, 199, 132, 0.6)'
  },
  empty: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  }
};

export default function MapViewport() {
  const {
    maps = [],
    currentMap,
    currentMapId,
    playerPosition,
    movePlayer,
    interact,
    activeEvent,
    clearEvent,
    objectAtPlayerPosition,
    switchMap
  } = useMap();

  const canInteract = Boolean(objectAtPlayerPosition?.interaction);

  const grid = useMemo(() => {
    if (!currentMap) {
      return [];
    }
    const rows = [];
    for (let y = 0; y < currentMap.size.height; y += 1) {
      const row = [];
      for (let x = 0; x < currentMap.size.width; x += 1) {
        row.push(getCellStatus({ x, y, map: currentMap, playerPosition }));
      }
      rows.push(row);
    }
    return rows;
  }, [currentMap, playerPosition]);

  if (!currentMap) {
    return null;
  }

  const handleMove = (direction) => () => {
    movePlayer(direction);
  };

  return (
    <Card sx={{ background: 'rgba(18, 18, 18, 0.9)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
      <CardContent>
        <Stack spacing={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h6">{currentMap.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Posición: ({playerPosition.x}, {playerPosition.y})
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="map-select-label">Mapa</InputLabel>
              <Select
                labelId="map-select-label"
                value={currentMapId}
                label="Mapa"
                onChange={(event) => switchMap(event.target.value)}
              >
                {maps.map((map, index) => (
                  <MenuItem key={map?.id ?? `map-${index}`} value={map?.id}>
                    {map?.name ?? map?.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" size="small" onClick={() => interact()} disabled={!canInteract}>
              Interactuar
            </Button>
          </Box>
          {objectAtPlayerPosition ? (
            <Typography variant="body2" color="secondary.main">
              Objeto cercano: {objectAtPlayerPosition.name}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Acércate a un objeto resaltado para interactuar.
            </Typography>
          )}

          <Box>
            <Grid container spacing={1} justifyContent="center">
              <Grid item>
                <Stack direction="row" spacing={1}>
                  {DIRECTIONS.map((direction) => (
                    <Button key={direction.value} variant="contained" onClick={handleMove(direction.value)}>
                      {direction.label}
                    </Button>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${currentMap.size.width}, ${CELL_SIZE}px)`,
              gridTemplateRows: `repeat(${currentMap.size.height}, ${CELL_SIZE}px)`,
              gap: '4px',
              justifyContent: 'center'
            }}
          >
            {grid.map((row, rowIndex) =>
              row.map((cell, columnIndex) => (
                <Box
                  key={`${rowIndex}-${columnIndex}`}
                  sx={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    textAlign: 'center',
                    ...cellStyles[cell.type]
                  }}
                >
                  {cell.type === 'player' && 'Tú'}
                  {cell.type === 'object' && 'Obj'}
                  {cell.type === 'portal' && 'Puerta'}
                </Box>
              ))
            )}
          </Box>

          {activeEvent && (
            <Box
              sx={{
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.05)',
                p: 2
              }}
            >
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight={600}>
                    {activeEvent.title}
                  </Typography>
                  <Button variant="text" size="small" onClick={clearEvent}>
                    Cerrar
                  </Button>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {activeEvent.description}
                </Typography>
                {activeEvent.objectName && (
                  <Typography variant="caption" color="text.secondary">
                    Origen: {activeEvent.objectName}
                  </Typography>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
