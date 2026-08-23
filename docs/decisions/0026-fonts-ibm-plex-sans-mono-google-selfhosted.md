# 0026 — Fonts: IBM Plex Sans + Mono chosen, google-selfhosted at public/fonts/

Date:        2026-08-21
Status:      accepted
Decided by:  Angel

Context:     The design system needed a font pair for body copy (sans-serif) and code/monospace
             (monospace). Three options were evaluated:

             1. Google Fonts (free, web-hosted) — zero cost but embedded Google tracking, slower
                load from third-party domain.
             2. Licensed acquisition (e.g., commercial font vendor) — professional, but cost
                and licensing complexity.
             3. System fonts (Arial, Monaco, etc.) — zero cost, zero latency, but inconsistent
                across platforms and difficult to control.

             Art Director's recommendation: IBM Plex Sans + Mono, obtained from Google Fonts,
             self-hosted at public/fonts/ for stable preload URLs and zero third-party tracking.

Options:     1. Google Fonts CDN (free, but third-party dependency and tracking).
             2. Licensed fonts (professional, but cost and licensing).
             3. System fonts (zero cost, inconsistent, harder to style).
             4. IBM Plex (open-source, self-hosted, zero third-party dependency, free).

Decision:    Option 4. IBM Plex Sans (body) + IBM Plex Mono (code) obtained as open-source
             binaries, stored in public/fonts/, and served with stable preload URLs. Font files
             are committed to the repo.

Consequence: The design is no longer host-dependent on Google's infrastructure. Load times are
             stable and predictable. The font pair is locked in: any future typographic work
             compares against IBM Plex. Zero licensing cost. Zero third-party tracking.