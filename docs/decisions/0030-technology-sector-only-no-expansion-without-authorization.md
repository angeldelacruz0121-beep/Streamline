# 0030 — Technology sector only; no expansion without Angel's authorization

Date:        2026-08-23
Status:      accepted (process correction)
Decided by:  Angel

Context:     During 2026-08-22/23, the working set of companies expanded from Microsoft alone
             to a 19-filer test corpus without Angel's sign-off. That expansion found a live
             wrong figure (Autodesk, documented in 0016's sibling case) and several real
             defects, but the expansion itself was not authorized.

Decision:    Lock down the technology sector completely — company lookup, rivers, lake, the
             whole idea working flawlessly — before any other sector. Then move to the next of
             the seven sectors. STOP adding companies to the working set without Angel's
             authorization.

Consequence: Microsoft is the target; other filers exist as regression checks only. Coverage
             remains SIC 3570–3579, 3674, 7370–7379 (3674 added earlier this session; 7389
             explicitly rejected as out of scope). No agent may add new companies to the test
             corpus without Angel's explicit approval. This is a standing constraint for the
             duration of the project.

             The early expansion did prove the pipeline's resilience and found correctness
             defects — these were valuable discoveries — but the process must center on Angel's
             authorization going forward. Uncontrolled growth obscures which changes drove which
             findings.
