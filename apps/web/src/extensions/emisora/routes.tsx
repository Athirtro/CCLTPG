import { Route, Routes } from 'react-router-dom';
import EmisoraHome from './pages/EmisoraHome';

/** Subrouter montado bajo /emisora/* dentro del shell autenticado. */
export default function EmisoraRoutes() {
  return (
    <Routes>
      <Route index element={<EmisoraHome />} />
      {/* Mientras no haya funcionalidad de negocio, cualquier subruta muestra la landing. */}
      <Route path="*" element={<EmisoraHome />} />
    </Routes>
  );
}
