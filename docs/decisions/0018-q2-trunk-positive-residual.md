# 0018 — Q2: What does the trunk do when the residual is positive?

Date:        2026-08-20
Status:      pending (awaiting Angel's decision)
Escalated by: Product Analyst (test record 0002, docs/product/open-questions.md §Q2)

Context:     Consolidated net income can exceed segment operating income — large interest income
             against a low tax charge, an equity-method gain, an unallocated corporate credit.

             The trunk constriction (D16) currently has only narrowing behavior. If the residual
             is positive (net income > segment operating income), the trunk would need to *widen*.
             A widening constriction is a contradiction in encoding.

             For Microsoft, the residual is negative, so the slice does not exercise this case.
             But Financial Data Analyst's corrected extraction shows the components already carry opposite signs
             in company one: non-operating income +$10,697M against income taxes −$32,185M.

Current state: No widening behavior is defined for any constriction. The encoding family has
             only narrowing. Any answer to Q4 that decomposes the trunk (rendering both
             components separately) would exercise this case immediately on company one.

Impact:      Not blocking the vertical slice (Microsoft does not exercise it at the net level).
             Needed before company two (Apple and Oracle have different profiles). Blocking Q4's
             option 2 if that option is chosen.

Awaiting:    Angel's decision on how constrictions handle widening cases, and whether the trunk
             should decompose or remain net (Q4).
