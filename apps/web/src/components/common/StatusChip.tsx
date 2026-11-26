import { Chip } from '@mui/material';
import { statusTones, type StatusTone } from '../../theme/palette';

/** Un mismo estado conserva siempre el mismo color en toda la aplicación. */
const ESTADOS: Record<string, { label: string; tone: StatusTone }> = {
  activo: { label: 'Activo', tone: 'success' },
  activa: { label: 'Activa', tone: 'success' },
  inactivo: { label: 'Inactivo', tone: 'neutral' },
  pendiente: { label: 'Pendiente', tone: 'warning' },
  aprobado: { label: 'Aprobado', tone: 'success' },
  rechazado: { label: 'Rechazado', tone: 'error' },
  abierto: { label: 'Abierto', tone: 'success' },
  cerrado: { label: 'Cerrado', tone: 'neutral' },
  presente: { label: 'Presente', tone: 'success' },
  ausente: { label: 'Ausente', tone: 'error' },
  tarde: { label: 'Tarde', tone: 'warning' },
  excusa: { label: 'Excusa', tone: 'info' },
  preinscrita: { label: 'Preinscrita', tone: 'warning' },
  confirmada: { label: 'Confirmada', tone: 'success' },
  finalizada: { label: 'Finalizada', tone: 'info' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
  retirada: { label: 'Retirada', tone: 'neutral' },
  borrador: { label: 'Borrador', tone: 'neutral' },
  publicado: { label: 'Publicado', tone: 'success' },
  archivado: { label: 'Archivado', tone: 'neutral' },
  programada: { label: 'Programada', tone: 'info' },
  realizada: { label: 'Realizada', tone: 'success' },
  limpio: { label: 'Limpio', tone: 'success' },
  infectado: { label: 'Infectado', tone: 'error' },
  enviada: { label: 'Enviada', tone: 'info' },
  leida: { label: 'Leída', tone: 'success' },
  fallida: { label: 'Fallida', tone: 'error' },
  'sin consentimiento': { label: 'Sin consentimiento', tone: 'warning' },
};

type Props = {
  status: string;
  label?: string;
};

export default function StatusChip({ status, label }: Props) {
  const clave = status.trim().toLowerCase();
  const configuracion = ESTADOS[clave];
  const tono: StatusTone = configuracion?.tone ?? (statusTones[clave as StatusTone] ? (clave as StatusTone) : 'neutral');
  const texto = label ?? configuracion?.label ?? status;
  const colors = statusTones[tono];

  return (
    <Chip
      label={texto}
      size="small"
      sx={{ bgcolor: colors.bg, color: colors.text, '& .MuiChip-label': { px: 1.25 } }}
    />
  );
}
