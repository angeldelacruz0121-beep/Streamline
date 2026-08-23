/**
 * Captured, not composed. HP Inc. (CIK 0000047217, SIC 3570 - inside the D7
 * coverage band), the amendment case.
 *
 * Microsoft has no amendment in thirty-three years of EDGAR history, which is
 * why decision 0011 gap 1 recorded amendment handling as unproven. HP is the
 * answer to that gap, and it is a better answer than one filer usually is: HP
 * has filed three 10-K/A amendments and they are three genuinely different
 * cases, all real, none constructed.
 *
 *   FY2022  original 0000047217-22-000068 (2022-12-06)
 *           amendment 0000047217-23-000075 (2023-09-11), 145 rendered reports,
 *           7 of them financial statements. A full restatement. The amendment
 *           is what a reader must see.
 *   FY2019  original 0000047217-19-000071 (2019-12-12)
 *           amendment 0001206774-20-000632 (2020-02-27), ONE rendered report
 *           and it is the cover page. Its base taxonomy is dei only - no
 *           us-gaap at all. Carries no financial statement, so it corrects
 *           nothing a figure could come from.
 *   FY2017  original 0000047217-17-000043 (2017-12-14) with NO XBRL exhibit
 *           at all, and amendment 0000047217-17-000045 filed the next day
 *           carrying 135 reports. Here the amendment is the only readable copy
 *           of the year.
 *
 * Note what the submissions flags do NOT tell you: the FY2019 cover-only
 * amendment is marked isInlineXBRL = 1, exactly like the FY2022 full
 * restatement. Cover-page tagging has been mandatory since 2019, so every
 * amendment carries some XBRL. The flag cannot separate 'restated the
 * financials' from 'added a signature page', which is why selection reads the
 * filing's own report index rather than trusting the flag.
 *
 * Invariant 4.5 holds. There is no financial figure in this file. Accessions,
 * form codes, dates, byte sizes, file names and report titles are real because
 * they must be real to test the parsing. Decision 0010: captured through the
 * proxy on 8787 so the User-Agent and the 10/s budget held.
 *
 * Sources, each fetched once on 2026-08-23:
 *   https://data.sec.gov/submissions/CIK0000047217.json  (10-K family rows only)
 *   .../Archives/edgar/data/47217/000120677420000632/FilingSummary.xml
 *   .../Archives/edgar/data/47217/000004721723000075/FilingSummary.xml  (first 3 reports)
 */

export const HP_CIK = '0000047217';
export const HP_SIC = '3570';
/** As EDGAR spells it on the submissions document's `name` field. */
export const HP_ENTITY_NAME = 'HP INC';
export const HP_FILER_CATEGORY = 'Large accelerated filer';

/** The year a reader would be shown a withdrawn number for, before this change. */
export const HP_FY2022_PERIOD = '2022-10-31';
export const HP_FY2022_ORIGINAL = '0000047217-22-000068';
export const HP_FY2022_AMENDMENT = '0000047217-23-000075';

/** The year whose amendment corrects nothing a figure could come from. */
export const HP_FY2019_PERIOD = '2019-10-31';
export const HP_FY2019_ORIGINAL = '0000047217-19-000071';
export const HP_FY2019_COVER_ONLY_AMENDMENT = '0001206774-20-000632';

/** The year where the amendment is the only copy carrying XBRL at all. */
export const HP_FY2017_PERIOD = '2017-10-31';
export const HP_FY2017_ORIGINAL_WITHOUT_XBRL = '0000047217-17-000043';
export const HP_FY2017_AMENDMENT = '0000047217-17-000045';

/** The most recent annual period. No amendment - which is why nothing renders differently. */
export const HP_LATEST_PERIOD = '2025-10-31';
export const HP_LATEST_ACCESSION = '0000047217-25-000071';

/**
 * EDGAR's own parallel arrays, verbatim, narrowed to the 10-K family rows.
 * Column order is EDGAR's; the rows are newest-first as EDGAR returns them.
 */
export const HP_10K_FILING_COLUMNS = {
  accessionNumber: [
    '0000047217-25-000071',
    '0000047217-24-000080',
    '0000047217-23-000100',
    '0000047217-23-000075',
    '0000047217-22-000068',
    '0000047217-21-000060',
    '0000047217-20-000045',
    '0001206774-20-000632',
    '0000047217-19-000071',
    '0000047217-18-000052',
    '0000047217-17-000045',
    '0000047217-17-000043',
    '0000047217-16-000093',
  ],
  filingDate: [
    '2025-12-10',
    '2024-12-13',
    '2023-12-18',
    '2023-09-11',
    '2022-12-06',
    '2021-12-09',
    '2020-12-10',
    '2020-02-27',
    '2019-12-12',
    '2018-12-13',
    '2017-12-15',
    '2017-12-14',
    '2016-12-15',
  ],
  reportDate: [
    '2025-10-31',
    '2024-10-31',
    '2023-10-31',
    '2022-10-31',
    '2022-10-31',
    '2021-10-31',
    '2020-10-31',
    '2019-10-31',
    '2019-10-31',
    '2018-10-31',
    '2017-10-31',
    '2017-10-31',
    '2016-10-31',
  ],
  acceptanceDateTime: [
    '2025-12-10T22:22:18.000Z',
    '2024-12-13T01:31:46.000Z',
    '2023-12-16T02:31:21.000Z',
    '2023-09-11T21:08:38.000Z',
    '2022-12-06T22:03:42.000Z',
    '2021-12-09T21:46:38.000Z',
    '2020-12-10T21:12:57.000Z',
    '2020-02-27T21:16:50.000Z',
    '2019-12-12T21:26:03.000Z',
    '2018-12-13T21:07:39.000Z',
    '2017-12-15T01:57:22.000Z',
    '2017-12-14T21:27:00.000Z',
    '2016-12-15T21:44:36.000Z',
  ],
  form: [
    '10-K',
    '10-K',
    '10-K',
    '10-K/A',
    '10-K',
    '10-K',
    '10-K',
    '10-K/A',
    '10-K',
    '10-K',
    '10-K/A',
    '10-K',
    '10-K',
  ],
  primaryDocument: [
    'hpq-20251031.htm',
    'hpq-20241031.htm',
    'hpq-20231031.htm',
    'hpq-20221031.htm',
    'hpq-20221031.htm',
    'hpq-20211031.htm',
    'hpq-20201031.htm',
    'hpq3726921-10ka.htm',
    'hp-103119x10k.htm',
    'hp-103118x10k.htm',
    'hp-103117x10ka.htm',
    'hp-103117x10k1.htm',
    'hp-103116x10k1.htm',
  ],
  isXBRL: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  isInlineXBRL: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  isXBRLNumeric: [null, null, null, null, null, null, null, null, null, null, null, null, null],
  items: ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  size: [
    20855082, 20453459, 21415067, 22105913, 23288513, 23295714, 23426134, 2910923, 27887031,
    24932328, 25514400, 4662712, 26626067,
  ],
};

/**
 * `FilingSummary.xml` from the FY2019 cover-only amendment, whole but for the
 * ninety-odd scanned-signature JPEGs in `SupplementalFiles`. One report, and
 * its menu category is Cover.
 */
export const HP_FY2019_AMENDMENT_FILING_SUMMARY =
  '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<FilingSummary>\n  <Version>3.19.3.a.u2</Version>\n  <ProcessingTime/>\n  <ReportFormat>html</ReportFormat>\n  <ContextCount>3</ContextCount>\n  <ElementCount>95</ElementCount>\n  <EntityCount>1</EntityCount>\n  <FootnotesReported>false</FootnotesReported>\n  <SegmentCount>0</SegmentCount>\n  <ScenarioCount>0</ScenarioCount>\n  <TuplesReported>false</TuplesReported>\n  <UnitCount>3</UnitCount>\n  <MyReports>\n    <Report instance="hpq3726921-10ka.htm">\n      <IsDefault>false</IsDefault>\n      <HasEmbeddedReports>false</HasEmbeddedReports>\n      <HtmlFileName>R1.htm</HtmlFileName>\n      <LongName>00000001 - Document - Cover</LongName>\n      <ReportType>Sheet</ReportType>\n      <Role>http://hp.com/role/Cover</Role>\n      <ShortName>Cover</ShortName>\n      <MenuCategory>Cover</MenuCategory>\n      <Position>1</Position>\n    </Report>\n    <Report>\n      <IsDefault>false</IsDefault>\n      <HasEmbeddedReports>false</HasEmbeddedReports>\n      <LongName>All Reports</LongName>\n      <ReportType>Book</ReportType>\n      <ShortName>All Reports</ShortName>\n    </Report>\n  </MyReports>\n  <InputFiles>\n    <File doctype="10-K/A" original="hpq3726921-10ka.htm">hpq3726921-10ka.htm</File>\n    <File>hpq-20191031.xsd</File>\n    <File>hpq-20191031_lab.xml</File>\n    <File>hpq-20191031_pre.xml</File>\n    <File>hpq3726921-ex311.htm</File>\n    <File>hpq3726921-ex312.htm</File>\n  </InputFiles>\n  <BaseTaxonomies>\n    <BaseTaxonomy>http://xbrl.sec.gov/dei/2019-01-31</BaseTaxonomy>\n  </BaseTaxonomies>\n  <HasPresentationLinkbase>true</HasPresentationLinkbase>\n  <HasCalculationLinkbase>false</HasCalculationLinkbase>\n</FilingSummary>\n';

/**
 * `FilingSummary.xml` from the FY2022 full restatement, trimmed to its first
 * three reports. The third is a financial statement, which is the fact
 * selection turns on; the other 142 reports change nothing about the test.
 */
export const HP_FY2022_AMENDMENT_FILING_SUMMARY =
  '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<FilingSummary>\n  <Version>3.23.2</Version>\n  <ProcessingTime/>\n  <ReportFormat>html</ReportFormat>\n  <ContextCount>795</ContextCount>\n  <ElementCount>677</ElementCount>\n  <EntityCount>1</EntityCount>\n  <FootnotesReported>false</FootnotesReported>\n  <SegmentCount>168</SegmentCount>\n  <ScenarioCount>0</ScenarioCount>\n  <TuplesReported>false</TuplesReported>\n  <UnitCount>13</UnitCount>\n  <MyReports>\n    <Report instance="hpq-20221031.htm">\n      <IsDefault>false</IsDefault>\n      <HasEmbeddedReports>false</HasEmbeddedReports>\n      <HtmlFileName>R1.htm</HtmlFileName>\n      <LongName>0000001 - Document - Cover Page</LongName>\n      <ReportType>Sheet</ReportType>\n      <Role>http://www.hp.com/role/CoverPage</Role>\n      <ShortName>Cover Page</ShortName>\n      <MenuCategory>Cover</MenuCategory>\n      <Position>1</Position>\n    </Report>\n    <Report instance="hpq-20221031.htm">\n      <IsDefault>false</IsDefault>\n      <HasEmbeddedReports>false</HasEmbeddedReports>\n      <HtmlFileName>R2.htm</HtmlFileName>\n      <LongName>0000002 - Document - Audit Information</LongName>\n      <ReportType>Sheet</ReportType>\n      <Role>http://www.hp.com/role/AuditInformation</Role>\n      <ShortName>Audit Information</ShortName>\n      <MenuCategory>Cover</MenuCategory>\n      <Position>2</Position>\n    </Report>\n    <Report instance="hpq-20221031.htm">\n      <IsDefault>false</IsDefault>\n      <HasEmbeddedReports>false</HasEmbeddedReports>\n      <HtmlFileName>R3.htm</HtmlFileName>\n      <LongName>0000003 - Statement - Consolidated Statements of Earnings</LongName>\n      <ReportType>Sheet</ReportType>\n      <Role>http://www.hp.com/role/ConsolidatedStatementsofEarnings</Role>\n      <ShortName>Consolidated Statements of Earnings</ShortName>\n      <MenuCategory>Statements</MenuCategory>\n      <Position>3</Position>\n    </Report>\n  </MyReports>\n</FilingSummary>\n';

/**
 * `index.json` for the FY2022 restatement, trimmed to the files the inventory
 * reads: the instance, the report index, MetaLinks and the first rendered
 * reports. 165 items on the wire; the other 158 are exhibits and images.
 */
export const HP_FY2022_AMENDMENT_ARCHIVE_INDEX = {
  directory: {
    item: [
      {
        'last-modified': '2023-09-11 17:08:38',
        name: 'FilingSummary.xml',
        type: 'text.gif',
        size: '93351',
      },
      {
        'last-modified': '2023-09-11 17:08:38',
        name: 'hpq-20221031.xsd',
        type: 'text.gif',
        size: '125900',
      },
      {
        'last-modified': '2023-09-11 17:08:38',
        name: 'hpq-20221031_htm.xml',
        type: 'text.gif',
        size: '5063929',
      },
      {
        'last-modified': '2023-09-11 17:08:38',
        name: 'MetaLinks.json',
        type: 'text.gif',
        size: '1612181',
      },
      {
        'last-modified': '2023-09-11 17:08:38',
        name: 'R1.htm',
        type: 'text.gif',
        size: '69915',
      },
      {
        'last-modified': '2023-09-11 17:08:38',
        name: 'R2.htm',
        type: 'text.gif',
        size: '7801',
      },
      {
        'last-modified': '2023-09-11 17:08:38',
        name: 'R3.htm',
        type: 'text.gif',
        size: '82406',
      },
    ],
    name: '/Archives/edgar/data/47217/000004721723000075',
    'parent-dir': '/Archives/edgar/data/47217',
  },
};

/**
 * `index.json` for the FY2019 cover-only correction, trimmed the same way. Note
 * that it has an instance document and a report index like any other filing -
 * the archive listing alone cannot tell you it restates nothing. Its one
 * rendered report is what tells you.
 */
export const HP_FY2019_AMENDMENT_ARCHIVE_INDEX = {
  directory: {
    item: [
      {
        'last-modified': '2020-02-27 16:16:50',
        name: 'FilingSummary.xml',
        type: 'text.gif',
        size: '5443',
      },
      {
        'last-modified': '2020-02-27 16:16:50',
        name: 'hpq-20191031.xsd',
        type: 'text.gif',
        size: '3165',
      },
      {
        'last-modified': '2020-02-27 16:16:50',
        name: 'hpq3726921-10ka_htm.xml',
        type: 'text.gif',
        size: '7312',
      },
      {
        'last-modified': '2020-02-27 16:16:50',
        name: 'MetaLinks.json',
        type: 'text.gif',
        size: '38364',
      },
      {
        'last-modified': '2020-02-27 16:16:50',
        name: 'R1.htm',
        type: 'text.gif',
        size: '64203',
      },
    ],
    name: '/Archives/edgar/data/47217/000120677420000632',
    'parent-dir': '/Archives/edgar/data/47217',
  },
};

/**
 * The submissions document as EDGAR sends it, narrowed to HP's 10-K family.
 *
 * Identity fields are the wire's own values. `filings.recent` is
 * `HP_10K_FILING_COLUMNS` - the thirteen 10-K rows out of the 1002 filings HP
 * has on the recent page - and `filings.files` is HP's real overflow listing,
 * kept because it is what makes `historyTruncated` true for this filer.
 */
export const hpSubmissions = {
  cik: '0000047217',
  entityType: 'operating',
  sic: '3570',
  sicDescription: 'Computer & office Equipment',
  ownerOrg: '06 Technology',
  name: 'HP INC',
  tickers: ['HPQ'],
  exchanges: ['NYSE'],
  category: 'Large accelerated filer',
  fiscalYearEnd: '1031',
  stateOfIncorporation: 'DE',
  formerNames: [
    {
      name: 'HEWLETT PACKARD CO',
      from: '1994-01-26T05:00:00.000Z',
      to: '2015-10-23T04:00:00.000Z',
    },
  ],
  filings: {
    recent: HP_10K_FILING_COLUMNS,
    files: [
      {
        name: 'CIK0000047217-submissions-001.json',
        filingCount: 2000,
        filingFrom: '2002-03-26',
        filingTo: '2016-10-31',
      },
      {
        name: 'CIK0000047217-submissions-002.json',
        filingCount: 611,
        filingFrom: '1994-01-21',
        filingTo: '2002-03-24',
      },
    ],
  },
};
