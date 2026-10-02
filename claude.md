# Project Context: AWI Multibrand Design Tokens

See [cloude.md](file:///c:/Work/AWI/cloude.md) for primary documentation.

This repository acts as the central source of truth for **design tokens** across the **AWI** multi-brand web applications stack. It contains token configuration files managed and exported via the **Tokens Studio for Figma** plugin, which frontend developers consume to generate brand-specific style assets and CSS custom properties (variables) using:
* `style-dictionary: ^5.0.1`
* `@tokens-studio/sd-transforms: ^2.0.1`

---

## 🛠️ Verification & Build Commands

| Command | Description |
|---|---|
| `npm run verify` | Baseline comparison against `Awi.Awintura` |
| `npm run verify:summary` | Show only the summary comparison table |
| `npm run verify:parity` | **Full multi-brand parity check** against the union of all tokens |
| `npm run verify:parity:summary` | Parity check summary table only |
| `npm run verify:matrix` | **Disparity matrix table** displaying which brand has/lacks each token |
| `npm run verify:json` | Machine-readable JSON output (for CI/CD pipelines) |
| `npm run test:transform` | **Runs Style Dictionary v5 + sd-transforms transformation test** |
| `npm run test:transform:clean` | Tests transformation and cleans up build output |
| `npm run build:css` | Generates compiled CSS variables into `dist/css/` |

Refer to [cloude.md](file:///c:/Work/AWI/cloude.md) for full instructions, format rules, pipeline details, and disparity audit.
