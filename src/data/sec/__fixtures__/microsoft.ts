/**
 * Captured, not composed.
 *
 * Every value below was taken from a live EDGAR response on 2026-08-20 and
 * trimmed, never typed out from what the schema expected. The previous version of
 * this file was hand-authored from the same assumption `schemas.ts` encoded -
 * that submissions carries `entityName` - so 120 passing tests validated the
 * guess rather than the service, and the first real request failed. Capturing is
 * the fix: a fixture that came from the wire cannot agree with a schema the wire
 * disagrees with.
 *
 * Invariant 4.5 still holds, and nothing here weakens it. There is not one
 * financial figure in this file. The numbers that do appear are byte sizes, film
 * numbers and row counts - filing metadata, not reported amounts. Identifiers,
 * dates and file names are real because they are real.
 *
 * Decision 0009: the daily-index header block on the wire carries
 * `Comments: <an sec.gov address>`. That line is redacted below, since 0009
 * forbids any email address in any committed file. The redaction is inside the
 * header block, which every parser skips, so it cannot change a parse result.
 *
 * Sources, each fetched once:
 *   https://data.sec.gov/submissions/CIK0000789019.json
 *   https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/index.json
 *   https://www.sec.gov/files/company_tickers.json
 *   https://www.sec.gov/Archives/edgar/daily-index/2026/QTR3/{master,form,company}.20260819.idx
 */

export const MICROSOFT_CIK = '0000789019';
export const MICROSOFT_SIC = '7372';
export const MICROSOFT_10K_ACCESSION = '0001193125-26-323660';
export const MICROSOFT_10K_FILING_DATE = '2026-07-29';
export const MICROSOFT_10K_PERIOD_END = '2026-06-30';
/** As EDGAR spells it on the submissions document's `name` field. */
export const MICROSOFT_ENTITY_NAME = 'MICROSOFT CORP';
/**
 * As EDGAR spells it on companyfacts and companyconcept's `entityName` field.
 * The two endpoints disagree about the filer's own name, which is a fact worth a
 * constant rather than a surprise later.
 */
export const MICROSOFT_FACTS_ENTITY_NAME = 'MICROSOFT CORPORATION';

/**
 * `https://data.sec.gov/submissions/CIK0000789019.json`, captured 2026-08-20.
 *
 * Trimmed two ways: scalar fields carrying no structural information were
 * dropped (addresses, phone, ein, lei, flags, the website fields), and
 * `filings.recent` keeps 4 of the 1001 real rows - the FY2026 10-K and the three
 * 10-Qs before it. Every column EDGAR sends is kept at full width, including
 * `isXBRLNumeric`, whose nulls are why it is declared nullable in `schemas.ts`.
 */
export const microsoftSubmissions = {
  cik: '0000789019',
  entityType: 'operating',
  sic: MICROSOFT_SIC,
  sicDescription: 'Services-Prepackaged Software',
  ownerOrg: '06 Technology',
  name: MICROSOFT_ENTITY_NAME,
  tickers: ['MSFT'],
  exchanges: ['Nasdaq'],
  category: 'Large accelerated filer',
  fiscalYearEnd: '0630',
  stateOfIncorporation: 'WA',
  formerNames: [],
  filings: {
    recent: {
      accessionNumber: [
        MICROSOFT_10K_ACCESSION,
        '0001193125-26-191507',
        '0001193125-26-027207',
        '0001193125-25-256321',
      ],
      filingDate: [MICROSOFT_10K_FILING_DATE, '2026-04-29', '2026-01-28', '2025-10-29'],
      reportDate: [MICROSOFT_10K_PERIOD_END, '2026-03-31', '2025-12-31', '2025-09-30'],
      acceptanceDateTime: [
        '2026-07-29T20:08:01.000Z',
        '2026-04-29T20:06:24.000Z',
        '2026-01-28T21:07:34.000Z',
        '2025-10-29T20:10:48.000Z',
      ],
      act: ['34', '34', '34', '34'],
      form: ['10-K', '10-Q', '10-Q', '10-Q'],
      fileNumber: ['001-37845', '001-37845', '001-37845', '001-37845'],
      filmNumber: ['261217433', '26915896', '26572527', '251430079'],
      items: ['', '', '', ''],
      core_type: ['XBRL', 'XBRL', 'XBRL', 'XBRL'],
      size: [36328553, 31304294, 30063042, 24565853],
      isXBRL: [1, 1, 1, 1],
      isInlineXBRL: [1, 1, 1, 1],
      isXBRLNumeric: [1, 1, null, null],
      primaryDocument: [
        'msft-20260630.htm',
        'msft-20260331.htm',
        'msft-20251231.htm',
        'msft-20250930.htm',
      ],
      primaryDocDescription: ['10-K', '10-Q', '10-Q', '10-Q'],
    },
    files: [
      {
        name: 'CIK0000789019-submissions-001.json',
        filingCount: 2000,
        filingFrom: '2008-05-16',
        filingTo: '2020-04-28',
      },
      {
        name: 'CIK0000789019-submissions-002.json',
        filingCount: 1481,
        filingFrom: '1994-02-14',
        filingTo: '2008-05-14',
      },
    ],
  },
};

/**
 * `/Archives/edgar/data/789019/000119312526323660/index.json`, captured 2026-08-20.
 *
 * 7 of the 133 real entries, chosen to cover every artifact `archiveInventory`
 * looks for. Note the hyphenated keys - `parent-dir`, `last-modified` - and that
 * `size` is a string, both of which the previous hand-written fixture got wrong.
 * `type` is an icon file name, not a form type.
 */
export const microsoftFilingIndex = {
  directory: {
    item: [
      {
        'last-modified': '2026-07-29 16:08:01',
        name: '0001193125-26-323660-index.html',
        type: 'text.gif',
        size: '',
      },
      {
        'last-modified': '2026-07-29 16:08:01',
        name: 'msft-20260630.htm',
        type: 'text.gif',
        size: '8585501',
      },
      {
        'last-modified': '2026-07-29 16:08:01',
        name: 'msft-20260630_htm.xml',
        type: 'text.gif',
        size: '10948157',
      },
      {
        'last-modified': '2026-07-29 16:08:01',
        name: 'FilingSummary.xml',
        type: 'text.gif',
        size: '68644',
      },
      {
        'last-modified': '2026-07-29 16:08:01',
        name: 'MetaLinks.json',
        type: 'text.gif',
        size: '1601396',
      },
      { 'last-modified': '2026-07-29 16:08:01', name: 'R1.htm', type: 'text.gif', size: '84012' },
      { 'last-modified': '2026-07-29 16:08:01', name: 'R2.htm', type: 'text.gif', size: '89716' },
    ],
    name: '/Archives/edgar/data/789019/000119312526323660',
    'parent-dir': '/Archives/edgar/data/789019',
  },
};

/**
 * `https://www.sec.gov/files/company_tickers.json`, captured 2026-08-20. One of
 * 10387 real entries, at its real key. `cik_str` is an unpadded number here,
 * where submissions sends the padded string.
 */
export const tickerMap = {
  '3': { cik_str: 789019, ticker: 'MSFT', title: MICROSOFT_ENTITY_NAME },
};

/**
 * `master.20260819.idx`, captured 2026-08-20: header block plus the first three
 * real rows. Pipe-delimited, `CIK|Company Name|Form Type|Date Filed|File Name`,
 * dates as `YYYYMMDD`.
 */
export const dailyIndexMasterText = [
  'Description:           Daily Index of EDGAR Dissemination Feed',
  'Last Data Received:    Aug 19, 2026',
  'Comments:              [redacted - decision 0009]',
  'Anonymous FTP:         ftp://ftp.sec.gov/edgar/',
  ' ',
  'CIK|Company Name|Form Type|Date Filed|File Name',
  '--------------------------------------------------------------------------------',
  '1000275|ROYAL BANK OF CANADA|424B2|20260819|edgar/data/1000275/0000950103-26-012581.txt',
  '1000275|ROYAL BANK OF CANADA|424B2|20260819|edgar/data/1000275/0000950103-26-012594.txt',
  '1000275|ROYAL BANK OF CANADA|424B2|20260819|edgar/data/1000275/0000950103-26-012601.txt',
].join('\n');

/**
 * `form.20260819.idx`, captured 2026-08-20. Fixed width, not delimited - this is
 * the file the old pipe-splitting parser silently produced zero records from.
 * Column widths are load-bearing, so these rows are byte-for-byte as served
 * (trailing padding included).
 *
 * Row 4 is `SEC STAFF ACTIO` - EDGAR's own truncation of a 15-character form type
 * inside the 17-wide field, the tightest real case for the column boundary. Row 5
 * is a form type containing a space.
 */
export const dailyIndexFormText = [
  'Description:           Daily Index of EDGAR Dissemination Feed by Form Type',
  'Last Data Received:    Aug 19, 2026',
  'Comments:              [redacted - decision 0009]',
  'Anonymous FTP:         ftp://ftp.sec.gov/edgar/',
  ' ',
  ' ',
  ' ',
  ' ',
  'Form Type   Company Name                                                  CIK',
  '      Date Filed  File Name',
  '---------------------------------------------------------------------------------------------------------------------------------------------',
  '1-A/A            Casa Shares Assets, LLC                                       1988874     20260819    edgar/data/1988874/0001493152-26-039081.txt                                                ',
  '1/A              Cboe BYX Exchange, Inc.                                       1476530     20260817    edgar/data/1476530/9999999997-26-001384.txt                                                ',
  'SEC STAFF ACTIO  HUTURE Group Ltd                                              2041045     20260819    edgar/data/2041045/9999999997-26-001386.txt                                                ',
  'DEF 14A          ADVENT CONVERTIBLE & INCOME FUND                              1219120     20260819    edgar/data/1219120/0001821268-26-000147.txt                                                ',
].join('\n');

/**
 * `company.20260819.idx`, captured 2026-08-20. Fixed width with the company name
 * in the leading field instead of the form type - the reason the parser cannot
 * sniff the format and must be told which file it is reading.
 *
 * Row 3 carries a 60-character company name, the tightest real case for the
 * 62-column boundary. Row 4 is an `NT 10-Q/A`: a late-filing notification that is
 * itself an amendment.
 */
export const dailyIndexCompanyText = [
  'Description:           Daily Index of EDGAR Dissemination Feed by Company Name',
  'Last Data Received:    Aug 19, 2026',
  'Comments:              [redacted - decision 0009]',
  'Anonymous FTP:         ftp://ftp.sec.gov/edgar/',
  ' ',
  ' ',
  ' ',
  ' ',
  'Company Name                                                  Form Type   CIK',
  '      Date Filed  File Name',
  '-------------------------------------------------------------------------------------------------------------------------------------------------',
  '1290 Funds                                                    485APOS          1605941     20260819    edgar/data/1605941/0001193125-26-356419.txt',
  '1607 Capital Partners, LLC                                    N-PX             1436866     20260819    edgar/data/1436866/0001172661-26-003853.txt',
  'Encompass Health Rehabilitation Hospital of Albuquerque, LLC  S-3ASR           1501700     20260819    edgar/data/1501700/0000785161-26-000205.txt',
  'Lodging Fund REIT III, Inc.                                   NT 10-Q/A        1745032     20260819    edgar/data/1745032/0001104659-26-098712.txt',
].join('\n');

/**
 * Kept as the default daily-index fixture so existing callers keep meaning what
 * they meant. It is now the `master` rendering, which is the client's default.
 */
export const dailyIndexText = dailyIndexMasterText;
