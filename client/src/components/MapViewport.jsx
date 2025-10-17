import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import GroupsIcon from '@mui/icons-material/Groups';
import HistoryIcon from '@mui/icons-material/History';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { useMemo, useState } from 'react';
import { useMap } from '../context/MapContext.jsx';
import { useWorld } from '../context/WorldContext.jsx';
import MissionStatusList from './MissionStatusList.jsx';

const CELL_SIZE = 32;

const DIRECTIONS = [
  { label: 'Arriba', value: 'up' },
  { label: 'Abajo', value: 'down' },
  { label: 'Izquierda', value: 'left' },
  { label: 'Derecha', value: 'right' }
];

const getCellStatus = ({ x, y, map, playerPosition, remotePlayers }) => {
  if (playerPosition.x === x && playerPosition.y === y) {
    return { type: 'player' };
  }

  const remoteAtTile = remotePlayers?.get(`${x},${y}`);

  if (remoteAtTile?.length) {
    return { type: 'remote-player', players: remoteAtTile };
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
  'remote-player': {
    backgroundColor: 'rgba(76, 175, 80, 0.35)',
    border: '2px solid rgba(129, 199, 132, 0.8)'
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

const formatTimestamp = (timestamp) => {
  try {
    return new Date(timestamp).toLocaleTimeString();
  } catch (error) {
    return '';
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
    switchMap,
    missions,
    missionLog
  } = useMap();
  const { players: remotePlayers, localPlayerId, connectionStatus } = useWorld();
  const [activePanel, setActivePanel] = useState('info');

  const canInteract = Boolean(objectAtPlayerPosition?.interaction);

  const remotePlayersByTile = useMemo(() => {
    if (!currentMapId) {
      return new Map();
    }

    const entries = new Map();

    remotePlayers
      .filter((player) => player.id !== localPlayerId)
      .filter((player) => player.metadata?.mapId === currentMapId)
      .forEach((player) => {
        const position = player.renderPosition ?? player.position ?? {};
        const tileX = Math.round(position.x ?? 0);
        const tileY = Math.round(position.y ?? 0);
        const key = `${tileX},${tileY}`;
        const list = entries.get(key) ?? [];
        entries.set(key, [...list, player]);
      });

    return entries;
  }, [currentMapId, localPlayerId, remotePlayers]);

  const remotePlayersInMap = useMemo(
    () =>
      remotePlayers.filter(
        (player) => player.id !== localPlayerId && player.metadata?.mapId === currentMapId
      ),
    [currentMapId, localPlayerId, remotePlayers]
  );

  const grid = useMemo(() => {
    if (!currentMap) {
      return [];
    }
    const rows = [];
    for (let y = 0; y < currentMap.size.height; y += 1) {
      const row = [];
      for (let x = 0; x < currentMap.size.width; x += 1) {
        row.push(
          getCellStatus({ x, y, map: currentMap, playerPosition, remotePlayers: remotePlayersByTile })
        );
      }
      rows.push(row);
    }
    return rows;
  }, [currentMap, playerPosition, remotePlayersByTile]);

  if (!currentMap) {
    return null;
  }

  const handleMove = (direction) => () => {
    movePlayer(direction);
  };

  const mapIndex = maps.findIndex((map) => map?.id === currentMapId);
  const handleCycleMap = (step) => () => {
    if (!maps.length) {
      return;
    }

    const nextIndex = mapIndex >= 0 ? (mapIndex + step + maps.length) % maps.length : 0;
    const nextMap = maps[nextIndex];
    if (nextMap?.id) {
      switchMap(nextMap.id);
      setActivePanel('info');
    }
  };

  const portalTargets = useMemo(() => {
    if (!currentMap?.portals?.length) {
      return [];
    }

    return currentMap.portals.map((portal) => {
      const targetMap = maps.find((entry) => entry?.id === portal.targetMap);
      return {
        id: portal.id,
        description: portal.description,
        targetMapId: portal.targetMap,
        targetName: targetMap?.name ?? portal.targetMap
      };
    });
  }, [currentMap?.portals, maps]);

  const handlePanelChange = (_, nextPanel) => {
    setActivePanel(nextPanel);
  };

  const missionPanelLabel = missions.length ? `Misiones (${missions.length})` : 'Misiones';
  const crewPanelLabel = `Tripulación (${remotePlayersInMap.length})`;
  const logPanelLabel = missionLog.length ? `Registro (${missionLog.length})` : 'Registro';

  const statusChipColor =
    connectionStatus === 'connected'
      ? 'success'
      : connectionStatus === 'error'
      ? 'error'
      : 'default';

  return (
    <Card sx={{ background: 'rgba(18, 18, 18, 0.9)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={1}>
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h6">{currentMap.name}</Typography>
                  {currentMap.biome && <Chip size="small" color="info" label={currentMap.biome} />}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Posición: ({playerPosition.x}, {playerPosition.y})
                </Typography>
                <Chip
                  size="small"
                  label={`Estado de red: ${connectionStatus}`}
                  color={statusChipColor}
                  icon={<TravelExploreIcon fontSize="small" />}
                />
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="Mapa anterior">
                  <span>
                    <IconButton aria-label="Mapa anterior" onClick={handleCycleMap(-1)} disabled={!maps.length}>
                      <NavigateBeforeIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="map-select-label">Mapa</InputLabel>
                  <Select
                    labelId="map-select-label"
                    value={currentMapId}
                    label="Mapa"
                    onChange={(event) => {
                      switchMap(event.target.value);
                      setActivePanel('info');
                    }}
                  >
                    {maps.map((map, index) => (
                      <MenuItem key={map?.id ?? `map-${index}`} value={map?.id}>
                        {map?.name ?? map?.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip title="Mapa siguiente">
                  <span>
                    <IconButton aria-label="Mapa siguiente" onClick={handleCycleMap(1)} disabled={!maps.length}>
                      <NavigateNextIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              <Button
                variant="outlined"
                size="small"
                onClick={() => interact()}
                disabled={!canInteract}
                aria-label="Interactuar con objeto cercano"
              >
                Interactuar
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {currentMap.description}
            </Typography>
            {portalTargets.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {portalTargets.map((portal) => (
                  <Chip
                    key={portal.id}
                    icon={<TravelExploreIcon fontSize="small" />}
                    label={`→ ${portal.targetName}`}
                    variant="outlined"
                    size="small"
                    sx={{ borderColor: 'rgba(255,255,255,0.16)' }}
                  />
                ))}
              </Stack>
            )}
          </Stack>

          <Tabs value={activePanel} onChange={handlePanelChange} textColor="inherit" indicatorColor="primary">
            <Tab value="info" label="Información" />
            <Tab value="missions" label={missionPanelLabel} />
            <Tab value="crew" label={crewPanelLabel} icon={<GroupsIcon fontSize="small" />} iconPosition="start" />
            <Tab value="log" label={logPanelLabel} icon={<HistoryIcon fontSize="small" />} iconPosition="start" />
          </Tabs>

          {activePanel === 'info' && (
            <Stack spacing={1}>
              {objectAtPlayerPosition ? (
                <Typography variant="body2" color="secondary.main">
                  Objeto cercano: {objectAtPlayerPosition.name}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Acércate a un objeto resaltado para interactuar.
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                Compañeros en este mapa: {remotePlayersInMap.length}
              </Typography>
            </Stack>
          )}

          {activePanel === 'missions' && <MissionStatusList missions={missions} />}

          {activePanel === 'crew' && (
            <List dense>
              {remotePlayersInMap.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No hay tripulación remota"
                    secondary="Invita a tus compañeros para coordinar misiones en este sector."
                  />
                </ListItem>
              )}
              {remotePlayersInMap.map((player) => (
                <ListItem key={player.id} divider>
                  <ListItemText
                    primary={player.name ?? player.id}
                    secondary={`Rol: ${player.metadata?.role ?? 'Tripulante'}`}
                  />
                </ListItem>
              ))}
            </List>
          )}

          {activePanel === 'log' && (
            <List dense>
              {missionLog.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="Sin eventos registrados"
                    secondary="Completa misiones o interactúa con objetos para generar entradas."
                  />
                </ListItem>
              )}
              {missionLog.map((entry) => (
                <ListItem key={entry.id} divider>
                  <ListItemText
                    primary={`${entry.missionTitle} → ${entry.status}`}
                    secondary={`${formatTimestamp(entry.timestamp)} · ${entry.mapName}${
                      entry.message ? ` · ${entry.message}` : ''
                    }`}
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Divider flexItem />

          <Box>
            <Grid container spacing={1} justifyContent="center">
              <Grid item>
                <Stack direction="row" spacing={1}>
                  {DIRECTIONS.map((direction) => (
                    <Button
                      key={direction.value}
                      variant="contained"
                      onClick={handleMove(direction.value)}
                      aria-label={`Mover ${direction.label.toLowerCase()}`}
                    >
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
                  {cell.type === 'remote-player' &&
                    (cell.players.length > 1
                      ? `+${cell.players.length}`
                      : cell.players[0]?.name?.slice(0, 3) ?? 'Aliado')}
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
