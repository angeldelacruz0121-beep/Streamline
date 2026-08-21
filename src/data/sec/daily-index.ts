/**
 * Parser for EDGAR's daily index files.
 *
 * There are three renderings of the same day's feed and they are **not** the same
 * format. This mattered: the parser previously treated all three as
 * pipe-delimited, which is true only of `master.idx`. `form.idx` and
 * `company.idx` are fixed-width, so every row failed the delimiter check and a
 * live 861 KB index parsed to zero records while still reporting success.
 * Verified live against 2026-08-19 (2026-08-20).
 *
 *   master.idx   `CIK|Company Name|Form Type|Date Filed|File Name`, pipe-delimited.
 *   form.idx     fixed width: form type in columns [0, 17), then company name,
 *                CIK, date and file name separated by runs of spaces.
 *   company.idx  fixed width: company name in columns [0, 62), then form type,
 *                CIK, date and file name.
 *
 * The header block is terminated by a dashed rule in all three. Dates in the body
 * are `YYYYMMDD` and are normalised here to the ISO `YYYY-MM-DD` the submissions
 * index uses, so one date format leaves this layer.
 *
 * Rows that do not parse are counted, never dropped silently: a feed that stops
 * parsing must be distinguishable from a day on which nothing was filed
 * (Invariant 2.2). `client.ts` turns "data present, nothing parsed" into a typed
 * `schema-mismatch` rather than an empty success.
 *
 * This is a filing manifest - form codes, CIKs, dates, paths. No financial
 * content passes through here.
 */
import type { DailyIndexKind } from './endpoints.ts';

export interface DailyIndexRecord {
  readonly form: string;
  readonly companyName: string;
  readonly cik: string;
  /** ISO `YYYY-MM-DD`, normalised from the feed's `YYYYMMDD`. */
  readonly filingDate: string;
  /** Path relative to the archive root, e.g. `edgar/data/789019/....txt`. */
  readonly fileName: string;
  readonly accession: string | null;
}

export interface DailyIndexParse {
  readonly records: readonly DailyIndexRecord[];
  /** Body lines past the header rule that produced no record. */
  readonly malformedRows: number;
}

/**
 * Width of the leading fixed-width field, measured from the live files on
 * 2026-08-20. Absent for `master`, which is delimited rather than aligned.
 */
const LEADING_FIELD_WIDTH: Readonly<Record<DailyIndexKind, number | null>> = {
  master: null,
  form: 17,
  company: 62,
};

/** `<free text> <cik> <yyyymmdd> <path>` - the tail every fixed-width row ends with. */
const FIXED_WIDTH_TAIL = /^(.*?)\s+(\d{1,10})\s+(\d{8})\s+(\S+)\s*$/;

const MASTER_COLUMNS = ['cik', 'company', 'form', 'date', 'file'] as const;

const ACCESSION_IN_PATH = /(\d{10}-\d{2}-\d{6})\.txt$/;

/** `20260819` -> `2026-08-19`. Anything already ISO, or unrecognised, passes through. */
function isoDate(raw: string): string {
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);

  return compact === null ? raw : `${compact[1]}-${compact[2]}-${compact[3]}`;
}

function record(
  form: string,
  companyName: string,
  cik: string,
  filingDate: string,
  fileName: string,
): DailyIndexRecord {
  return {
    form,
    companyName,
    cik,
    filingDate: isoDate(filingDate),
    fileName,
    accession: ACCESSION_IN_PATH.exec(fileName)?.[1] ?? null,
  };
}

function parseMasterRow(line: string): DailyIndexRecord | null {
  const cells = line.split('|').map((cell) => cell.trim());

  if (cells.length < MASTER_COLUMNS.length) return null;

  const byName = new Map(MASTER_COLUMNS.map((name, index) => [name, cells[index] ?? '']));
  const cik = byName.get('cik') ?? '';
  const fileName = byName.get('file') ?? '';

  if (cik.length === 0 || fileName.length === 0) return null;

  return record(
    byName.get('form') ?? '',
    byName.get('company') ?? '',
    cik,
    byName.get('date') ?? '',
    fileName,
  );
}

function parseFixedWidthRow(
  line: string,
  width: number,
  kind: 'form' | 'company',
): DailyIndexRecord | null {
  const leading = line.slice(0, width).trim();
  const tail = FIXED_WIDTH_TAIL.exec(line.slice(width));

  if (leading.length === 0 || tail === null) return null;

  const [, middle, cik, date, fileName] = tail as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];
  const trimmedMiddle = middle.trim();

  if (trimmedMiddle.length === 0) return null;

  return kind === 'form'
    ? record(leading, trimmedMiddle, cik, date, fileName)
    : record(trimmedMiddle, leading, cik, date, fileName);
}

/** Parses one daily index file. `kind` is required because the formats differ. */
export function parseDailyIndexDetailed(text: string, kind: DailyIndexKind): DailyIndexParse {
  const width = LEADING_FIELD_WIDTH[kind];
  const records: DailyIndexRecord[] = [];
  let malformedRows = 0;
  let inBody = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (!inBody) {
      if (/^-{5,}$/.test(line.trim())) inBody = true;
      continue;
    }

    if (line.trim().length === 0) continue;

    const parsed =
      width === null
        ? parseMasterRow(line)
        : parseFixedWidthRow(line, width, kind as 'form' | 'company');

    if (parsed === null) {
      malformedRows += 1;
      continue;
    }

    records.push(parsed);
  }

  return { records, malformedRows };
}

/** Records only. Callers that must distinguish "empty day" from "stopped parsing"
 * use `parseDailyIndexDetailed`. */
export function parseDailyIndex(text: string, kind: DailyIndexKind): readonly DailyIndexRecord[] {
  return parseDailyIndexDetailed(text, kind).records;
}
