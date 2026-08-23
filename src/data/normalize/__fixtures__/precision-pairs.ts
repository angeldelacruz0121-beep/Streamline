/**
 * Precision pairs, verbatim from the wire.
 *
 * Both excerpts are cut unedited out of the filer's own XBRL instance, captured
 * through the proxy (decision 0010: a fixture built from a guess validates the
 * guess). Nothing here is typed by hand — the root declarations, the context,
 * the unit and the facts are the filer's characters, with only the unrelated
 * body of the document removed.
 *
 * Each pair is a concept the filer tagged twice at two precisions, and each one
 * refused an entire 10-K before `rounding-is-not-contradiction-v1` and
 * `inf-decimals-is-exact-not-unknown-v1`. Neither concept is a segment figure.
 */

/**
 * ServiceNow, CIK 0001373715, accession 0001373715-26-000007, 10-K FY2025.
 * https://www.sec.gov/Archives/edgar/data/1373715/000137371526000007/now-20251231_htm.xml
 *
 * `CommonStockSharesOutstanding` in context c-4: 1,047,278,000 at `decimals="INF"`
 * (f-124) beside 1,047,000,000 at `decimals="-6"` (f-861). A cover-page share
 * count, rounded in one place and exact in another.
 *
 * `CommonStockSharesAuthorized` is the second half of the defect: both facts say
 * 3,000,000,000, one exactly and one to the hundred million, and the old reading
 * of `INF` as "unknown" let the coarser fact overwrite the exact one.
 */
export const NOW_PRECISION_EXCERPT = String.raw`<xbrl
  xml:lang="en-US"
  xmlns="http://www.xbrl.org/2003/instance"
  xmlns:country="http://xbrl.sec.gov/country/2025"
  xmlns:cyd="http://xbrl.sec.gov/cyd/2025"
  xmlns:dei="http://xbrl.sec.gov/dei/2025"
  xmlns:ecd="http://xbrl.sec.gov/ecd/2025"
  xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
  xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:now="http://www.servicenow.com/20251231"
  xmlns:srt="http://fasb.org/srt/2025"
  xmlns:stpr="http://xbrl.sec.gov/stpr/2025"
  xmlns:us-gaap="http://fasb.org/us-gaap/2025"
  xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<context id="c-4">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0001373715</identifier>
        </entity>
        <period>
            <instant>2025-12-31</instant>
        </period>
    </context>
<unit id="shares">
        <measure>shares</measure>
    </unit>
<us-gaap:CommonStockSharesOutstanding contextRef="c-4" decimals="INF" id="f-124" unitRef="shares">1047278000</us-gaap:CommonStockSharesOutstanding>
<us-gaap:CommonStockSharesOutstanding contextRef="c-4" decimals="-6" id="f-861" unitRef="shares">1047000000</us-gaap:CommonStockSharesOutstanding>
<us-gaap:CommonStockSharesAuthorized contextRef="c-4" decimals="INF" id="f-120" unitRef="shares">3000000000</us-gaap:CommonStockSharesAuthorized>
<us-gaap:CommonStockSharesAuthorized contextRef="c-4" decimals="-8" id="f-859" unitRef="shares">3000000000</us-gaap:CommonStockSharesAuthorized>
</xbrl>`;

/**
 * IBM, CIK 0000051143, accession 0000051143-26-000010, 10-K FY2025.
 * https://www.sec.gov/Archives/edgar/data/51143/000005114326000010/ibm-20251231_htm.xml
 *
 * `EffectiveIncomeTaxRateContinuingOperations` in context c-57 (FY2023 comparative):
 * 0.14 at `decimals="2"` (f-1399) beside 0.135 at `decimals="3"` (f-1406). 0.135
 * rounds to 0.14, so the filing says one thing — but `|0.14 - 0.135|` is
 * 0.0050000000000000044 in binary floating point, 4.34e-18 outside the +/-0.005
 * envelope, and that discarded IBM's entire 10-K.
 */
export const IBM_PRECISION_EXCERPT = String.raw`<xbrl
  xml:lang="en-US"
  xmlns="http://www.xbrl.org/2003/instance"
  xmlns:country="http://xbrl.sec.gov/country/2025"
  xmlns:currency="http://xbrl.sec.gov/currency/2025"
  xmlns:cyd="http://xbrl.sec.gov/cyd/2025"
  xmlns:dei="http://xbrl.sec.gov/dei/2025"
  xmlns:ecd="http://xbrl.sec.gov/ecd/2025"
  xmlns:exch="http://xbrl.sec.gov/exch/2025"
  xmlns:ibm="http://www.ibm.com/20251231"
  xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
  xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:srt="http://fasb.org/srt/2025"
  xmlns:us-gaap="http://fasb.org/us-gaap/2025"
  xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<context id="c-57">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000051143</identifier>
        </entity>
        <period>
            <startDate>2023-01-01</startDate>
            <endDate>2023-12-31</endDate>
        </period>
    </context>
<unit id="number">
        <measure>pure</measure>
    </unit>
<us-gaap:EffectiveIncomeTaxRateContinuingOperations contextRef="c-57" decimals="2" id="f-1399" unitRef="number">0.14</us-gaap:EffectiveIncomeTaxRateContinuingOperations>
<us-gaap:EffectiveIncomeTaxRateContinuingOperations contextRef="c-57" decimals="3" id="f-1406" unitRef="number">0.135</us-gaap:EffectiveIncomeTaxRateContinuingOperations>
</xbrl>`;
