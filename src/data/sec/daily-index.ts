/**
 * Parser for EDGAR's daily index files. Fixed-width-ish, pipe-delimited, with a
 * header block terminated by a dashed rule. Column order differs by file kind,
 * which is why the kind is required rather than sniffed.
 *
 * This is a filing manifest - form codes, CIKs, dates, paths. No financial
 * content passes through here.
 */
import type { DailyIndexKind } from './endpoints.ts';

export interface DailyIndexRecord {
  readonly form: string;
  readonly companyName: string;
  readonly cik: string;
  readonly filingDate: string;
  /** Path relative to the archive root, e.g. `edgar/data/789019/....txt`. */
  readonly fileName: string;
  readonly accession: string | null;
}

const COLUMN_ORDER: Readonly<
  Record<DailyIndexKind, readonly ['form' | 'company' | 'cik', ...string[]]>
> = {
  form: ['form', 'company', 'cik', 'date', 'file'],
  company: ['company', 'form', 'cik', 'date', 'file'],
  master: ['cik', 'company', 'form', 'date', 'file'],
};

const ACCESSION_IN_PATH = /(\d{10}-\d{2}-\d{6})\.txt$/;

export function parseDailyIndex(text: string, kind: DailyIndexKind): readonly DailyIndexRecord[] {
  const order = COLUMN_ORDER[kind];
  const records: DailyIndexRecord[] = [];
  let inBody = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0) continue;

    if (!inBody) {
      if (/^-{5,}$/.test(line)) inBody = true;
      continue;
    }

    const cells = line.split('|').map((cell) => cell.trim());

    if (cells.length < 5) continue;

    const byName = new Map(order.map((name, index) => [name, cells[index] ?? '']));
    const fileName = byName.get('file') ?? '';

    records.push({
      form: byName.get('form') ?? '',
      companyName: byName.get('company') ?? '',
      cik: byName.get('cik') ?? '',
      filingDate: byName.get('date') ?? '',
      fileName,
      accession: ACCESSION_IN_PATH.exec(fileName)?.[1] ?? null,
    });
  }

  return records;
}
