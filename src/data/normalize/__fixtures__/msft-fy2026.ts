/**
 * Captured, not composed. Decision 0010.
 *
 * Every character below was taken from the live EDGAR response for Microsoft's
 * FY2026 Form 10-K on 2026-08-20 and trimmed. Nothing here was typed out from
 * what a schema expected, and nothing was recomposed: each excerpt is a
 * concatenation of verbatim slices of the real document.
 *
 * Source documents, each fetched once from
 * https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/
 *   msft-20260630_htm.xml   the extracted XBRL instance, 10,948,157 bytes
 *   FilingSummary.xml       68,644 bytes
 *   MetaLinks.json          1,601,396 bytes
 *   R107.htm                28,641 bytes
 *
 * The trims, stated so a reader can reproduce them:
 *   instance      - the verbatim root element with its namespace declarations,
 *                   four unit definitions, ten verbatim context blocks (the
 *                   FY2026 and FY2025 consolidated durations, the six segment
 *                   durations for those years, one segment instant, one
 *                   three-dimensional fair-value context that must be ignored,
 *                   and the one context carrying the same amount at two
 *                   precisions),
 *                   and every verbatim fact element pointing at them whose
 *                   content is 48 characters or less. Facts on the two
 *                   consolidated contexts are further limited to dei and the
 *                   income-statement chain plus basic earnings per share, which
 *                   the filer writes as both 18.00 and 18 and which therefore
 *                   pins the duplicate-versus-conflict rule; the text blocks
 *                   that make the real file 11 MB are dropped.
 *   FilingSummary - five verbatim <Report> blocks out of 112.
 *   MetaLinks     - five reports and seventeen tags out of 961, with the
 *                   standard-taxonomy documentation strings dropped.
 *   R107          - the verbatim header and every verbatim row that anchors a
 *                   concept, which is what carries both the filer's labels and
 *                   the order it presents its measures in.
 *
 * Invariant 4.5 and figures: this fixture DOES carry reported financial figures,
 * unlike Conduit's. That is deliberate and was approved at Check-in A. 4.5 bars
 * *fabricated* data - placeholder financials, invented companies, seeded demo
 * numbers. Every figure here is Microsoft's own reported, XBRL-tagged value,
 * carried verbatim. Segment extraction cannot be tested at all without them, and
 * a hand-written number would validate the guess instead of the filing.
 */

export const MSFT_CIK = '0000789019';
export const MSFT_ACCESSION = '0001193125-26-323660';
export const MSFT_FORM = '10-K';
export const MSFT_SIC = '7372';
export const MSFT_FILED_AT = '2026-07-29';
export const MSFT_PERIOD_END = '2026-06-30';
export const MSFT_INSTANCE_FILE = 'msft-20260630_htm.xml';
export const MSFT_INLINE_DOCUMENT = 'msft-20260630.htm';
export const MSFT_SEGMENT_RFILE = 'R107.htm';

/** The disclosure role id for the segment note. Note numbers move; this does not. */
export const MSFT_SEGMENT_NOTE_ROLE_ID = '995637';

/** Trimmed verbatim slices of the extracted XBRL instance. */
export const MSFT_INSTANCE_EXCERPT = String.raw`<?xml version="1.0" encoding="utf-8"?>
<xbrl
  xmlns="http://www.xbrl.org/2003/instance"
  xmlns:country="http://xbrl.sec.gov/country/2025"
  xmlns:cyd="http://xbrl.sec.gov/cyd/2025"
  xmlns:dei="http://xbrl.sec.gov/dei/2025"
  xmlns:ecd="http://xbrl.sec.gov/ecd/2025"
  xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
  xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:msft="http://www.microsoft.com/20260630"
  xmlns:srt="http://fasb.org/srt/2025"
  xmlns:us-gaap="http://fasb.org/us-gaap/2025"
  xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <link:schemaRef xlink:href="msft-20260630.xsd" xlink:type="simple"/>
    <unit id="U_pure">
        <measure>pure</measure>
    </unit>
    <unit id="U_Segment">
        <measure>msft:Segment</measure>
    </unit>
    <unit id="U_shares">
        <measure>shares</measure>
    </unit>
    <unit id="U_USD">
        <measure>iso4217:USD</measure>
    </unit>
    <context id="C_29985a27-1d12-4b7e-9a06-156523f6e71e">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
        </entity>
        <period>
            <startDate>2025-07-01</startDate>
            <endDate>2026-06-30</endDate>
        </period>
    </context>
    <context id="C_7575f467-7692-4974-a3da-f27e7e8e1c47">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
        </entity>
        <period>
            <startDate>2024-07-01</startDate>
            <endDate>2025-06-30</endDate>
        </period>
    </context>
    <context id="C_c4b4c258-8b46-4318-86c1-218c3d731d53">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
            <segment>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">msft:IntelligentCloudMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2025-07-01</startDate>
            <endDate>2026-06-30</endDate>
        </period>
    </context>
    <context id="C_007d085b-16be-487c-b22c-4e0afdd5cc58">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
            <segment>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">msft:ProductivityAndBusinessProcessesMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2025-07-01</startDate>
            <endDate>2026-06-30</endDate>
        </period>
    </context>
    <context id="C_2a3f7495-56da-49b0-8095-4459ec5fae64">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
            <segment>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">msft:MorePersonalComputingMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2025-07-01</startDate>
            <endDate>2026-06-30</endDate>
        </period>
    </context>
    <context id="C_a3ad6fc8-9442-4077-bc9b-0655ddf1d229">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
            <segment>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">msft:ProductivityAndBusinessProcessesMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2024-07-01</startDate>
            <endDate>2025-06-30</endDate>
        </period>
    </context>
    <context id="C_bbdfdc9b-8974-4595-a833-1a79001b6023">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
            <segment>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">msft:IntelligentCloudMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2024-07-01</startDate>
            <endDate>2025-06-30</endDate>
        </period>
    </context>
    <context id="C_dea1eb85-57ec-415a-b1e9-eb18c1f2071e">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
            <segment>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">msft:MorePersonalComputingMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <startDate>2024-07-01</startDate>
            <endDate>2025-06-30</endDate>
        </period>
    </context>
    <context id="C_2867acc4-eb10-46db-aa5f-b67c9287036b">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
            <segment>
                <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">msft:IntelligentCloudMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <instant>2026-06-30</instant>
        </period>
    </context>
    <context id="C_8048f463-8681-4eb8-89ff-d8d480424209">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
            <segment>
                <xbrldi:explicitMember dimension="us-gaap:FairValueByAssetClassAxis">us-gaap:DebtSecuritiesMember</xbrldi:explicitMember>
                <xbrldi:explicitMember dimension="us-gaap:FairValueByFairValueHierarchyLevelAxis">us-gaap:FairValueInputsLevel2Member</xbrldi:explicitMember>
                <xbrldi:explicitMember dimension="us-gaap:FinancialInstrumentAxis">us-gaap:AssetBackedSecuritiesMember</xbrldi:explicitMember>
            </segment>
        </entity>
        <period>
            <instant>2026-06-30</instant>
        </period>
    </context>
    <context id="C_528a2210-872f-4ed7-b006-dd38f90dd456">
        <entity>
            <identifier scheme="http://www.sec.gov/CIK">0000789019</identifier>
        </entity>
        <period>
            <instant>2025-06-30</instant>
        </period>
    </context>
    <dei:DocumentFiscalPeriodFocus
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_21aa40e5-0a47-4a53-a483-0563b9cbbe4c">FY</dei:DocumentFiscalPeriodFocus>
    <dei:AmendmentFlag
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_380eda0e-ec94-474a-9068-ce95517ef479">false</dei:AmendmentFlag>
    <dei:EntityCentralIndexKey
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_384867f5-ec4e-40f1-9513-95fa225246f6">0000789019</dei:EntityCentralIndexKey>
    <dei:DocumentType
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_bff863b5-8e59-4584-a041-0e943a307239">10-K</dei:DocumentType>
    <dei:DocumentAnnualReport
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_4c24423b-ed8c-420b-9b03-64f3152daff5">true</dei:DocumentAnnualReport>
    <dei:DocumentPeriodEndDate
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_6351fb3a-b839-45d5-a799-854be7c1cb82">2026-06-30</dei:DocumentPeriodEndDate>
    <dei:CurrentFiscalYearEndDate
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_62434d2e-ec0b-43b5-9502-3f9a06c8279a">--06-30</dei:CurrentFiscalYearEndDate>
    <dei:DocumentFiscalYearFocus
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_e31091ce-367b-4e83-afb4-b5837c51dc10">2026</dei:DocumentFiscalYearFocus>
    <dei:DocumentTransitionReport
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_658e9ef5-bfa6-4bb2-9a33-ab974419f2e3">false</dei:DocumentTransitionReport>
    <dei:EntityFileNumber
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_e9a3fd20-bbd5-481e-9c2a-499e26abc31d">001-37845</dei:EntityFileNumber>
    <dei:EntityRegistrantName
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_f68c3a91-b1e2-422c-8205-2d732a91e6a7">MICROSOFT CORPORATION</dei:EntityRegistrantName>
    <dei:EntityIncorporationStateCountryCode
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_801c8102-b8aa-465e-817c-01ed0a2d48d7">WA</dei:EntityIncorporationStateCountryCode>
    <dei:EntityTaxIdentificationNumber
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_88e2602f-a79b-4619-a50b-9408caf54dfc">91-1144442</dei:EntityTaxIdentificationNumber>
    <dei:EntityAddressAddressLine1
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_0b4249c1-8595-42a4-8612-3d7caba4c71c">ONE MICROSOFT WAY</dei:EntityAddressAddressLine1>
    <dei:EntityAddressCityOrTown
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_f8cda049-d0f3-42a3-8d96-12a973aa1950">REDMOND</dei:EntityAddressCityOrTown>
    <dei:EntityAddressStateOrProvince
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_cf39910a-351e-4bc5-ba41-6ad4a125e564">WA</dei:EntityAddressStateOrProvince>
    <dei:EntityAddressPostalZipCode
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_b001f886-5023-4318-9fa5-e00a441f68ca">98052-6399</dei:EntityAddressPostalZipCode>
    <dei:CityAreaCode
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_64381b22-f64f-473e-975a-531e9c7c9622">425</dei:CityAreaCode>
    <dei:LocalPhoneNumber
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_740b6e91-8125-4ad8-9332-d3ae0973b0ac">882-8080</dei:LocalPhoneNumber>
    <dei:EntityListingParValuePerShare
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="INF"
      id="F_0a380035-3ae6-4c68-9fba-24a2bbbd3f51"
      unitRef="U_UnitedStatesOfAmericaDollarsShare">0.00000625</dei:EntityListingParValuePerShare>
    <dei:EntityWellKnownSeasonedIssuer
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_180ae2a3-bd67-4aae-ba7d-ba0130d3952b">Yes</dei:EntityWellKnownSeasonedIssuer>
    <dei:EntityVoluntaryFilers
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_df8d8718-3a78-4dfa-94af-d9f57ea74f97">No</dei:EntityVoluntaryFilers>
    <dei:EntityCurrentReportingStatus
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_fa5e3e10-8cf1-40e4-bfd7-0ba1bfd72803">Yes</dei:EntityCurrentReportingStatus>
    <dei:EntityInteractiveDataCurrent
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_7333aca4-5d2f-44fc-9e52-789c9261c3cf">Yes</dei:EntityInteractiveDataCurrent>
    <dei:EntityFilerCategory
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_52c02886-2a42-4d98-91b0-aaeb4b6484fe">Large Accelerated Filer</dei:EntityFilerCategory>
    <dei:EntitySmallBusiness
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_3d51a008-0b98-4584-a26f-e09ceb87b5ef">false</dei:EntitySmallBusiness>
    <dei:EntityEmergingGrowthCompany
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_b1e7e808-2041-4a95-bd3a-943ba9876853">false</dei:EntityEmergingGrowthCompany>
    <dei:IcfrAuditorAttestationFlag
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_ca77b2e4-76ef-4a6c-83d9-ca92e8b87fba">true</dei:IcfrAuditorAttestationFlag>
    <dei:DocumentFinStmtErrorCorrectionFlag
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_397f0058-906b-4b14-8302-12a9b8d9d2a6">false</dei:DocumentFinStmtErrorCorrectionFlag>
    <dei:EntityShellCompany
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_0e178c69-1117-4c70-a573-bdf2754965a0">false</dei:EntityShellCompany>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_a62216e4-4826-4209-89af-643bc5c2df10"
      unitRef="U_USD">331839000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_d3febf44-5717-45d3-a565-dab944f2f096"
      unitRef="U_USD">281724000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:CostOfGoodsAndServicesSold
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_fdad769a-4b74-473e-b7d7-63f5f78e9335"
      unitRef="U_USD">106374000000</us-gaap:CostOfGoodsAndServicesSold>
    <us-gaap:CostOfGoodsAndServicesSold
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_5cd31eaa-985e-4b63-9321-5cd3dc925c7f"
      unitRef="U_USD">87831000000</us-gaap:CostOfGoodsAndServicesSold>
    <us-gaap:ResearchAndDevelopmentExpense
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_3ed99471-4bba-4752-b9fb-d7cd209ba15d"
      unitRef="U_USD">35562000000</us-gaap:ResearchAndDevelopmentExpense>
    <us-gaap:ResearchAndDevelopmentExpense
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_7885cead-b482-4f68-8dce-f73a4aa8a5e8"
      unitRef="U_USD">32488000000</us-gaap:ResearchAndDevelopmentExpense>
    <us-gaap:SellingAndMarketingExpense
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_178f8ba6-e39b-4a5c-9eb8-9eb06e515e44"
      unitRef="U_USD">26710000000</us-gaap:SellingAndMarketingExpense>
    <us-gaap:SellingAndMarketingExpense
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_6a280498-e936-4ede-aeda-1046304a1b47"
      unitRef="U_USD">25654000000</us-gaap:SellingAndMarketingExpense>
    <us-gaap:GeneralAndAdministrativeExpense
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_c286980b-bf49-45dc-ad37-cec99017789b"
      unitRef="U_USD">7956000000</us-gaap:GeneralAndAdministrativeExpense>
    <us-gaap:GeneralAndAdministrativeExpense
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_c894d4d9-1786-44e8-af60-94348caaeea5"
      unitRef="U_USD">7223000000</us-gaap:GeneralAndAdministrativeExpense>
    <us-gaap:OperatingIncomeLoss
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_606d36b1-9131-48c7-bcf9-e3c31061fd5c"
      unitRef="U_USD">155237000000</us-gaap:OperatingIncomeLoss>
    <us-gaap:OperatingIncomeLoss
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_554afe61-f689-44e4-bf4a-bf7729f12fbb"
      unitRef="U_USD">128528000000</us-gaap:OperatingIncomeLoss>
    <us-gaap:NonoperatingIncomeExpense
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_02f5e0d6-5229-465b-b0c9-1b430ab61716"
      unitRef="U_USD">10697000000</us-gaap:NonoperatingIncomeExpense>
    <us-gaap:NonoperatingIncomeExpense
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_4d07941a-116b-4e50-b134-5fe5b0fbbae3"
      unitRef="U_USD">-4901000000</us-gaap:NonoperatingIncomeExpense>
    <us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_e408b80f-4cfc-4412-bd75-423e2ebd09d7"
      unitRef="U_USD">165934000000</us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest>
    <us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_9a7ed48d-8cab-4153-8087-afdfb0740040"
      unitRef="U_USD">123627000000</us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest>
    <us-gaap:IncomeTaxExpenseBenefit
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_381789cf-1d64-4167-8cb1-966726846573"
      unitRef="U_USD">32185000000</us-gaap:IncomeTaxExpenseBenefit>
    <us-gaap:IncomeTaxExpenseBenefit
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_17936317-754b-4cfe-bcb2-ed9e7cab85bc"
      unitRef="U_USD">21795000000</us-gaap:IncomeTaxExpenseBenefit>
    <us-gaap:NetIncomeLoss
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_f60b152c-a7e2-422b-9310-68f1fbe9e3b0"
      unitRef="U_USD">133749000000</us-gaap:NetIncomeLoss>
    <us-gaap:NetIncomeLoss
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_0aa760ad-88a0-40f9-b28a-9129929565ec"
      unitRef="U_USD">101832000000</us-gaap:NetIncomeLoss>
    <us-gaap:EarningsPerShareBasic
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="2"
      id="F_a59abba7-ca19-40df-9d6b-92f586f80a67"
      unitRef="U_UnitedStatesOfAmericaDollarsShare">18.00</us-gaap:EarningsPerShareBasic>
    <us-gaap:EarningsPerShareBasic
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="2"
      id="F_7659ecb2-a8a6-4c5b-9114-a135f8e95b17"
      unitRef="U_UnitedStatesOfAmericaDollarsShare">13.70</us-gaap:EarningsPerShareBasic>
    <us-gaap:NetIncomeLoss
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_cc22de48-29f1-4c06-93d5-94d5b1d7b7e8"
      unitRef="U_USD">133749000000</us-gaap:NetIncomeLoss>
    <us-gaap:NetIncomeLoss
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_3af1a067-4c60-437f-937a-17f3e5cd1b95"
      unitRef="U_USD">101832000000</us-gaap:NetIncomeLoss>
    <us-gaap:NetIncomeLoss
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_757984e6-1d3a-45b1-8f18-4e3dddb2bf34"
      unitRef="U_USD">133749000000</us-gaap:NetIncomeLoss>
    <us-gaap:NetIncomeLoss
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_66b6f329-33fe-45e2-ace5-a7e8ff0301aa"
      unitRef="U_USD">101832000000</us-gaap:NetIncomeLoss>
    <us-gaap:NetIncomeLoss
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_f6ac46da-708a-4774-9b1b-ab85639f41f2"
      unitRef="U_USD">133749000000</us-gaap:NetIncomeLoss>
    <us-gaap:NetIncomeLoss
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_42cb83af-5691-44e8-b5bb-1b6e005927b5"
      unitRef="U_USD">101832000000</us-gaap:NetIncomeLoss>
    <us-gaap:EarningsPerShareBasic
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="2"
      id="F_0d53a4eb-0d85-43ad-9d42-ff9b7cb0c402"
      unitRef="U_UnitedStatesOfAmericaDollarsShare">18</us-gaap:EarningsPerShareBasic>
    <us-gaap:EarningsPerShareBasic
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="2"
      id="F_e4bbe729-8294-4867-bcab-5b1c208a1dfa"
      unitRef="U_UnitedStatesOfAmericaDollarsShare">13.7</us-gaap:EarningsPerShareBasic>
    <us-gaap:NonoperatingIncomeExpense
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_cd8ea3fc-a215-4558-a8b7-d21d9c81cf66"
      unitRef="U_USD">10697000000</us-gaap:NonoperatingIncomeExpense>
    <us-gaap:NonoperatingIncomeExpense
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_d1fdc708-8748-479d-8065-09dabeab2750"
      unitRef="U_USD">-4901000000</us-gaap:NonoperatingIncomeExpense>
    <us-gaap:AvailableForSaleDebtSecuritiesAmortizedCostBasis
      contextRef="C_8048f463-8681-4eb8-89ff-d8d480424209"
      decimals="-6"
      id="F_04401fbe-8329-48dd-a6c2-756eb245823e"
      unitRef="U_USD">1813000000</us-gaap:AvailableForSaleDebtSecuritiesAmortizedCostBasis>
    <us-gaap:AvailableForSaleDebtSecuritiesAccumulatedGrossUnrealizedGainBeforeTax
      contextRef="C_8048f463-8681-4eb8-89ff-d8d480424209"
      decimals="-6"
      id="F_b15a6607-d67b-4b59-83c0-d473925e9a7d"
      unitRef="U_USD">5000000</us-gaap:AvailableForSaleDebtSecuritiesAccumulatedGrossUnrealizedGainBeforeTax>
    <us-gaap:AvailableForSaleDebtSecuritiesAccumulatedGrossUnrealizedLossBeforeTax
      contextRef="C_8048f463-8681-4eb8-89ff-d8d480424209"
      decimals="-6"
      id="F_96352e12-2792-43fe-8f26-341346c6c0b6"
      unitRef="U_USD">23000000</us-gaap:AvailableForSaleDebtSecuritiesAccumulatedGrossUnrealizedLossBeforeTax>
    <us-gaap:AvailableForSaleSecuritiesDebtSecurities
      contextRef="C_8048f463-8681-4eb8-89ff-d8d480424209"
      decimals="-6"
      id="F_304184d2-0286-4e0b-9cf0-30b6381d7122"
      unitRef="U_USD">1795000000</us-gaap:AvailableForSaleSecuritiesDebtSecurities>
    <us-gaap:CashAndCashEquivalentsAtCarryingValue
      contextRef="C_8048f463-8681-4eb8-89ff-d8d480424209"
      decimals="-6"
      id="F_7d470b24-1655-4f25-9561-94eab0f6ccbb"
      unitRef="U_USD">0</us-gaap:CashAndCashEquivalentsAtCarryingValue>
    <us-gaap:ShortTermInvestments
      contextRef="C_8048f463-8681-4eb8-89ff-d8d480424209"
      decimals="-6"
      id="F_61862bd0-bfc1-4d3b-8934-a7c898300614"
      unitRef="U_USD">1795000000</us-gaap:ShortTermInvestments>
    <us-gaap:LongTermInvestments
      contextRef="C_8048f463-8681-4eb8-89ff-d8d480424209"
      decimals="-6"
      id="F_0684ec11-fa74-4b00-8b76-0f6cb4b48a7b"
      unitRef="U_USD">0</us-gaap:LongTermInvestments>
    <us-gaap:GoodwillAcquiredDuringPeriod
      contextRef="C_a3ad6fc8-9442-4077-bc9b-0655ddf1d229"
      decimals="-6"
      id="F_beb6c4c6-f5b2-4474-846a-70004cb8edf1"
      unitRef="U_USD">0</us-gaap:GoodwillAcquiredDuringPeriod>
    <us-gaap:GoodwillOtherIncreaseDecrease
      contextRef="C_a3ad6fc8-9442-4077-bc9b-0655ddf1d229"
      decimals="-6"
      id="F_9da4b6cb-4626-4255-8633-3f43f5772d0d"
      unitRef="U_USD">96000000</us-gaap:GoodwillOtherIncreaseDecrease>
    <us-gaap:GoodwillAcquiredDuringPeriod
      contextRef="C_007d085b-16be-487c-b22c-4e0afdd5cc58"
      decimals="-6"
      id="F_4dcef60c-da46-4624-ba09-3b41527d92b2"
      unitRef="U_USD">67000000</us-gaap:GoodwillAcquiredDuringPeriod>
    <us-gaap:GoodwillOtherIncreaseDecrease
      contextRef="C_007d085b-16be-487c-b22c-4e0afdd5cc58"
      decimals="-6"
      id="F_16d05d15-a37e-446e-b5b5-05bd16903eb0"
      unitRef="U_USD">46000000</us-gaap:GoodwillOtherIncreaseDecrease>
    <us-gaap:GoodwillAcquiredDuringPeriod
      contextRef="C_bbdfdc9b-8974-4595-a833-1a79001b6023"
      decimals="-6"
      id="F_2add82e2-48d9-4d02-bd5d-626094607b13"
      unitRef="U_USD">0</us-gaap:GoodwillAcquiredDuringPeriod>
    <us-gaap:GoodwillOtherIncreaseDecrease
      contextRef="C_bbdfdc9b-8974-4595-a833-1a79001b6023"
      decimals="-6"
      id="F_e9ec207a-4595-4678-8437-33e72d287c4f"
      unitRef="U_USD">41000000</us-gaap:GoodwillOtherIncreaseDecrease>
    <us-gaap:GoodwillAcquiredDuringPeriod
      contextRef="C_c4b4c258-8b46-4318-86c1-218c3d731d53"
      decimals="-6"
      id="F_47578405-ce4d-4619-88ed-a892e85ff175"
      unitRef="U_USD">36000000</us-gaap:GoodwillAcquiredDuringPeriod>
    <us-gaap:GoodwillOtherIncreaseDecrease
      contextRef="C_c4b4c258-8b46-4318-86c1-218c3d731d53"
      decimals="-6"
      id="F_5a1c8faa-19a4-4746-88de-f0b47f0f3708"
      unitRef="U_USD">16000000</us-gaap:GoodwillOtherIncreaseDecrease>
    <us-gaap:Goodwill
      contextRef="C_2867acc4-eb10-46db-aa5f-b67c9287036b"
      decimals="-6"
      id="F_6aa5de2c-2aa3-4ae5-bb67-a9dfadd103b5"
      unitRef="U_USD">25741000000</us-gaap:Goodwill>
    <us-gaap:GoodwillAcquiredDuringPeriod
      contextRef="C_dea1eb85-57ec-415a-b1e9-eb18c1f2071e"
      decimals="-6"
      id="F_34cd0813-ddd5-4021-b03c-aaf826ecf051"
      unitRef="U_USD">0</us-gaap:GoodwillAcquiredDuringPeriod>
    <us-gaap:GoodwillOtherIncreaseDecrease
      contextRef="C_dea1eb85-57ec-415a-b1e9-eb18c1f2071e"
      decimals="-6"
      id="F_85f12b8f-6d81-4e38-9d49-8bc6f37cfaac"
      unitRef="U_USD">152000000</us-gaap:GoodwillOtherIncreaseDecrease>
    <us-gaap:GoodwillAcquiredDuringPeriod
      contextRef="C_2a3f7495-56da-49b0-8095-4459ec5fae64"
      decimals="-6"
      id="F_9f798586-f470-4683-9075-b5dcb03591cb"
      unitRef="U_USD">5000000</us-gaap:GoodwillAcquiredDuringPeriod>
    <us-gaap:GoodwillOtherIncreaseDecrease
      contextRef="C_2a3f7495-56da-49b0-8095-4459ec5fae64"
      decimals="-6"
      id="F_40ced747-84ad-4836-8502-1e90f339d05e"
      unitRef="U_USD">-28000000</us-gaap:GoodwillOtherIncreaseDecrease>
    <us-gaap:IncomeTaxExpenseBenefit
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_88edae15-63e3-44d6-819e-cfff7b657560"
      unitRef="U_USD">32185000000</us-gaap:IncomeTaxExpenseBenefit>
    <us-gaap:IncomeTaxExpenseBenefit
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_33d87efc-fd23-49ac-905a-072d5ad276fa"
      unitRef="U_USD">21795000000</us-gaap:IncomeTaxExpenseBenefit>
    <us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_a26fffce-f78c-4f47-8dfe-4c156f799f83"
      unitRef="U_USD">165934000000</us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest>
    <us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_b2105b4c-1a09-4bb8-b0d4-95ca7c1c2705"
      unitRef="U_USD">123627000000</us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest>
    <us-gaap:IncomeTaxExpenseBenefit
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_18b403c2-63e8-444b-9b68-9e1efb5090fe"
      unitRef="U_USD">32185000000</us-gaap:IncomeTaxExpenseBenefit>
    <us-gaap:UnrecognizedTaxBenefits
      contextRef="C_528a2210-872f-4ed7-b006-dd38f90dd456"
      decimals="-8"
      id="F_8f591ab7-2abf-4c94-9fd2-80533a431c75"
      unitRef="U_USD">24700000000</us-gaap:UnrecognizedTaxBenefits>
    <us-gaap:UnrecognizedTaxBenefits
      contextRef="C_528a2210-872f-4ed7-b006-dd38f90dd456"
      decimals="-6"
      id="F_9d116955-d6c7-4a6a-bc81-6207c0928769"
      unitRef="U_USD">24729000000</us-gaap:UnrecognizedTaxBenefits>
    <us-gaap:UnrecognizedTaxBenefits
      contextRef="C_528a2210-872f-4ed7-b006-dd38f90dd456"
      decimals="-6"
      id="F_aafa5bd7-8d5d-449f-8e31-9eda0e31922f"
      unitRef="U_USD">24729000000</us-gaap:UnrecognizedTaxBenefits>
    <us-gaap:ContractWithCustomerLiability
      contextRef="C_2867acc4-eb10-46db-aa5f-b67c9287036b"
      decimals="-6"
      id="F_63ad4cee-5944-4662-8ad8-14f098849cc1"
      unitRef="U_USD">14942000000</us-gaap:ContractWithCustomerLiability>
    <us-gaap:NumberOfReportableSegments
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="0"
      id="F_7d649a3c-20aa-439f-96c6-6da56efffa7c"
      unitRef="U_Segment">3</us-gaap:NumberOfReportableSegments>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_007d085b-16be-487c-b22c-4e0afdd5cc58"
      decimals="-6"
      id="F_ac0ce5dd-e6a4-4ea0-b444-c8be614d09dc"
      unitRef="U_USD">139996000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_a3ad6fc8-9442-4077-bc9b-0655ddf1d229"
      decimals="-6"
      id="F_93258a8b-60c3-47ad-8e5c-dc2959f1e09f"
      unitRef="U_USD">120810000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:CostOfGoodsAndServicesSold
      contextRef="C_007d085b-16be-487c-b22c-4e0afdd5cc58"
      decimals="-6"
      id="F_43ee75ef-d608-47ae-9987-f44175fb6eef"
      unitRef="U_USD">25017000000</us-gaap:CostOfGoodsAndServicesSold>
    <us-gaap:CostOfGoodsAndServicesSold
      contextRef="C_a3ad6fc8-9442-4077-bc9b-0655ddf1d229"
      decimals="-6"
      id="F_077316f4-610c-42eb-89a2-8671b07c3f11"
      unitRef="U_USD">22422000000</us-gaap:CostOfGoodsAndServicesSold>
    <us-gaap:OperatingExpenses
      contextRef="C_007d085b-16be-487c-b22c-4e0afdd5cc58"
      decimals="-6"
      id="F_f4df7e0d-42d2-4e34-ae34-a268119fee87"
      unitRef="U_USD">31100000000</us-gaap:OperatingExpenses>
    <us-gaap:OperatingExpenses
      contextRef="C_a3ad6fc8-9442-4077-bc9b-0655ddf1d229"
      decimals="-6"
      id="F_b0f4e91d-4395-41c0-aeea-03ad2856dff5"
      unitRef="U_USD">28615000000</us-gaap:OperatingExpenses>
    <us-gaap:OperatingIncomeLoss
      contextRef="C_007d085b-16be-487c-b22c-4e0afdd5cc58"
      decimals="-6"
      id="F_746d67eb-c119-4d82-879e-bd440af87931"
      unitRef="U_USD">83879000000</us-gaap:OperatingIncomeLoss>
    <us-gaap:OperatingIncomeLoss
      contextRef="C_a3ad6fc8-9442-4077-bc9b-0655ddf1d229"
      decimals="-6"
      id="F_f1f2ff9a-dfc1-4fd9-9d5c-182bd8ab8bf0"
      unitRef="U_USD">69773000000</us-gaap:OperatingIncomeLoss>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_c4b4c258-8b46-4318-86c1-218c3d731d53"
      decimals="-6"
      id="F_a06acec4-abed-4c4a-8bc2-57409c2d1093"
      unitRef="U_USD">137791000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_bbdfdc9b-8974-4595-a833-1a79001b6023"
      decimals="-6"
      id="F_549c1ffb-385e-4200-a6c1-2df6e915c11a"
      unitRef="U_USD">106265000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:CostOfGoodsAndServicesSold
      contextRef="C_c4b4c258-8b46-4318-86c1-218c3d731d53"
      decimals="-6"
      id="F_0f8c0615-51b2-4471-b100-411c248758b0"
      unitRef="U_USD">57876000000</us-gaap:CostOfGoodsAndServicesSold>
    <us-gaap:CostOfGoodsAndServicesSold
      contextRef="C_bbdfdc9b-8974-4595-a833-1a79001b6023"
      decimals="-6"
      id="F_8f948c40-9b9a-4866-a8b9-62a63c4eefdf"
      unitRef="U_USD">40171000000</us-gaap:CostOfGoodsAndServicesSold>
    <us-gaap:OperatingExpenses
      contextRef="C_c4b4c258-8b46-4318-86c1-218c3d731d53"
      decimals="-6"
      id="F_75e872e1-a0c3-45c9-81ac-f209dea7699f"
      unitRef="U_USD">22943000000</us-gaap:OperatingExpenses>
    <us-gaap:OperatingExpenses
      contextRef="C_bbdfdc9b-8974-4595-a833-1a79001b6023"
      decimals="-6"
      id="F_56a2ab33-3e17-440d-83b2-8e99c6c64980"
      unitRef="U_USD">21505000000</us-gaap:OperatingExpenses>
    <us-gaap:OperatingIncomeLoss
      contextRef="C_c4b4c258-8b46-4318-86c1-218c3d731d53"
      decimals="-6"
      id="F_9b8b4fa4-c572-4ce0-aee7-74cae3b40bda"
      unitRef="U_USD">56972000000</us-gaap:OperatingIncomeLoss>
    <us-gaap:OperatingIncomeLoss
      contextRef="C_bbdfdc9b-8974-4595-a833-1a79001b6023"
      decimals="-6"
      id="F_47bcc1ac-8829-4466-a8d4-46edd96e84a3"
      unitRef="U_USD">44589000000</us-gaap:OperatingIncomeLoss>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_2a3f7495-56da-49b0-8095-4459ec5fae64"
      decimals="-6"
      id="F_b172b8cc-466d-4448-803b-ec73bcc8673d"
      unitRef="U_USD">54052000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_dea1eb85-57ec-415a-b1e9-eb18c1f2071e"
      decimals="-6"
      id="F_bd133dde-0418-4c08-8564-ec526fc4e010"
      unitRef="U_USD">54649000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:CostOfGoodsAndServicesSold
      contextRef="C_2a3f7495-56da-49b0-8095-4459ec5fae64"
      decimals="-6"
      id="F_3f4857bc-ca9c-49aa-9a1c-83911c6b200d"
      unitRef="U_USD">23481000000</us-gaap:CostOfGoodsAndServicesSold>
    <us-gaap:CostOfGoodsAndServicesSold
      contextRef="C_dea1eb85-57ec-415a-b1e9-eb18c1f2071e"
      decimals="-6"
      id="F_c581bfae-1e31-4279-b182-b512a299d46e"
      unitRef="U_USD">25238000000</us-gaap:CostOfGoodsAndServicesSold>
    <us-gaap:OperatingExpenses
      contextRef="C_2a3f7495-56da-49b0-8095-4459ec5fae64"
      decimals="-6"
      id="F_f36be791-41fc-4dfd-b40b-ba784f20f9e3"
      unitRef="U_USD">16185000000</us-gaap:OperatingExpenses>
    <us-gaap:OperatingExpenses
      contextRef="C_dea1eb85-57ec-415a-b1e9-eb18c1f2071e"
      decimals="-6"
      id="F_e6849095-86c8-454b-a2f6-a69551bd3770"
      unitRef="U_USD">15245000000</us-gaap:OperatingExpenses>
    <us-gaap:OperatingIncomeLoss
      contextRef="C_2a3f7495-56da-49b0-8095-4459ec5fae64"
      decimals="-6"
      id="F_48542f1f-9e4d-4e36-9d5d-fc0eefdf03a1"
      unitRef="U_USD">14386000000</us-gaap:OperatingIncomeLoss>
    <us-gaap:OperatingIncomeLoss
      contextRef="C_dea1eb85-57ec-415a-b1e9-eb18c1f2071e"
      decimals="-6"
      id="F_8adf57a5-1d2c-4da2-abe7-b622ae25de82"
      unitRef="U_USD">14166000000</us-gaap:OperatingIncomeLoss>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_0316687c-ee9f-4f70-b690-d7ba528fa116"
      unitRef="U_USD">331839000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_2178941a-2586-4318-9637-457675acd227"
      unitRef="U_USD">281724000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:CostOfGoodsAndServicesSold
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_c1374574-fc84-4dfb-b44e-38d1778f40c4"
      unitRef="U_USD">106374000000</us-gaap:CostOfGoodsAndServicesSold>
    <us-gaap:CostOfGoodsAndServicesSold
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_0f36ed0e-b3dc-4e1a-9975-70e5b25722c3"
      unitRef="U_USD">87831000000</us-gaap:CostOfGoodsAndServicesSold>
    <us-gaap:OperatingExpenses
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_a3f80e56-1195-4ded-a6e8-47b30147d2e1"
      unitRef="U_USD">70228000000</us-gaap:OperatingExpenses>
    <us-gaap:OperatingExpenses
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_2e6a4b6f-0979-40d4-91c4-4b65167cc96d"
      unitRef="U_USD">65365000000</us-gaap:OperatingExpenses>
    <us-gaap:OperatingIncomeLoss
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_b6fef9ec-64a6-4e7a-9638-4acea8948423"
      unitRef="U_USD">155237000000</us-gaap:OperatingIncomeLoss>
    <us-gaap:OperatingIncomeLoss
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_71bd8e0b-9a5c-43dc-b90e-8af284e3b3ee"
      unitRef="U_USD">128528000000</us-gaap:OperatingIncomeLoss>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_5c7ea880-e5ab-4cba-9a0c-a735a6aba422"
      unitRef="U_USD">331839000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_bc7a0b1c-86f2-4851-8e66-113631b0b501"
      unitRef="U_USD">281724000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      decimals="-6"
      id="F_34a1ffe1-c1f2-4d1c-92fd-fc404c274dcd"
      unitRef="U_USD">331839000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax
      contextRef="C_7575f467-7692-4974-a3da-f27e7e8e1c47"
      decimals="-6"
      id="F_2d76f27b-ea07-44dc-bf63-3e186e258a8a"
      unitRef="U_USD">281724000000</us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax>
    <dei:AuditorName
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_b2ed360d-cb08-4cbb-b42c-1001945deda3">DELOITTE &amp; TOUCHE LLP</dei:AuditorName>
    <dei:AuditorLocation
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_20d246c9-9f90-48e5-8196-21d2a65fce3e">Seattle, Washington</dei:AuditorLocation>
    <dei:AuditorFirmId
      contextRef="C_29985a27-1d12-4b7e-9a06-156523f6e71e"
      id="F_29a2b000-2c07-482e-80ed-75ab4dac6604">34</dei:AuditorFirmId>
</xbrl>`;

/** Trimmed verbatim <Report> blocks from FilingSummary.xml. */
export const MSFT_FILING_SUMMARY_EXCERPT = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<FilingSummary>
  <MyReports>
    <Report instance="msft-20260630.htm">
      <IsDefault>false</IsDefault>
      <HasEmbeddedReports>false</HasEmbeddedReports>
      <HtmlFileName>R2.htm</HtmlFileName>
      <LongName>75010 - Statement - INCOME STATEMENTS</LongName>
      <ReportType>Sheet</ReportType>
      <Role>http://www.microsoft.com/20260630/taxonomy/role/Role_StatementINCOMESTATEMENTS</Role>
      <ShortName>INCOME STATEMENTS</ShortName>
      <MenuCategory>Statements</MenuCategory>
      <Position>2</Position>
    </Report>
    <Report instance="msft-20260630.htm">
      <IsDefault>false</IsDefault>
      <HasEmbeddedReports>false</HasEmbeddedReports>
      <HtmlFileName>R28.htm</HtmlFileName>
      <LongName>995637 - Disclosure - SEGMENT INFORMATION AND GEOGRAPHIC DATA</LongName>
      <ReportType>Sheet</ReportType>
      <Role>http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureSEGMENTINFORMATIONANDGEOGRAPHICDATA</Role>
      <ShortName>SEGMENT INFORMATION AND GEOGRAPHIC DATA</ShortName>
      <MenuCategory>Notes</MenuCategory>
      <Position>28</Position>
    </Report>
    <Report instance="msft-20260630.htm">
      <IsDefault>false</IsDefault>
      <HasEmbeddedReports>false</HasEmbeddedReports>
      <HtmlFileName>R45.htm</HtmlFileName>
      <LongName>995807 - Disclosure - SEGMENT INFORMATION AND GEOGRAPHIC DATA (Tables)</LongName>
      <ReportType>Sheet</ReportType>
      <Role>http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureSEGMENTINFORMATIONANDGEOGRAPHICDATATables</Role>
      <ShortName>SEGMENT INFORMATION AND GEOGRAPHIC DATA (Tables)</ShortName>
      <MenuCategory>Tables</MenuCategory>
      <ParentRole>http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureSEGMENTINFORMATIONANDGEOGRAPHICDATA</ParentRole>
      <Position>45</Position>
    </Report>
    <Report instance="msft-20260630.htm">
      <IsDefault>false</IsDefault>
      <HasEmbeddedReports>false</HasEmbeddedReports>
      <HtmlFileName>R107.htm</HtmlFileName>
      <LongName>996467 - Disclosure - Segment Revenue, Cost of Revenue, Operating Expenses and Operating Income (Detail)</LongName>
      <ReportType>Sheet</ReportType>
      <Role>http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail</Role>
      <ShortName>Segment Revenue, Cost of Revenue, Operating Expenses and Operating Income (Detail)</ShortName>
      <MenuCategory>Details</MenuCategory>
      <Position>107</Position>
    </Report>
    <Report instance="msft-20260630.htm">
      <IsDefault>false</IsDefault>
      <HasEmbeddedReports>false</HasEmbeddedReports>
      <HtmlFileName>R108.htm</HtmlFileName>
      <LongName>996477 - Disclosure - Segment Information and Geographic Data - Additional Information (Detail)</LongName>
      <ReportType>Sheet</ReportType>
      <Role>http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureSegmentInformationAndGeographicDataAdditionalInformationDetail</Role>
      <ShortName>Segment Information and Geographic Data - Additional Information (Detail)</ShortName>
      <MenuCategory>Details</MenuCategory>
      <Position>108</Position>
    </Report>
  </MyReports>
</FilingSummary>
`;

/** Trimmed MetaLinks.json - the rendered label and presentation linkbases. */
export const MSFT_METALINKS_EXCERPT =
  '{\n "version": "2.2",\n "instance": {\n  "msft-20260630.htm": {\n   "nsprefix": "msft",\n   "nsuri": "http://www.microsoft.com/20260630",\n   "keyStandard": 489,\n   "keyCustom": 59,\n   "axisStandard": 35,\n   "axisCustom": 1,\n   "memberStandard": 69,\n   "memberCustom": 56,\n   "contextCount": 446,\n   "segmentCount": 128,\n   "elementCount": 961,\n   "unitCount": 6,\n   "report": {\n    "R2": {\n     "role": "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementINCOMESTATEMENTS",\n     "longName": "75010 - Statement - INCOME STATEMENTS",\n     "shortName": "INCOME STATEMENTS",\n     "groupType": "statement",\n     "isDefault": "false"\n    },\n    "R28": {\n     "role": "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureSEGMENTINFORMATIONANDGEOGRAPHICDATA",\n     "longName": "995637 - Disclosure - SEGMENT INFORMATION AND GEOGRAPHIC DATA",\n     "shortName": "SEGMENT INFORMATION AND GEOGRAPHIC DATA",\n     "groupType": "disclosure",\n     "isDefault": "false"\n    },\n    "R45": {\n     "role": "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureSEGMENTINFORMATIONANDGEOGRAPHICDATATables",\n     "longName": "995807 - Disclosure - SEGMENT INFORMATION AND GEOGRAPHIC DATA (Tables)",\n     "shortName": "SEGMENT INFORMATION AND GEOGRAPHIC DATA (Tables)",\n     "groupType": "disclosure",\n     "isDefault": "false"\n    },\n    "R107": {\n     "role": "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail",\n     "longName": "996467 - Disclosure - Segment Revenue, Cost of Revenue, Operating Expenses and Operating Income (Detail)",\n     "shortName": "Segment Revenue, Cost of Revenue, Operating Expenses and Operating Income (Detail)",\n     "groupType": "disclosure",\n     "isDefault": "false"\n    },\n    "R108": {\n     "role": "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureSegmentInformationAndGeographicDataAdditionalInformationDetail",\n     "longName": "996477 - Disclosure - Segment Information and Geographic Data - Additional Information (Detail)",\n     "shortName": "Segment Information and Geographic Data - Additional Information (Detail)",\n     "groupType": "disclosure",\n     "isDefault": "false"\n    }\n   },\n   "tag": {\n    "us-gaap_StatementBusinessSegmentsAxis": {\n     "xbrltype": "stringItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "StatementBusinessSegmentsAxis",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureCarryingAmountOfGoodwillDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureUnearnedRevenueBySegmentDetail"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Segments [Axis]",\n        "terseLabel": "Statement, Business Segments"\n       }\n      }\n     }\n    },\n    "us-gaap_SegmentDomain": {\n     "xbrltype": "domainItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "SegmentDomain",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureCarryingAmountOfGoodwillDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureUnearnedRevenueBySegmentDetail"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Segments [Domain]",\n        "terseLabel": "Segments [Domain]"\n       }\n      }\n     }\n    },\n    "us-gaap_SegmentReportingInformationLineItems": {\n     "xbrltype": "stringItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "SegmentReportingInformationLineItems",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Segment Reporting Information [Line Items]",\n        "terseLabel": "Segment Reporting Information [Line Items]"\n       }\n      }\n     }\n    },\n    "us-gaap_ScheduleOfSegmentReportingInformationBySegmentTable": {\n     "xbrltype": "stringItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "ScheduleOfSegmentReportingInformationBySegmentTable",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Schedule of Segment Reporting Information, by Segment [Table]",\n        "terseLabel": "Schedule of Segment Reporting Information, by Segment [Table]"\n       }\n      }\n     }\n    },\n    "msft_ProductivityAndBusinessProcessesMember": {\n     "xbrltype": "domainItemType",\n     "nsuri": "http://www.microsoft.com/20260630",\n     "localname": "ProductivityAndBusinessProcessesMember",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureCarryingAmountOfGoodwillDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureUnearnedRevenueBySegmentDetail"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Productivity And Business Processes [Member]",\n        "terseLabel": "Productivity and Business Processes"\n       }\n      }\n     }\n    },\n    "msft_IntelligentCloudMember": {\n     "xbrltype": "domainItemType",\n     "nsuri": "http://www.microsoft.com/20260630",\n     "localname": "IntelligentCloudMember",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureCarryingAmountOfGoodwillDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureUnearnedRevenueBySegmentDetail"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Intelligent Cloud [Member]",\n        "terseLabel": "Intelligent Cloud"\n       }\n      }\n     }\n    },\n    "msft_MorePersonalComputingMember": {\n     "xbrltype": "domainItemType",\n     "nsuri": "http://www.microsoft.com/20260630",\n     "localname": "MorePersonalComputingMember",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureCarryingAmountOfGoodwillDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureUnearnedRevenueBySegmentDetail"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "More Personal Computing [Member]",\n        "terseLabel": "More Personal Computing"\n       }\n      }\n     }\n    },\n    "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax": {\n     "xbrltype": "monetaryItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "RevenueFromContractWithCustomerExcludingAssessedTax",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureAccountingPoliciesAdditionalInformationDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureRevenueClassifiedByMajorGeographicAreasDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureRevenueClassifiedBySignificantProductAndServiceOfferingsDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureRevenueClassifiedBySignificantProductAndServiceOfferingsParentheticalDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementINCOMESTATEMENTS"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Revenue from Contract with Customer, Excluding Assessed Tax",\n        "terseLabel": "Revenue",\n        "verboseLabel": "Revenue"\n       }\n      }\n     }\n    },\n    "us-gaap_CostOfGoodsAndServicesSold": {\n     "xbrltype": "monetaryItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "CostOfGoodsAndServicesSold",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementINCOMESTATEMENTS"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Cost of Product and Service Sold",\n        "terseLabel": "Cost of revenue",\n        "totalLabel": "Cost of Goods and Services Sold, Total"\n       }\n      }\n     }\n    },\n    "us-gaap_OperatingExpenses": {\n     "xbrltype": "monetaryItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "OperatingExpenses",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Operating Expenses",\n        "totalLabel": "Operating Expenses, Total",\n        "terseLabel": "Operating expenses"\n       }\n      }\n     }\n    },\n    "us-gaap_OperatingIncomeLoss": {\n     "xbrltype": "monetaryItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "OperatingIncomeLoss",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureSegmentRevenueCostOfRevenueOperatingExpensesAndOperatingIncomeDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementINCOMESTATEMENTS"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Operating Income (Loss)",\n        "terseLabel": "Operating income",\n        "totalLabel": "Operating income",\n        "verboseLabel": "Operating income (loss)"\n       }\n      }\n     }\n    },\n    "us-gaap_NumberOfReportableSegments": {\n     "xbrltype": "integerItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "NumberOfReportableSegments",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureSegmentInformationAndGeographicDataAdditionalInformationDetail"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Number of Reportable Segments",\n        "terseLabel": "Number of reportable segments"\n       }\n      }\n     }\n    },\n    "us-gaap_NetIncomeLoss": {\n     "xbrltype": "monetaryItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "NetIncomeLoss",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureBasicAndDilutedEarningsPerShareDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementCASHFLOWSSTATEMENTS",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementCOMPREHENSIVEINCOMESTATEMENTS",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementINCOMESTATEMENTS",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementSTOCKHOLDERSEQUITYSTATEMENTS",\n      "http://xbrl.sec.gov/ecd/role/PvpDisclosure"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Net Income (Loss)",\n        "terseLabel": "Net Income (Loss)",\n        "netLabel": "Net income",\n        "totalLabel": "Net income",\n        "verboseLabel": "Net income available for common shareholders (A)"\n       }\n      }\n     }\n    },\n    "us-gaap_IncomeTaxExpenseBenefit": {\n     "xbrltype": "monetaryItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "IncomeTaxExpenseBenefit",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureDifferenceBetweenIncomeTaxesComputedAtFederalStatutoryRateAndProvisionForIncomeTaxesDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureProvisionForIncomeTaxesDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementINCOMESTATEMENTS"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Income Tax Expense (Benefit)",\n        "terseLabel": "Provision for income taxes",\n        "totalLabel": "Provision for income taxes",\n        "verboseLabel": "Provision (benefit) for income taxes"\n       }\n      }\n     }\n    },\n    "us-gaap_NonoperatingIncomeExpense": {\n     "xbrltype": "monetaryItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "NonoperatingIncomeExpense",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/DisclosureOtherIncomeExpenseNetAdditionalInformationDetails",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureComponentsOfOtherIncomeExpenseNetDetail",\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementINCOMESTATEMENTS"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Nonoperating Income (Expense)",\n        "totalLabel": "Total",\n        "verboseLabel": "Net gains (losses) from investments",\n        "terseLabel": "Other income (expense), net"\n       }\n      }\n     }\n    },\n    "us-gaap_ResearchAndDevelopmentExpense": {\n     "xbrltype": "monetaryItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "ResearchAndDevelopmentExpense",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_StatementINCOMESTATEMENTS"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Research and Development Expense",\n        "terseLabel": "Research and development",\n        "totalLabel": "Research and Development Expense, Total"\n       }\n      }\n     }\n    },\n    "us-gaap_GoodwillAcquiredDuringPeriod": {\n     "xbrltype": "monetaryItemType",\n     "nsuri": "http://fasb.org/us-gaap/2025",\n     "localname": "GoodwillAcquiredDuringPeriod",\n     "presentation": [\n      "http://www.microsoft.com/20260630/taxonomy/role/Role_DisclosureCarryingAmountOfGoodwillDetail"\n     ],\n     "lang": {\n      "en-us": {\n       "role": {\n        "label": "Goodwill, Acquired During Period",\n        "terseLabel": "Acquisitions"\n       }\n      }\n     }\n    }\n   }\n  }\n }\n}';

/** Trimmed verbatim rows from the rendered segment detail report. */
export const MSFT_SEGMENT_RFILE_EXCERPT = String.raw`<DOCUMENT>
<TYPE>XML
<SEQUENCE>120
<FILENAME>R107.htm
<DESCRIPTION>IDEA: XBRL DOCUMENT
<TEXT>
<html>
<head>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_SegmentReportingInformationLineItems', window );"><strong>Segment Reporting Information [Line Items]</strong></a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', window );">Revenue</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_CostOfGoodsAndServicesSold', window );">Cost of revenue</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_OperatingExpenses', window );">Operating expenses</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_OperatingIncomeLoss', window );">Operating income</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_StatementBusinessSegmentsAxis=msft_ProductivityAndBusinessProcessesMember', window );">Productivity and Business Processes</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_SegmentReportingInformationLineItems', window );"><strong>Segment Reporting Information [Line Items]</strong></a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', window );">Revenue</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_CostOfGoodsAndServicesSold', window );">Cost of revenue</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_OperatingExpenses', window );">Operating expenses</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_OperatingIncomeLoss', window );">Operating income</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_StatementBusinessSegmentsAxis=msft_IntelligentCloudMember', window );">Intelligent Cloud</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_SegmentReportingInformationLineItems', window );"><strong>Segment Reporting Information [Line Items]</strong></a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', window );">Revenue</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_CostOfGoodsAndServicesSold', window );">Cost of revenue</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_OperatingExpenses', window );">Operating expenses</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_OperatingIncomeLoss', window );">Operating income</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_StatementBusinessSegmentsAxis=msft_MorePersonalComputingMember', window );">More Personal Computing</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_SegmentReportingInformationLineItems', window );"><strong>Segment Reporting Information [Line Items]</strong></a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', window );">Revenue</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_CostOfGoodsAndServicesSold', window );">Cost of revenue</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_OperatingExpenses', window );">Operating expenses</a></td>
<td class="pl" style="border-bottom: 0px;" valign="top"><a class="a" href="javascript:void(0);" onclick="Show.showAR( this, 'defref_us-gaap_OperatingIncomeLoss', window );">Operating income</a></td>
</table></div>`;
