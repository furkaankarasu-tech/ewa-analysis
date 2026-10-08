# v37 · Porcelain / Translation workflow repair

- Switched the analysis workspace to the porcelain/slate palette and kept the selected architectural hero and SAP sign. The new theme loads after existing theme layers.
- Added a visible, actionable on-device translation panel with counts for reviewed Turkish and remaining English. No placeholder translations or invented metrics.
- After explicit installation consent, remembers **only** that browser preference (not report content); future reports prefer the locally cached translation model automatically.
- Added an English-source label on finding headings still awaiting translation and kept the original SAP evidence accessible.
- Core parser, severity determination and exports intentionally unchanged.
- First use requires downloading hundreds of MB of public language-model files. Model inference runs locally in a browser worker; model runtime success and production deployment are **not** established by static tests.
