import { prepareCsv } from './parseCsv';
import { parseOfx } from './parseOfx';
import type { LoadedFile } from './types';
import { decodeBuffer } from './util';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 1000;

export async function loadStatementFile(file: File): Promise<LoadedFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Arquivo maior que 5 MB. Exporte um período menor.');
  const text = decodeBuffer(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  const looksOfx = /OFXHEADER|<OFX>/i.test(text.slice(0, 5000)) || /\.(ofx|qfx)$/.test(name);
  if (looksOfx) return { kind: 'ofx', statement: parseOfx(text) };
  return { kind: 'csv', prepared: prepareCsv(text) };
}

export { extractCsvRows } from './parseCsv';
export { buildReview } from './dedupe';
export type * from './types';
