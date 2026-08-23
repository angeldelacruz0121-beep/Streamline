# 0020 — Q4: Is one net trunk pinch an honest rendering of two opposite-signed components?

Date:        2026-08-20
Status:      pending (awaiting Angel's decision)
Escalated by: Product Analyst (test record 0002 Misread D, docs/product/open-questions.md §Q4)

Context:     Microsoft's $21,488M trunk residual is a net of:
             - Non-operating income: +$10,697M
             - Income tax expense: −$32,185M
             - Net: −$21,488M

             Drawing the residual as a single 13.84% pinch on the trunk states that tax cost
             Microsoft $21.5B. In fact it cost $32.2B. The netting hides the second-largest
             single claim on the company's earnings.

             This is a Misread D case (3.11) with no defense currently specified. The question is
             whether the encoding should render the residual net or decomposed into its components.

             NEW FINDING: This question is only visible once the tagged components arrived. When
             D16 was decided, the fine structure of the residual was not known. D16 decided that
             the residual is carried after the confluence as a shared constriction rather than
             allocated to segments or absorbed into the lake. Whether that constriction draws net
             or decomposed sits underneath D16's answer, not in contradiction to it.

Options:     (Three considered; see docs/product/open-questions.md §Q4 for full detail)

             1. Net pinch, itemized in the detail panel only. Cheapest; leaves the beginner
                with an understated tax figure they cannot detect.
             2. Decomposed: the trunk widens by the non-operating gain (+$10,697M), then narrows
                by the tax (−$32,185M). Both quantities become true on the width channel.
                Costs a widening behavior not yet defined (Q2), and visually creates a
                "where did that water come from" moment.
             3. Net pinch with the tax component annotated at the constriction rather than only
                in the detail panel. Middle cost; states the number without inventing geometry,
                but puts two different magnitudes at one visual element.

Recommendation: (From Product Analyst) Option 3 for the slice, option 2 evaluated at company two.
              Option 2 is the honest encoding; it drags in the widening case and should not be
              the thing that delays the first render.

Impact:      Not blocking anything. C3 (detail panel) proceeds regardless. What is at stake is
             whether the picture's single largest hidden quantity stays hidden: the true tax cost,
             $32,185M, hidden by netting in the visual.

Awaiting:    Angel's decision on net versus decomposed rendering of the trunk, and whether to
             add an annotation layer to constrictions.
