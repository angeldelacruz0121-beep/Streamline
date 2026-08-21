/**
 * Invariant 4.5. These are shape probes, not data. They exist to exercise
 * structural code paths - amendment chains, late-filing notifications, period
 * gaps, an accession whose XBRL exhibit is incomplete - that no single real
 * filing exhibits all of.
 *
 * Key names and value types follow the live payloads (`name` not `entityName`,
 * `parent-dir` not `parentDir`, `size` as a string) so a probe cannot pass a
 * schema the real service would fail.
 *
 * Two rules keep them honest. Every identifier is deliberately zeroed
 * (`0000000000-00-00000X`, CIK `0000000000`) so nothing here can be mistaken for a claim
 * about a real filer, and there is not a single financial figure anywhere in
 * the file. They describe form codes and dates. Nothing else.
 */

/** Reserved by RFC 2606: never resolvable, never deliverable, never a real person. */
export const TEST_CONTACT_EMAIL = 'conduit-tests@example.invalid';

export const PROBE_CIK = '0000000000';
export const PROBE_ACCESSION_ORIGINAL = '0000000000-00-000001';
export const PROBE_ACCESSION_AMENDMENT = '0000000000-00-000002';
export const PROBE_ACCESSION_LATE_NOTICE = '0000000000-00-000003';
export const PROBE_ACCESSION_INCOMPLETE = '0000000000-00-000004';

/**
 * A period filed with an NT notification first, then the 10-K, then a 10-K/A;
 * a second period with no filing at all (the gap); a third period filed clean.
 */
export const probeSubmissions = {
  cik: '0000000000',
  name: 'SHAPE PROBE - NOT A FILER',
  sic: '0000',
  sicDescription: 'Structural probe',
  tickers: [],
  exchanges: [],
  fiscalYearEnd: '1231',
  filings: {
    recent: {
      accessionNumber: [
        PROBE_ACCESSION_AMENDMENT,
        PROBE_ACCESSION_ORIGINAL,
        PROBE_ACCESSION_LATE_NOTICE,
        '0000000000-00-000005',
      ],
      filingDate: ['2024-05-01', '2024-04-15', '2024-03-01', '2021-02-20'],
      reportDate: ['2023-12-31', '2023-12-31', '2023-12-31', '2020-12-31'],
      acceptanceDateTime: [
        '2024-05-01T17:00:00.000Z',
        '2024-04-15T17:00:00.000Z',
        '2024-03-01T17:00:00.000Z',
        '2021-02-20T17:00:00.000Z',
      ],
      form: ['10-K/A', '10-K', 'NT 10-K', '10-K'],
      primaryDocument: ['probe-a.htm', 'probe.htm', 'probe-nt.htm', 'probe-2020.htm'],
      isXBRL: [1, 1, 0, 1],
      isInlineXBRL: [0, 1, 0, 0],
      items: ['', '', '', ''],
      size: [0, 0, 0, 0],
    },
    files: [
      {
        name: 'CIK0000000000-submissions-001.json',
        filingCount: 1,
        filingFrom: '2019-01-01',
        filingTo: '2019-12-31',
      },
    ],
  },
};

/** The overflow slice: EDGAR serves these as the bare columnar object. */
export const probeSubmissionsOverflow = {
  accessionNumber: ['0000000000-00-000006'],
  filingDate: ['2019-02-20'],
  reportDate: ['2018-12-31'],
  acceptanceDateTime: ['2019-02-20T17:00:00.000Z'],
  form: ['10-K'],
  primaryDocument: ['probe-2018.htm'],
  isXBRL: [1],
  isInlineXBRL: [0],
  items: [''],
  size: [0],
};

/** An accession carrying everything a dimensional read needs. */
export const probeArchiveIndexComplete = {
  directory: {
    name: `/Archives/edgar/data/0/${PROBE_ACCESSION_ORIGINAL.replace(/-/g, '')}`,
    'parent-dir': '/Archives/edgar/data/0',
    item: [
      { name: 'probe.htm', type: 'text.gif', size: '0' },
      { name: 'probe-20231231_htm.xml', type: 'text.gif', size: '0' },
      { name: 'probe-20231231_cal.xml', type: 'text.gif', size: '0' },
      { name: 'probe-20231231_lab.xml', type: 'text.gif', size: '0' },
      { name: 'FilingSummary.xml', type: 'text.gif', size: '0' },
      { name: 'MetaLinks.json', type: 'text.gif', size: '0' },
      { name: 'R1.htm', type: 'text.gif', size: '0' },
      { name: 'R7.htm', type: 'text.gif', size: '0' },
    ],
  },
};

/** An accession with no XBRL exhibit at all - the incomplete case. */
export const probeArchiveIndexIncomplete = {
  directory: {
    name: `/Archives/edgar/data/0/${PROBE_ACCESSION_INCOMPLETE.replace(/-/g, '')}`,
    'parent-dir': '/Archives/edgar/data/0',
    item: [{ name: 'probe-paper.htm', type: 'text.gif', size: '0' }],
  },
};
