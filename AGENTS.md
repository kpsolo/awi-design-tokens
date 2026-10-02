# Project Rules & Guidelines: AWI Design Tokens

Refer to [cloude.md](file:///c:/Work/AWI/cloude.md) for full project context, brand tokens, and verification tools.

## 🎨 Color & Gradient Format Rules
* **Always use `rgba(...)` format**: For any transparent color or opacity values, always use standard comma-separated `rgba(r, g, b, a)` format (e.g. `rgba(89, 59, 3, 0.15)`).
* **Gradients**: All color stops with transparency in `linear-gradient(...)` and `radial-gradient(...)` must use `rgba(r, g, b, a)` format.
* **No Modern CSS Slash Syntax**: Never use or preserve CSS Color Module 4 slash syntax (`rgb(r g b / a)` or `hsl(h s l / a)`). Always convert to `rgba(r, g, b, a)`.

## 🤖 General Rules
* **Pure Config Repo**: Do not attempt to run or compile web applications.
* **Token Studio `-copy` Artifacts**: Strip or deduplicate `-copy` tokens.
* **Multi-Brand Parity**: Every token must exist in all three brands (`Awi.Awintura`, `Awi.Maggico`, `Awi.Twindor`).
* **Verification**: Run `npm run verify:parity` or `node scripts/verify-sync.js --parity` to ensure parity.
