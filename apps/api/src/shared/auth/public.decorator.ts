import { SetMetadata } from '@nestjs/common';

/**
 * Marca una ruta como pública en la lista blanca de autorización.
 * En C1 no hay guard todavía; el decorador deja preparada la allowlist que C2
 * validará contra el OpenAPI (control C-14).
 */
export const PUBLIC_ROUTE_KEY = 'ccltpg:public-route';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_ROUTE_KEY, true);
