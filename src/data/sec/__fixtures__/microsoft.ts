/**
 * Invariant 4.5. Every value in this file is a verified fact about a real
 * filing - CIK, SIC, accession, filing date, period end - independently checked
 * against EDGAR before it was written down. There is not one financial figure
 * here, invented or otherwise: transport tests need identifiers and dates, and
 * nothing else. A dollar amount in a fixture is exactly the kind of seeded demo
 * number 4.5 exists to keep out of the repository.
 */

export const MICROSOFT_CIK = '0000789019';
export const MICROSOFT_SIC = '7372';
export const MICROSOFT_10K_ACCESSION = '0001193125-26-323660';
export const MICROSOFT_10K_FILING_DATE = '2026-07-29';
export const MICROSOFT_10K_PERIOD_END = '2026-06-30';

/** Shape of `https://data.sec.gov/submissions/CIK0000789019.json`, verified fields only. */
export const microsoftSubmissions = {
  cik: '789019',
  entityName: 'MICROSOFT CORP',
  sic: MICROSOFT_SIC,
  sicDescription: 'Services-Prepackaged Software',
  tickers: ['MSFT'],
  exchanges: ['Nasdaq'],
  fiscalYearEnd: '0630',
  filings: {
    recent: {
      accessionNumber: [MICROSOFT_10K_ACCESSION],
      filingDate: [MICROSOFT_10K_FILING_DATE],
      reportDate: [MICROSOFT_10K_PERIOD_END],
      acceptanceDateTime: [`${MICROSOFT_10K_FILING_DATE}T16:05:00.000Z`],
      form: ['10-K'],
      primaryDocument: ['msft-20260630.htm'],
      isXBRL: [1],
      isInlineXBRL: [1],
      items: [''],
      size: [0],
    },
    files: [],
  },
};

/** Shape of `https://www.sec.gov/files/company_tickers.json`. */
export const tickerMap = {
  '0': { cik_str: 789019, ticker: 'MSFT', title: 'MICROSOFT CORP' },
};

/**
 * Shape of a `form.YYYYMMDD.idx` daily index. The one row restates the same
 * verified filing: a 10-K accepted on 2026-07-29 under CIK 789019.
 */
export const dailyIndexText = [
  'Description:           Daily Index of EDGAR Dissemination Feed',
  `Last Data Received:    July 29, 2026`,
  '',
  'Form Type|Company Name|CIK|Date Filed|File Name',
  '--------------------------------------------------------------------------------',
  `10-K|MICROSOFT CORP|789019|${MICROSOFT_10K_FILING_DATE}|edgar/data/789019/${MICROSOFT_10K_ACCESSION}.txt`,
].join('\n');
