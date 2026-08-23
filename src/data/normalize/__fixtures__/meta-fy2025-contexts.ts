/**
 * Meta's segment contexts, verbatim from the wire.
 *
 * Cut unedited out of the filer's own instance, captured through the proxy
 * (decision 0010). Meta Platforms, CIK 0001326801, accession 0001628280-26-003942,
 * 10-K FY2025, period 2025-01-01 -> 2025-12-31.
 * https://www.sec.gov/Archives/edgar/data/1326801/000162828026003942/meta-20251231_htm.xml
 *
 * Meta is the clearest case of the shape that refused nine filers: it tags a
 * clean total for each of its two reportable segments (c-63, c-66) *and* cuts
 * those same segments by `srt:ProductOrServiceAxis` (c-57, c-60). Refusing the
 * filing because some context is sliced threw away two complete, unambiguous
 * segment totals.
 */
export const META_SEGMENT_CONTEXTS_EXCERPT = String.raw`<xbrl
  xml:lang="en-US"
  xmlns="http://www.xbrl.org/2003/instance"
  xmlns:country="http://xbrl.sec.gov/country/2025"
  xmlns:cyd="http://xbrl.sec.gov/cyd/2025"
  xmlns:dei="http://xbrl.sec.gov/dei/2025"
  xmlns:ecd="http://xbrl.sec.gov/ecd/2025"
  xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
  xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:meta="http://www.facebook.com/20251231"
  xmlns:srt="http://fasb.org/srt/2025"
  xmlns:us-gaap="http://fasb.org/us-gaap/2025"
  xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<context id="c-63">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0001326801</identifier>
            <segment>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">meta:FamilyOfAppsMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2025-01-01</startDate>
            <endDate>2025-12-31</endDate>
        </period>
    </context>
<context id="c-66">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0001326801</identifier>
            <segment>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">meta:RealityLabsMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2025-01-01</startDate>
            <endDate>2025-12-31</endDate>
        </period>
    </context>
<context id="c-57">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0001326801</identifier>
            <segment>
                <xbrldi:explicitMember dimension="srt:ProductOrServiceAxis">us-gaap:AdvertisingMember</xbrldi:explicitMember>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">meta:FamilyOfAppsMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2025-01-01</startDate>
            <endDate>2025-12-31</endDate>
        </period>
    </context>
<context id="c-60">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0001326801</identifier>
            <segment>
                <xbrldi:explicitMember dimension="srt:ProductOrServiceAxis">us-gaap:ServiceOtherMember</xbrldi:explicitMember>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">meta:FamilyOfAppsMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2025-01-01</startDate>
            <endDate>2025-12-31</endDate>
        </period>
    </context>
<unit id="usd">
        <measure>iso4217:USD</measure>
    </unit>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-63" decimals="-6" id="f-446" unitRef="usd">198759000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
<us-gaap:GoodwillAcquiredDuringPeriod contextRef="c-63" decimals="-6" id="f-831" unitRef="usd">3697000000</us-gaap:GoodwillAcquiredDuringPeriod>
<us-gaap:GoodwillOtherIncreaseDecrease contextRef="c-63" decimals="-6" id="f-834" unitRef="usd">85000000</us-gaap:GoodwillOtherIncreaseDecrease>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-63" decimals="-6" id="f-1268" unitRef="usd">198759000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
<us-gaap:LaborAndRelatedExpense contextRef="c-63" decimals="-6" id="f-1271" unitRef="usd">39943000000</us-gaap:LaborAndRelatedExpense>
<us-gaap:OtherCostAndExpenseOperating contextRef="c-63" decimals="-6" id="f-1274" unitRef="usd">56347000000</us-gaap:OtherCostAndExpenseOperating>
<us-gaap:OperatingIncomeLoss contextRef="c-63" decimals="-6" id="f-1277" unitRef="usd">102469000000</us-gaap:OperatingIncomeLoss>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-66" decimals="-6" id="f-449" unitRef="usd">2207000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
<us-gaap:GoodwillAcquiredDuringPeriod contextRef="c-66" decimals="-6" id="f-832" unitRef="usd">99000000</us-gaap:GoodwillAcquiredDuringPeriod>
<us-gaap:GoodwillOtherIncreaseDecrease contextRef="c-66" decimals="-6" id="f-835" unitRef="usd">-1000000</us-gaap:GoodwillOtherIncreaseDecrease>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-66" decimals="-6" id="f-1280" unitRef="usd">2207000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
<us-gaap:LaborAndRelatedExpense contextRef="c-66" decimals="-6" id="f-1283" unitRef="usd">10759000000</us-gaap:LaborAndRelatedExpense>
<us-gaap:OtherCostAndExpenseOperating contextRef="c-66" decimals="-6" id="f-1286" unitRef="usd">10641000000</us-gaap:OtherCostAndExpenseOperating>
<us-gaap:OperatingIncomeLoss contextRef="c-66" decimals="-6" id="f-1289" unitRef="usd">-19193000000</us-gaap:OperatingIncomeLoss>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-57" decimals="-6" id="f-440" unitRef="usd">196175000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-60" decimals="-6" id="f-443" unitRef="usd">2584000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
</xbrl>`;
