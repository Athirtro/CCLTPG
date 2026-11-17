import React from 'react';
import { Box, Paper, Typography, Avatar } from '@mui/material';
import { Dashboard, School, People, Assignment } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

function IconWrapper({ icon }: { icon: React.ReactElement }) {
  return <Avatar sx={{ bgcolor: 'primary.main' }}>{icon}</Avatar>;
}

export default function Home() {
  const { user } = useAuth();

  const cards = [
    { title: 'Mis matrículas', icon: <Assignment fontSize="large" />, route: '/matriculas' },
    { title: 'Programas', icon: <School fontSize="large" />, route: '/programas' },
    { title: 'Estudiantes', icon: <People fontSize="large" />, route: '/estudiantes' },
    { title: 'Panel', icon: <Dashboard fontSize="large" />, route: '/dashboard' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Bienvenido, {user?.fullName ?? 'usuario'}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {cards.map((card) => (
          <Box key={card.title} sx={{ xs: 12, sm: 6, md: 3, p: 1 }}>
            <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
              <IconWrapper icon={card.icon} />
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {card.title}
              </Typography>
            </Paper>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
