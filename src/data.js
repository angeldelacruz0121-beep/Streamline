// The only hardcoded numbers in the project. Everything visual is derived from these.
// Fictional large-cap: Halcyon Systems. Four deliberately contrasting profiles —
// the contrast between them is what proves the visual works.

export const COMPANY = 'Halcyon Systems'

export const SEGMENTS = [
  {
    id: 'devices',
    name: 'Devices',
    // huge but low-margin: enters wide, arrives at ~27% of its entry width
    grossRevenue: 46_200_000_000,
    costs: [
      { label: 'Cost of goods', amount: 28_100_000_000 },
      { label: 'R&D', amount: 5_400_000_000 },
    ],
  },
  {
    id: 'cloud',
    name: 'Cloud Platform',
    // mid-sized with a heavy R&D drag
    grossRevenue: 24_800_000_000,
    costs: [
      { label: 'Infrastructure', amount: 9_600_000_000 },
      { label: 'R&D', amount: 8_900_000_000 },
    ],
  },
  {
    id: 'licensing',
    name: 'Licensing',
    // small but nearly pure margin: barely narrows on the way in
    grossRevenue: 6_100_000_000,
    costs: [
      { label: 'Cost of revenue', amount: 380_000_000 },
      { label: 'Sales & marketing', amount: 520_000_000 },
    ],
  },
  {
    id: 'legacy',
    name: 'Legacy Hardware',
    // shrinking: a respectable entry that arrives as a thread
    grossRevenue: 9_400_000_000,
    costs: [
      { label: 'Cost of goods', amount: 7_200_000_000 },
      { label: 'Restructuring', amount: 1_600_000_000 },
    ],
  },
]

export function netOf(segment) {
  return segment.grossRevenue - segment.costs.reduce((s, c) => s + c.amount, 0)
}

export const MAX_GROSS = Math.max(...SEGMENTS.map((s) => s.grossRevenue))
