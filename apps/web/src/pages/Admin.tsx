import { Box, Button } from '@mui/material';
import {
  AdminPanelSettings as AdminPanelSettingsIcon,
  Home as HomeIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import EmptyState from '../components/common/EmptyState';

export default function Admin() {
  const { hasPermission } = useAuth();
  const puedeGestionar = hasPermission('identity:user:manage');

  const cabecera = (
    <PageHeader
      title="Administración"
      description="Espacio reservado a la gestión de usuarios y permisos del centro cultural."
      icon={<AdminPanelSettingsIcon />}
      breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Administración' }]}
      actions={
        <Button component={RouterLink} to="/" startIcon={<HomeIcon />}>
          Ir al inicio
        </Button>
      }
    />
  );

  return (
    <Box>
      {cabecera}

      {!puedeGestionar ? (
        <EmptyState
          title="Sin permisos"
          description="No tienes permiso para acceder a la administración de usuarios (identity:user:manage)."
          icon={<AdminPanelSettingsIcon />}
        />
      ) : (
        <SectionCard
          title="Usuarios"
          subtitle="No se muestra información de usuarios porque el contrato actual no ofrece un listado."
        >
          <EmptyState
            title="El contrato actual no dispone de un endpoint para listar usuarios"
            description="Esta sección permanecerá vacía hasta que la API publique un endpoint de consulta de usuarios. No se muestran registros inventados."
            icon={<PeopleIcon />}
          />
        </SectionCard>
      )}
    </Box>
  );
}
