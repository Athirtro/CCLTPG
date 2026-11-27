import { Route, Routes } from 'react-router-dom';
import EmisoraHome from './pages/EmisoraHome';
import EmisoraOperacion from './pages/EmisoraOperacion';

/** Subrouter montado bajo /emisora/* dentro del shell autenticado. */
export default function EmisoraRoutes() {
  return (
    <Routes>
      <Route index element={<EmisoraHome />} />
      <Route path="operacion" element={<EmisoraOperacion />} />
      {/* Las agrupaciones aún no implementadas siguen mostrando la landing. */}
      <Route path="*" element={<EmisoraHome />} />
    </Routes>
  );
}
