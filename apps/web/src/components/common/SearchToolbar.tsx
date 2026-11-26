import type { ReactNode } from 'react';
import { Box, InputAdornment, TextField } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  filters?: ReactNode;
  resultCount?: number;
};

export default function SearchToolbar({
  value,
  onChange,
  label = 'Buscar',
  placeholder,
  filters,
  resultCount,
}: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.5,
        mb: 2,
      }}
    >
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ flex: '1 1 260px', maxWidth: { sm: 360 } }}
      />
      {filters}
      {typeof resultCount === 'number' && (
        <Box component="span" sx={{ ml: 'auto', color: 'text.secondary', fontSize: '0.8125rem' }}>
          {resultCount} resultado{resultCount === 1 ? '' : 's'}
        </Box>
      )}
    </Box>
  );
}
