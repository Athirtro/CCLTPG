import { applyDecorators, type Type } from '@nestjs/common';
import { ApiQuery, DECORATORS, type ApiQueryOptions } from '@nestjs/swagger';

/**
 * Expone los `@ApiProperty` de un DTO de consulta como parámetros `query` de
 * OpenAPI. El generador no usa el plugin CLI de Swagger, así que los DTOs de
 * `@Query()` deben documentarse explícitamente para que el contrato publicado
 * coincida con lo que el navegador realmente envía.
 */
export function ApiQueryParams(dto: Type<unknown>): ReturnType<typeof applyDecorators> {
  const prototype = dto.prototype as object;
  const keys = (Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, prototype) ??
    []) as string[];

  return applyDecorators(
    ...keys.map((key) => {
      const name = key.replace(/^:/, '');
      const metadata = (Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES, prototype, name) ??
        {}) as ApiQueryOptions;
      return ApiQuery({ ...metadata, name, required: metadata.required !== false });
    }),
  );
}
