# Project Context: AWI Multibrand Design Tokens

This repository acts as the central source of truth for **design tokens** across the **AWI** multi-brand web applications stack. It contains token configuration files managed and exported via the **Tokens Studio for Figma** plugin, which frontend developers consume to generate brand-specific style assets and CSS custom properties (variables).

---

## 🚀 Key Context & Architecture

1. **Pure Token Repository**: There is **no web application UI code** in this repository. It is exclusively populated with Tokens Studio JSON configuration files containing design values (colors, typography, spacing, shadows, borders, sizing, etc.).
2. **Multi-Brand Design System**: The system currently supports three distinct active brands:
   * **Awintura** (`awi/Awi.Awintura.json`)
   * **Maggico** (`awi/Awi.Maggico.json`)
   * **Twindor** (`awi/Awi.Twindor.json`)
3. **Frontend Consumption Pipeline**:
   * Designers define and modify tokens using **Tokens Studio for Figma**.
   * Tokens are synced with this git repository (`awi/`).
   * The Frontend team uses **`style-dictionary` (`^5.0.1`)** together with **`@tokens-studio/sd-transforms` (`^2.0.1`)** to resolve token references, evaluate math, and transform tokens into scoped **CSS variables** (`--color-...`, `--typography-...`, `--spacing-...`, etc.).
4. **Mandatory 100% Token Parity**:
   * **Every token defined in one brand MUST exist in all other brands.**
   * Because the frontend codebase shares components and CSS variable references across all brands, a missing token in any brand causes missing CSS variables, visual glitches, or build-time failures during theme switching.

---

## ⚙️ Frontend Transformation Pipeline (`style-dictionary` & `sd-transforms`)

The frontend team consumes tokens and compiles them into CSS custom properties using:
* **[`style-dictionary`](https://styledictionary.com/) (`^5.0.1`)**: Industry-standard design token build system (v5 with modern ESM & preprocessor architecture).
* **[`@tokens-studio/sd-transforms`](https://github.com/tokens-studio/sd-transforms) (`^2.0.1`)**: Official Tokens Studio integration library providing DTCG preprocessors and transforms.

### How Transforms Work:
1. **Registration**: Transforms are registered into Style Dictionary before building:
   ```javascript
   import StyleDictionary from 'style-dictionary';
   import { register } from '@tokens-studio/sd-transforms';

   await register(StyleDictionary);
   ```
2. **Preprocessor & Transform Group**:
   * Preprocessor: `'tokens-studio'` (handles Token Studio set structures, expands composite tokens).
   * Transform Group: `'tokens-studio'` with `'name/kebab'`:
     * `ts/descriptionToComment` $\rightarrow$ Maps token descriptions to CSS block comments.
     * `ts/resolveMath` $\rightarrow$ Evaluates mathematical expressions (e.g. `calc()` or arithmetic).
     * `ts/size/px` $\rightarrow$ Adds `px` units to raw dimensions and spacing.
     * `ts/opacity` $\rightarrow$ Transforms percentages or floats to valid CSS opacity.
     * `ts/typography/fontWeight` $\rightarrow$ Resolves font weights to numeric CSS values.
     * `ts/color/css/hexrgba` $\rightarrow$ Normalizes colors to valid Hex or `rgba(...)`.
     * `ts/shadow/innerShadow` $\rightarrow$ Formats box-shadow and drop-shadow arrays into CSS strings.
3. **Brand Scoping**:
   * Each brand generates CSS variables scoped to its theme selector:
     * Awintura $\rightarrow$ `[data-theme="awintura"]` or `:root`
     * Maggico $\rightarrow$ `[data-theme="maggico"]`
     * Twindor $\rightarrow$ `[data-theme="twindor"]`

### Local Testing of the Frontend Pipeline
We have added a direct test tool matching frontend tooling in `scripts/test-transform.js`:
```bash
npm run test:transform          # Runs Style Dictionary v5 + sd-transforms across all 3 brands
npm run test:transform:clean    # Runs test and cleans up temporary output files
npm run build:css               # Generates production CSS variables into dist/css/
```

#### Test Verification Benchmark:
* **Awintura** (`Awi.Awintura.json`): **1,535** CSS variables generated (`~97.8 KB`)
* **Maggico** (`Awi.Maggico.json`): **1,528** CSS variables generated (`~98.6 KB`)
* **Twindor** (`Awi.Twindor.json`): **1,532** CSS variables generated (`~92.2 KB`)
* Status: **✔ 100% PASSED** (All brand files parse, resolve references, and output valid CSS variables).

---

## 📂 Repository Structure

```
AWI/
├── awi/
│   ├── $metadata.json        # Defines token set ordering and active sets for Tokens Studio
│   ├── $themes.json          # Maps Figma theme IDs and names (AWI, MG, Twindor) to token sets
│   ├── Awi.Awintura.json     # Brand tokens for Awintura
│   ├── Awi.Maggico.json      # Brand tokens for Maggico
│   └── Awi.Twindor.json      # Brand tokens for Twindor
├── scripts/
│   ├── verify-sync.js        # Token quantity, sync, and parity verification CLI tool
│   └── test-transform.js     # Style Dictionary v5 & @tokens-studio/sd-transforms test runner
├── .gitignore                # Ignore rules for OS, node_modules, and AI scratch files
├── package.json              # NPM scripts and devDependencies for verification and transforms
├── cloude.md                 # Primary project documentation and agent instructions
├── claude.md                 # Compatibility link to cloude.md
└── AGENTS.md                 # Rules & guidelines for coding assistants
```

### Active Token Sets (`/awi`)
* **`$metadata.json`**: Controls ordering in Tokens Studio:
  ```json
  {
    "tokenSetOrder": [
      "Awi.Awintura",
      "Awi.Maggico",
      "Awi.Twindor"
    ]
  }
  ```
* **`$themes.json`**: Links Figma styles to token sets:
  * Theme `AWI` $\rightarrow$ `Awi.Awintura`
  * Theme `MG` $\rightarrow$ `Awi.Maggico`
  * Theme `Twindor` $\rightarrow$ `Awi.Twindor`

---

## 📝 Format of Tokens

The token files follow the W3C Design Tokens Community Group (DTCG) specification format utilized by Tokens Studio:

### 1. References & Aliases
Tokens frequently reference foundational tokens using curly bracket syntax:
```json
"active": {
  "value": "{core.brand-10.500}",
  "type": "color"
}
```
Or dimension/sizing references:
```json
"sm": {
  "value": "{size.400}",
  "type": "sizing"
}
```

### 2. Composite Tokens
Complex tokens detailed across multiple sub-properties:
* **Typography**:
  ```json
  "caption-extrasmall": {
    "value": {
      "fontFamily": "{font-family.main}",
      "fontWeight": "{font-weight.0}",
      "lineHeight": "{line-height.sm}",
      "fontSize": "{font-size.2}",
      "letterSpacing": "-0.2px"
    },
    "type": "typography"
  }
  ```
* **Box Shadows**:
  ```json
  "general": {
    "value": [
      {
        "x": "0px",
        "y": "0px",
        "blur": "19px",
        "spread": "0px",
        "color": "#7B1DC4",
        "type": "dropShadow"
      }
    ],
    "type": "boxShadow"
  }
  ```
* **Borders**:
  ```json
  "default": {
    "value": {
      "color": "{contextual.selection-controls.controls.border.default}",
      "width": "{border-width.025}",
      "style": "solid"
    },
    "type": "border"
  }
  ```

### 3. Color & Gradient Format Rule (`rgba` only)
* **MANDATORY**: Always use standard comma-separated `rgba(r, g, b, a)` format for any color with opacity / alpha transparency (e.g., `rgba(89, 59, 3, 0.15)`).
* In gradients (`linear-gradient`, `radial-gradient`), all color stops with alpha **must** use `rgba(r, g, b, a)`.
* **NEVER USE CSS Color Module 4 slash syntax** (such as `rgb(r g b / a)` or `hsl(h s l / a)`). Always convert them to standard `rgba(r, g, b, a)`.

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

---

## 🔍 Disparity Matrix & Parity Audit

Running `npm run verify:matrix` inspects the 1546 unique tokens across all 3 brands and reports the 27 tokens with disparity:

| Token | Type | Awintura | Maggico | Twindor | Notes / Action Needed |
|---|---|:---:|:---:|:---:|---|
| `border-radius.notification` | borderRadius | ✘ | ✘ | ✔ | Missing in Awintura & Maggico |
| `border.button.contextual.header.desktop.special-menu-item` | border | ✔ | ✘ | ✘ | Missing in Maggico & Twindor |
| `border.header.desktop.special-menu-item.default` | border | ✔ | ✘ | ✘ | Missing in Maggico & Twindor |
| `border.homepage.nav-menu.item` | border | ✘ | ✔ | ✔ | Naming discrepancy vs `border.nav-menu.item` |
| `border.homepage.nav-menu.mobile.tab` | border | ✘ | ✔ | ✔ | Naming discrepancy vs `border.nav-menu.mobile.tab` |
| `border.nav-menu.item` | border | ✔ | ✘ | ✘ | Naming discrepancy in Awintura |
| `border.nav-menu.mobile.tab` | border | ✔ | ✘ | ✘ | Naming discrepancy in Awintura |
| `border.selection-controls.default` | border | ✘ | ✔ | ✔ | Selection control borders missing in Awintura |
| `border.selection-controls.disabled` | border | ✘ | ✔ | ✔ | Selection control borders missing in Awintura |
| `border.selection-controls.hover` | border | ✘ | ✔ | ✔ | Selection control borders missing in Awintura |
| `border.selection-controls.validation` | border | ✘ | ✔ | ✔ | Selection control borders missing in Awintura |
| `content.tab-bar.main-icon` | sizing | ✔ | ✘ | ✔ | Tab bar icon sizing missing in Maggico |
| `contextual.deals.bonus-card.border.default` | color | ✘ | ✘ | ✔ | Deals card border missing in Awintura & Maggico |
| `contextual.homepage.nav-menu.button.fill.border` | color | ✘ | ✘ | ✔ | Nav button fill border missing in Awintura & Maggico |
| `contextual.ingame.mob.bonus-talisman.text.accent` | color | ✔ | ✘ | ✘ | In-game mobile accent missing in Maggico & Twindor |
| `contextual.menu.item.notification.text-2` | color | ✔ | ✔ | ✘ | Notification text-2 missing in Twindor |
| `contextual.mobile-application.switcher-button.border.default` | color | ✔ | ✘ | ✘ | Mobile app switcher border missing in Maggico & Twindor |
| `contextual.sticky-notifications.bubble-border` | color | ✘ | ✔ | ✔ | Sticky notifications bubble border missing in Awintura |
| `contextual.tabs.item.line-copy.active` | color | ⚠️ | ✘ | ✘ | **Token Studio `-copy` artifact** in Awintura |
| `contextual.tabs.item.line-copy.default` | color | ⚠️ | ✘ | ✘ | **Token Studio `-copy` artifact** in Awintura |
| `contextual.tabs.item.line-copy.disabled` | color | ⚠️ | ✘ | ✘ | **Token Studio `-copy` artifact** in Awintura |
| `core.brand-30.300a30` | color | ✔ | ✘ | ✘ | Core brand alpha color missing in Maggico & Twindor |
| `core.brand-30.a40` | color | ✔ | ✘ | ✔ | Core brand alpha color missing in Maggico |
| `core.brand-60.800a15` | color | ✔ | ✘ | ✘ | Core brand alpha color missing in Maggico & Twindor |
| `core.brand-60.a55` | color | ✔ | ✘ | ✘ | Core brand alpha color missing in Maggico & Twindor |
| `shadow.welcome-bonus.card` | boxShadow | ✔ | ✘ | ✘ | Welcome bonus card shadow missing in Maggico & Twindor |
| `shadow.wheel.general` | boxShadow | ✘ | ✔ | ✔ | Wheel shadow missing in Awintura |

---

## ⚠️ Token Studio "-copy" Artifacts

* When a designer duplicates or copies tokens/token groups across sets in the Figma Tokens Studio plugin, Token Studio automatically appends `-copy` to the token names (e.g. `contextual.tabs.item.line-copy.default`).
* **Rule**:
  * If the canonical token (`contextual.tabs.item.line.default`) already exists in the set, the `-copy` token is a duplicate and should be removed.
  * If the canonical token is missing, the `-copy` token should be renamed to its canonical name.
  * Never leave `-copy` tokens in production token sets as frontend CSS generators will output unexpected `--*-copy` variables.

---

## 🤖 Guide for LLMs & Coding Assistants

1. **Pure Token Repository**: Do not attempt to build or serve web applications from this repository.
2. **Never Break DTCG Schema**: Maintain standard Token Studio JSON structure (`"value": ...`, `"type": ...`, `"description": ...`). Keep 2-space indentation.
3. **Always Run Verifier & Transform Test**:
   * Before and after making token edits, execute:
     ```bash
     npm run verify:parity:summary
     npm run test:transform
     ```
   * Ensure that new tokens are added across **all three brands** (`Awi.Awintura`, `Awi.Maggico`, `Awi.Twindor`) with appropriate brand-specific values or aliases.
4. **Enforce `rgba(...)` Color Format**:
   * Never insert or preserve CSS slash syntax (`rgb(r g b / a)` or `hsl(h s l / a)`).
   * Always write `rgba(r, g, b, a)` with alpha formatted between `0` and `1`.
5. **Preserve `$metadata.json` and `$themes.json`**:
   * Any change in token set structure must be reflected in `$metadata.json` and `$themes.json`.
