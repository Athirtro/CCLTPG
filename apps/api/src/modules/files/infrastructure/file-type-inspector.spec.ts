import { describe, expect, it } from 'vitest';

import { AppError } from '../../../shared/errors/app-error.js';
import { FileTypeInspector } from './file-type-inspector.js';

/**
 * AC-SEC-27 y compuerta 3: el MIME declarado no basta; se contrasta con bytes
 * mágicos y con la extensión antes de aceptar el archivo.
 */

const inspector = new FileTypeInspector();

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'ascii');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d]),
  Buffer.from('IHDR', 'ascii'),
  Buffer.alloc(8),
]);
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(16)]);

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function codeOf(run: Promise<unknown>): Promise<string> {
  const error = await run.then(
    () => null,
    (failure: unknown) => failure,
  );
  expect(error).toBeInstanceOf(AppError);
  return (error as AppError).code;
}

describe('inspección por bytes mágicos de archivos', () => {
  it('acepta PDF y PNG coherentes con su extensión', async () => {
    await expect(inspector.inspect(PDF, 'application/pdf', 'reporte.pdf')).resolves.toEqual({
      detectedMime: 'application/pdf',
      mime: 'application/pdf',
    });

    await expect(inspector.inspect(PNG, 'image/png', 'imagen.png')).resolves.toEqual({
      detectedMime: 'image/png',
      mime: 'image/png',
    });
  });

  it('rechaza un cuerpo vacío', async () => {
    await expect(
      codeOf(inspector.inspect(Buffer.alloc(0), 'application/pdf', 'x.pdf')),
    ).resolves.toBe('FILE_EMPTY');
  });

  it('rechaza MIME fuera de la lista blanca aunque la extensión parezca válida', async () => {
    await expect(codeOf(inspector.inspect(PDF, 'text/plain', 'x.pdf'))).resolves.toBe(
      'FILE_MIME_NOT_ALLOWED',
    );
  });

  it('rechaza una extensión que no corresponde al MIME declarado', async () => {
    await expect(codeOf(inspector.inspect(PDF, 'application/pdf', 'x.png'))).resolves.toBe(
      'FILE_MIME_MISMATCH',
    );
  });

  it('rechaza un MIME falsificado: PNG declarado como PDF', async () => {
    await expect(codeOf(inspector.inspect(PNG, 'application/pdf', 'x.pdf'))).resolves.toBe(
      'FILE_MIME_MISMATCH',
    );
  });

  it('acepta DOCX/XLSX como contenedores ZIP con firma local', async () => {
    await expect(inspector.inspect(ZIP, DOCX, 'acta.docx')).resolves.toMatchObject({ mime: DOCX });
    await expect(inspector.inspect(ZIP, XLSX, 'notas.xlsx')).resolves.toMatchObject({ mime: XLSX });
  });

  it('rechaza un DOCX que no es ZIP', async () => {
    await expect(codeOf(inspector.inspect(PDF, DOCX, 'acta.docx'))).resolves.toBe(
      'FILE_MIME_MISMATCH',
    );
  });
});
