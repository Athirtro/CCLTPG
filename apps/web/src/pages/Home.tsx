import { Box, Paper, Typography, Avatar, Divider, Chip } from '@mui/material';
import { Dashboard, School, People, Assignment, Shield, Lock, Person, Schedule, BarChart } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

function IconWrapper({ icon }: { icon: React.ReactElement }) {
  return <Avatar sx={{ bgcolor: 'primary.main' }}><span>{icon}</span></Avatar>;
}

export default function Home() {
  const { user, hasPermission } = useAuth();

  const cards = [
    {
      title: 'Mis matrículas',
      icon: <Assignment fontSize="large" />,
      route: '/matriculas',
      requires: 'academic:enrollment:read_own',
    },
    {
      title: 'Programas',
      icon: <School fontSize="large" />,
      route: '/programas',
      requires: 'academic:program:manage',
    },
    {
      title: 'Estudiantes',
      icon: <People fontSize="large" />,
      route: '/estudiantes',
      requires: 'academic:student:manage',
    },
    {
      title: 'Grupos',
      icon: <School fontSize="large" />,
      route: '/grupos',
      requires: 'academic:group:manage',
    },
    {
      title: 'Administración',
      icon: <Shield fontSize="large" />,
      route: '/admin',
      requires: 'identity:user:manage',
    },
    {
      title: 'Mi horario',
      icon: <Schedule fontSize="large" />,
      route: '/mi-horario',
      requires: 'academic:schedule:read_own',
    },
    {
      title: 'Mis evaluaciones',
      icon: <BarChart fontSize="large" />,
      route: '/mis-evaluaciones',
      requires: 'academic:evaluation:read_own',
    },
    {
      title: 'Vista educador',
      icon: <Shield fontSize="large" />,
      route: '/vista-educador',
      requires: 'academic:attendance:create',
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" gutterBottom sx={{ mb: 3 }}>
        Bienvenido, {user?.fullName ?? 'usuario'}
      </Typography>

      {user && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
            Tu perfil
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ xs: 12, sm: 6, md: 3, p: 1 }}>
              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar component="div"><span><Person /></span></Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Correo
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {user.email}
                  </Typography>
                </Box>
              </Paper>
            </Box>
            <Box sx={{ xs: 12, sm: 6, md: 3, p: 1 }}>
              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar component="div" sx={{ bgcolor: 'secondary.main' }}><span><Shield /></span></Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Perfil activo
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {user.role}
                  </Typography>
                </Box>
              </Paper>
            </Box>
            <Box sx={{ xs: 12, sm: 6, md: 3, p: 1 }}>
              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar component="div" sx={{ bgcolor: 'warning.main' }}><span><Lock /></span></Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    MFA
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {user.mfaEnabled ? 'Activado' : 'No activado'}
                  </Typography>
                </Box>
              </Paper>
            </Box>
            <Box sx={{ xs: 12, sm: 6, md: 3, p: 1 }}>
              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar component="div" sx={{ bgcolor: 'info.main' }}><span><Dashboard /></span></Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Permisos
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {user.permissions.length}
                  </Typography>
                </Box>
              </Paper>
            </Box>
          </Box>
          <Divider sx={{ mt: 2, mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {user.profiles.map((p) => (
              <Chip key={p} label={p} size="small" />
            ))}
          </Box>
        </Box>
      )}

      <Typography variant="h2" gutterBottom sx={{ mb: 2 }}>
        Accesos rápidos
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {cards
          .filter((card) => !card.requires || hasPermission(card.requires))
          .map((card) => (
            <Box key={card.title} sx={{ xs: 12, sm: 6, md: 3, p: 1 }}>
              <Paper
                sx={{
                  p: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  height: '100%',
                }}
              >
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
