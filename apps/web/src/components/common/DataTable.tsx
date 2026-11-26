import type { ReactNode } from 'react';
import {
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';

export type DataTableColumn<T> = {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  minWidth?: number;
};

type Props<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  ariaLabel: string;
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  ariaLabel,
  loading = false,
  emptyMessage = 'No hay datos disponibles.',
  page = 0,
  pageSize = 10,
  total,
  onPageChange,
  onPageSizeChange,
}: Props<T>) {
  const conPaginacion = typeof total === 'number';

  return (
    <>
      {loading && rows.length > 0 && <LinearProgress sx={{ mb: 1 }} aria-label="Actualizando datos" />}
      <TableContainer>
        <Table size="small" aria-label={ariaLabel}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  sx={{ minWidth: column.minWidth, whiteSpace: 'nowrap' }}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 5 }}>
                  <Typography variant="body2" color="text.secondary" role="status">
                    Cargando información…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 5 }}>
                  <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={rowKey(row)} hover>
                  {columns.map((column) => (
                    <TableCell key={column.id} align={column.align}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {conPaginacion && (
        <TablePagination
          component="div"
          count={total ?? 0}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_event, nextPage) => onPageChange?.(nextPage)}
          onRowsPerPageChange={(event) => onPageSizeChange?.(Number(event.target.value))}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
          rowsPerPageOptions={[5, 10, 25]}
        />
      )}
    </>
  );
}
