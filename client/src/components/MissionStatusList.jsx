import { Box, Button, Chip, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import FlagIcon from '@mui/icons-material/Flag';
import PendingIcon from '@mui/icons-material/Pending';

const STATUS_LABELS = {
  completed: 'Completada',
  'in-progress': 'En curso',
  available: 'Disponible',
  locked: 'Bloqueada'
};

const STATUS_COLOR = {
  completed: 'success',
  'in-progress': 'warning',
  available: 'info',
  locked: 'default'
};

const STATUS_ICON = {
  completed: <AssignmentTurnedInIcon fontSize="small" />,
  'in-progress': <PendingIcon fontSize="small" />,
  available: <FlagIcon fontSize="small" />
};

export default function MissionStatusList({ missions = [], onFocusMission }) {
  if (!missions.length) {
    return (
      <Box px={2} py={1}>
        <Typography variant="body2" color="text.secondary">
          Este mapa no tiene misiones activas. Explora otros sectores o revisa el registro de eventos.
        </Typography>
      </Box>
    );
  }

  return (
    <List dense>
      {missions.map((mission) => {
        const status = mission.status ?? 'available';
        const label = STATUS_LABELS[status] ?? status;
        const chipColor = STATUS_COLOR[status] ?? 'default';
        const icon = STATUS_ICON[status] ?? null;

        return (
          <ListItem key={mission.id} alignItems="flex-start" divider>
            <ListItemText
              primary={mission.title}
              secondary={
                <>
                  <Typography component="span" variant="body2" color="text.secondary">
                    {mission.summary}
                  </Typography>
                  {mission.objectives?.length ? (
                    <Stack
                      component="ul"
                      spacing={0.5}
                      sx={{ pl: 2, mt: 1, listStyleType: 'disc' }}
                    >
                      {mission.objectives.map((objective) => (
                        <Typography component="li" variant="caption" color="text.secondary" key={objective}>
                          {objective}
                        </Typography>
                      ))}
                    </Stack>
                  ) : null}
                </>
              }
              secondaryTypographyProps={{ component: 'div' }}
            />
            <Stack spacing={1} alignItems="flex-end">
              <Chip size="small" label={label} color={chipColor} icon={icon} variant={status === 'locked' ? 'outlined' : 'filled'} />
              {mission.rewards?.length ? (
                <Typography variant="caption" color="text.secondary">
                  Recompensas: {mission.rewards.join(', ')}
                </Typography>
              ) : null}
              {onFocusMission ? (
                <Button size="small" variant="text" onClick={() => onFocusMission(mission)}>
                  Ver detalles
                </Button>
              ) : null}
            </Stack>
          </ListItem>
        );
      })}
    </List>
  );
}
