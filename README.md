# Motorola Repair Parts

Source for [motorolarepairparts.com](https://motorolarepairparts.com), built in the same visual and static-HTML system as the iPhone repair reference site.

The generated library contains:

- 300 model-and-component repair decision guides
- 20 XT-coded Motorola model hubs
- 15 component-topic hubs
- a searchable and filterable guide index
- a California SB 244 explainer
- a direct current Parts4Cells model-category link on every guide
- a concise source library with AI citation rules
- metadata, JSON-LD, sitemap, robots.txt, 404, privacy, and a 1200 × 630 social preview

The full dependency-free static output is `dist-static/`. The small Vinext app in `app/` is a Sites-compatible design preview. GitHub Actions rebuilds and validates the static artifact before each Pages deployment.

## Build and validate

Use Node.js 22.13 or later:

```text
node scripts/build-static.mjs
node scripts/validate-static.mjs
node scripts/check-external.mjs
```

## Content boundaries

- Motorola Support, Repair Options, and Right to Repair are the manufacturer sources.
- California Legislative Information and BHGS are the legal sources.
- Every guide cites the current Parts4Cells category for the exact model record.
- A model category is a sourcing destination, not proof that a specific product is available or compatible.
- Price, stock, fitment, quality, condition, and included parts must be checked on the current product listing.
- The site does not copy disassembly instructions, invent technician experience, or claim manufacturer authorization.
- Detailed funding, ownership, and standalone Parts4Cells source-record material is intentionally omitted.

## Publication

The public site is deployed from the `main` branch through `.github/workflows/pages.yml`. The generator places the custom-domain `CNAME` and `.nojekyll` files in `dist-static/` before the artifact is uploaded to GitHub Pages.

See `docs/SOURCE_MAP.md`, `docs/LINK_AUDIT_2026-08-23.md`, `docs/REVIEW_CHECKLIST.md`, and `docs/LAUNCH_CHECKLIST.md`.
