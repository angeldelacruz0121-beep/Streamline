/**
 * Reads `FilingSummary.xml` - EDGAR's index of the rendered reports inside one
 * accession - for one question only: does this filing restate the financial
 * statements, or does it correct something else?
 *
 * EDGAR renders every filing into numbered reports (`R1.htm` upward) and files
 * each under a menu category: `Cover`, `Statements`, `Notes`, `Policies`,
 * `Tables`, `Details`. The category is EDGAR's own classification, not ours, and
 * it separates the two kinds of correction cleanly. HP's FY2022 restatement
 * lists seven `Statements` reports (`Consolidated Statements of Earnings` among
 * them). HP's FY2019 correction lists one report, category `Cover`. No
 * threshold, no byte size, no guess - a filing either publishes a financial
 * statement or it does not.
 *
 * No figure is read here and none could be: this file sees report titles and
 * categories, never the reports themselves. What a number means stays with the
 * Financial Data Analyst.
 */
import { XMLParser } from 'fast-xml-parser';

/** EDGAR's menu category for a rendered financial statement. */
const STATEMENTS_CATEGORY = 'Statements';

export interface FilingSummaryReports {
  /** Every report title, filing order. */
  readonly titles: readonly string[];
  /** Titles EDGAR filed under `Statements`. Non-empty means the financials are restated. */
  readonly statements: readonly string[];
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

interface ReportNode {
  readonly ShortName?: unknown;
  readonly LongName?: unknown;
  readonly MenuCategory?: unknown;
}

function asArray(value: unknown): readonly unknown[] {
  if (value === undefined || value === null) return [];

  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Throws rather than returning an empty result when the document plainly
 * contains reports the parse did not produce.
 *
 * Decision 0010's parser gate: a parser that turns a non-empty payload into zero
 * records and reports success is the silent gap Invariant 2.2 exists to forbid.
 * Here it would be worse than a gap - zero reports reads as "this correction
 * restates nothing", which would send a reader back to a withdrawn number.
 */
export function statementReports(xml: string): FilingSummaryReports {
  const document = parser.parse(xml) as {
    readonly FilingSummary?: { readonly MyReports?: unknown };
  };
  const myReports = document.FilingSummary?.MyReports;
  const nodes = asArray((myReports as { readonly Report?: unknown } | undefined)?.Report);
  const titles: string[] = [];
  const statements: string[] = [];

  for (const node of nodes) {
    if (typeof node !== 'object' || node === null) continue;

    const report = node as ReportNode;
    const title = text(report.ShortName) || text(report.LongName);

    if (title.length > 0) titles.push(title);
    if (text(report.MenuCategory) === STATEMENTS_CATEGORY) statements.push(title);
  }

  if (titles.length === 0 && xml.includes('<MenuCategory>')) {
    throw new Error(
      'FilingSummary.xml lists reports but none could be read. Refusing to report zero ' +
        'reports for a document that plainly has them - that would read as "this correction ' +
        'restates nothing" and send a reader back to a superseded figure.',
    );
  }

  return { titles, statements };
}
