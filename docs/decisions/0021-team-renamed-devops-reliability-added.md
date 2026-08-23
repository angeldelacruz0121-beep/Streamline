# 0021 — Team renamed and DevOps/Reliability Engineer roles added

Date:        2026-08-21
Status:      accepted
Decided by:  Angel

Context:     The project team was carrying abbreviated role names (Ledger, Cartographer, Keel,
             Conduit, Forge, Atelier, Adversary, Advocate, Archivist) inherited from the early
             planning phase. As the project scales, these names became opaque to stakeholders and
             difficult to map to standard roles.

             Additionally, two roles were initially missing from the protocol: DevOps Engineer
             (who ships and can undo a bad ship) and Reliability Engineer (who says something is
             wrong before a user does). Both are critical to the operational phase.

Decision:    Rename nine agents to their functional titles; add DevOps Engineer and Reliability
             Engineer to the team roster.

             Old name → New name mapping:
             | Ledger | Financial Data Analyst |
             | Cartographer | Data Visualization Engineer |
             | Keel | Software Architect |
             | Conduit | Data Engineer |
             | Forge | Performance Engineer |
             | Atelier | Art Director |
             | Adversary | QA Engineer |
             | Advocate | Product Analyst |
             | Archivist | Technical Writer |
             | (new) | DevOps Engineer |
             | (new) | Reliability Engineer |

             The protocol gained three additions:
             - §2: Team table now lists all 11 agents with role and invoke name
             - All escalation triggers: added "Reversible: yes | costly | no" line with plain-language
               consequence explanation for decisions expensive to reverse
             - §6: Sequencing note clarifies that DevOps Engineer establishes CI and deployment
               early (not at the end), and Reliability Engineer is stood up before anything is
               shown to a person outside the project

Consequence: All historical decision records keep their historical agent names and protocol
             section numbers — this record makes the old names decodable for anyone reading
             earlier records. STATUS.md §1 (agent state) and §4 (open decisions) are refreshed
             to use new names, as is the sequencing table §2. All agent invocations going forward
             use the new names and invoke aliases. The reversibility trigger and plain-language
             consequence requirement applies to all future escalations.