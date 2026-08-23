/**
 * Apple's segment contexts, verbatim from the wire.
 *
 * Cut unedited out of the filer's own instance, captured through the proxy
 * (decision 0010). Apple, CIK 0000320193, accession 0000320193-25-000079,
 * 10-K FY2025, period 2024-09-29 -> 2025-09-27.
 * https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927_htm.xml
 *
 * Every one of Apple's five segment contexts carries `srt:ConsolidationItemsAxis`
 * = `us-gaap:OperatingSegmentsMember` alongside `us-gaap:StatementBusinessSegmentsAxis`.
 * That companion axis is in the `srt` namespace, which is why the allowlist that
 * was supposed to accept it could never fire, and why Apple was refused.
 *
 * The facts are the five segments' revenue, cost of sales, selling and marketing
 * and operating income, plus the undimensioned required context.
 */
export const AAPL_SEGMENT_CONTEXTS_EXCERPT = String.raw`<xbrl
  xml:lang="en-US"
  xmlns="http://www.xbrl.org/2003/instance"
  xmlns:aapl="http://www.apple.com/20250927"
  xmlns:country="http://xbrl.sec.gov/country/2025"
  xmlns:cyd="http://xbrl.sec.gov/cyd/2025"
  xmlns:dei="http://xbrl.sec.gov/dei/2025"
  xmlns:ecd="http://xbrl.sec.gov/ecd/2025"
  xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
  xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:srt="http://fasb.org/srt/2025"
  xmlns:us-gaap="http://fasb.org/us-gaap/2025"
  xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<context id="c-149">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000320193</identifier>
            <segment>
                <xbrldi:explicitMember dimension="srt:ConsolidationItemsAxis">us-gaap:OperatingSegmentsMember</xbrldi:explicitMember>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">aapl:AmericasSegmentMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2024-09-29</startDate>
            <endDate>2025-09-27</endDate>
        </period>
    </context>
<context id="c-150">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000320193</identifier>
            <segment>
                <xbrldi:explicitMember dimension="srt:ConsolidationItemsAxis">us-gaap:OperatingSegmentsMember</xbrldi:explicitMember>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">aapl:EuropeSegmentMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2024-09-29</startDate>
            <endDate>2025-09-27</endDate>
        </period>
    </context>
<context id="c-151">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000320193</identifier>
            <segment>
                <xbrldi:explicitMember dimension="srt:ConsolidationItemsAxis">us-gaap:OperatingSegmentsMember</xbrldi:explicitMember>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">aapl:GreaterChinaSegmentMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2024-09-29</startDate>
            <endDate>2025-09-27</endDate>
        </period>
    </context>
<context id="c-152">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000320193</identifier>
            <segment>
                <xbrldi:explicitMember dimension="srt:ConsolidationItemsAxis">us-gaap:OperatingSegmentsMember</xbrldi:explicitMember>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">aapl:JapanSegmentMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2024-09-29</startDate>
            <endDate>2025-09-27</endDate>
        </period>
    </context>
<context id="c-153">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000320193</identifier>
            <segment>
                <xbrldi:explicitMember dimension="srt:ConsolidationItemsAxis">us-gaap:OperatingSegmentsMember</xbrldi:explicitMember>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">aapl:RestOfAsiaPacificSegmentMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2024-09-29</startDate>
            <endDate>2025-09-27</endDate>
        </period>
    </context>
<context id="c-1">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000320193</identifier>
        </entity>
        <period>
            <startDate>2024-09-29</startDate>
            <endDate>2025-09-27</endDate>
        </period>
    </context>
<unit id="usd">
        <measure>iso4217:USD</measure>
    </unit>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-149" decimals="-6" id="f-1016" unitRef="usd">178353000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
<us-gaap:CostOfGoodsAndServicesSold contextRef="c-149" decimals="-6" id="f-1022" unitRef="usd">95699000000</us-gaap:CostOfGoodsAndServicesSold>
<us-gaap:SellingAndMarketingExpense contextRef="c-149" decimals="-6" id="f-1030" unitRef="usd">10174000000</us-gaap:SellingAndMarketingExpense>
<us-gaap:OperatingIncomeLoss contextRef="c-149" decimals="-6" id="f-1038" unitRef="usd">72480000000</us-gaap:OperatingIncomeLoss>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-150" decimals="-6" id="f-1017" unitRef="usd">111032000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
<us-gaap:CostOfGoodsAndServicesSold contextRef="c-150" decimals="-6" id="f-1023" unitRef="usd">58617000000</us-gaap:CostOfGoodsAndServicesSold>
<us-gaap:SellingAndMarketingExpense contextRef="c-150" decimals="-6" id="f-1031" unitRef="usd">4676000000</us-gaap:SellingAndMarketingExpense>
<us-gaap:OperatingIncomeLoss contextRef="c-150" decimals="-6" id="f-1039" unitRef="usd">47739000000</us-gaap:OperatingIncomeLoss>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-151" decimals="-6" id="f-1018" unitRef="usd">64377000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
<us-gaap:CostOfGoodsAndServicesSold contextRef="c-151" decimals="-6" id="f-1024" unitRef="usd">35141000000</us-gaap:CostOfGoodsAndServicesSold>
<us-gaap:SellingAndMarketingExpense contextRef="c-151" decimals="-6" id="f-1032" unitRef="usd">2319000000</us-gaap:SellingAndMarketingExpense>
<us-gaap:OperatingIncomeLoss contextRef="c-151" decimals="-6" id="f-1040" unitRef="usd">26917000000</us-gaap:OperatingIncomeLoss>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-152" decimals="-6" id="f-1019" unitRef="usd">28703000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
<us-gaap:CostOfGoodsAndServicesSold contextRef="c-152" decimals="-6" id="f-1025" unitRef="usd">13779000000</us-gaap:CostOfGoodsAndServicesSold>
<us-gaap:SellingAndMarketingExpense contextRef="c-152" decimals="-6" id="f-1033" unitRef="usd">969000000</us-gaap:SellingAndMarketingExpense>
<us-gaap:OperatingIncomeLoss contextRef="c-152" decimals="-6" id="f-1041" unitRef="usd">13955000000</us-gaap:OperatingIncomeLoss>
<us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax contextRef="c-153" decimals="-6" id="f-1020" unitRef="usd">33696000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
<us-gaap:CostOfGoodsAndServicesSold contextRef="c-153" decimals="-6" id="f-1026" unitRef="usd">17724000000</us-gaap:CostOfGoodsAndServicesSold>
<us-gaap:SellingAndMarketingExpense contextRef="c-153" decimals="-6" id="f-1034" unitRef="usd">1386000000</us-gaap:SellingAndMarketingExpense>
<us-gaap:OperatingIncomeLoss contextRef="c-153" decimals="-6" id="f-1042" unitRef="usd">14586000000</us-gaap:OperatingIncomeLoss>
</xbrl>`;
