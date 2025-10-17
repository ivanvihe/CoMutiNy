import { useState } from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';

import AdminUserTable from './AdminUserTable.jsx';
import AssetManager from './AssetManager.jsx';

const tabConfig = [
  { value: 'users', label: 'Usuarios', component: <AdminUserTable /> },
  { value: 'sprites', label: 'Sprites', component: <AssetManager kind="sprite" /> },
  { value: 'landscapes', label: 'Paisajes', component: <AssetManager kind="landscape" /> }
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('users');

  const activeTab = tabConfig.find((item) => item.value === tab) ?? tabConfig[0];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 3,
        border: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(18, 18, 18, 0.9)'
      }}
    >
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Panel de administración
      </Typography>

      <Tabs
        value={activeTab.value}
        onChange={(_, value) => setTab(value)}
        sx={{ mb: 3 }}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        {tabConfig.map((item) => (
          <Tab key={item.value} value={item.value} label={item.label} />
        ))}
      </Tabs>

      <Box>{activeTab.component}</Box>
    </Paper>
  );
}
