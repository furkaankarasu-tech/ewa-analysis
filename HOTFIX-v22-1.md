# EWA Radar v22.1 | TypeScript build hotfix

Based directly on v22 (the restored v20 design). This is a targeted fix, not a redesign.

- `app/page.tsx`: removed a leftover `translatedFields`/`original-copy` block that referenced an undefined variable and duplicated the original English text. This resolves the root cause of the five related TypeScript errors reported during `pnpm run build:vercel`.
- Preserved the existing v20 two-column layout and CSS, the v22 Turkish-first/English-below recommendation cards, and local browser translation fallback.
- Added a regression test in `qa/v22.test.mjs` to detect accidental reintroduction.

## Verification

- Run `node --experimental-strip-types --test qa/*.test.mjs` after installing dependencies.
- Run `pnpm run build:vercel` on Vercel or in an environment with project dependencies to perform the full Next.js + TypeScript check.
- This environment could not install pnpm because registry.npmjs.org DNS lookup failed, so a full Next.js/Vercel build could not be independently run here. Do not interpret passing syntax or unit tests as a full deployment check.
