import { Route, Routes } from 'react-router-dom';
import EmisoraHome from './pages/EmisoraHome';
import EmisoraOperacion from './pages/EmisoraOperacion';
import EmisoraOperacionE3 from './pages/EmisoraOperacionE3';
import EmisoraOperacionE4 from './pages/EmisoraOperacionE4';

/** Subrouter montado bajo /emisora/* dentro del shell autenticado. */
export default function EmisoraRoutes() {
  return (
    <Routes>
      <Route index element={<EmisoraHome />} />
      <Route path="operacion" element={<EmisoraOperacion />} />
      <Route path="operacion-e3" element={<EmisoraOperacionE3 />} />
      <Route path="operacion-e4" element={<EmisoraOperacionE4 />} />
      {/* Las agrupaciones aún no implementadas siguen mostrando la landing. */}
      <Route path="*" element={<EmisoraHome />} />
    </Routes>
  );
}
