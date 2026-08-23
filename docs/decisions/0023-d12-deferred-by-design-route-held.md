# 0023 — D12: Deferred by design; route enforced to block period segment until decision lands

Date:        2026-08-21
Status:      deferred (intentional, not merely open)
Decided by:  Angel

Context:     D12 asks: what is the default period on app load (FY / quarter / TTM)? The answer
             shapes initial app state, routing defaults, and the first-run experience (Q3).

             The vertical slice renders Microsoft FY2026. To ship the slice, a default period is
             needed. However, the question itself — which period to show by default — is
             genuinely open and deserves a full answer before Q3's first-run spec is written.

             Rather than guess a default and bake it in, Angel has chosen to defer the decision
             and enforce the deferral in code: the route is #/company/:cik with no period
             segment. A route test now fails if a period appears in the URL, holding the
             deferral until the decision lands.

Options:     (Not decided now; see docs/product/open-questions.md for full exploration.)

Decision:    Defer D12 deliberately. The route pattern #/company/:cik (no period segment) is
             canonical. The slice works because it renders one period; a second company will need
             a period picker before the app has multiple periods to choose from. Defer the
             default until that point.

             The test enforces the deferral: any route with a period segment fails, preventing
             code drift toward an implicit default.

Consequence: Product Analyst cannot finalize Q3 (first-run spec) until D12 is answered and the
             route test is updated to accept the period segment. Blocking Q3 is acceptable
             because the first company and its vertical slice do not need a multi-period picker.
             The deferral is deliberate and visible, not a hidden gap.