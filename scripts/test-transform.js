#!/usr/bin/env node

/**
 * AWI Design Tokens Transformation Test CLI
 *
 * Tests the frontend pipeline using:
 *  - style-dictionary: ^5.0.1
 *  - @tokens-studio/sd-transforms: ^2.0.1
 *
 * Simulates how the frontend transforms Tokens Studio Figma tokens into CSS variables
 * across all brands (Awintura, Maggico, Twindor) and verifies that references resolve properly.
 *
 * Usage:
 *   node scripts/test-transform.js [options]
 *
 * Options:
 *   -b, --brand <name>     Test only a specific brand (e.g. "awintura", "maggico", "twindor")
 *   --out-dir <path>       Output directory for generated CSS (default: "build/test-css")
 *   --clean                Remove output directory after testing
 *   -h, --help             Show help message
 */

const fs = require('fs');
const path = require('path');
const StyleDictionary = require('style-dictionary').default;
const { register } = require('@tokens-studio/sd-transforms');

// ANSI escape codes for formatting
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

if (process.env.NO_COLOR || !process.stdout.isTTY) {
  Object.keys(c).forEach(k => (c[k] = ''));
}

// Parse arguments
const args = process.argv.slice(2);
let targetBrand = null;
let outDir = path.resolve(__dirname, '..', 'build', 'test-css');
let cleanAfter = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-b' || arg === '--brand') {
    targetBrand = args[++i];
  } else if (arg === '--out-dir') {
    outDir = path.resolve(process.cwd(), args[++i]);
  } else if (arg === '--clean') {
    cleanAfter = true;
  } else if (arg === '-h' || arg === '--help') {
    console.log(`
${c.bold}AWI Design Tokens Frontend Transformation Test${c.reset}

${c.cyan}Usage:${c.reset}
  node scripts/test-transform.js [options]

${c.cyan}Options:${c.reset}
  -b, --brand <name>     Test only a specific brand ("awintura", "maggico", "twindor")
  --out-dir <path>       Output directory for generated CSS (default: "build/test-css")
  --clean                Remove generated files after testing
  -h, --help             Show help message
`);
    process.exit(0);
  }
}

const rootDir = path.resolve(__dirname, '..');
const awiDir = path.join(rootDir, 'awi');

const BRANDS = [
  {
    name: 'Awintura',
    file: path.join(awiDir, 'Awi.Awintura.json'),
    selector: '[data-theme="awintura"]',
    outFile: 'variables-awintura.css',
  },
  {
    name: 'Maggico',
    file: path.join(awiDir, 'Awi.Maggico.json'),
    selector: '[data-theme="maggico"]',
    outFile: 'variables-maggico.css',
  },
  {
    name: 'Twindor',
    file: path.join(awiDir, 'Awi.Twindor.json'),
    selector: '[data-theme="twindor"]',
    outFile: 'variables-twindor.css',
  },
];

async function run() {
  console.log(`\n${c.bold}================================================================${c.reset}`);
  console.log(`${c.bold}   Style Dictionary + @tokens-studio/sd-transforms Test         ${c.reset}`);
  console.log(`${c.bold}================================================================${c.reset}`);
  console.log(`${c.gray}Style Dictionary Version:${c.reset}       ${c.cyan}${StyleDictionary.VERSION}${c.reset}`);
  console.log(`${c.gray}sd-transforms Registered:${c.reset}       ${c.green}Yes (@tokens-studio/sd-transforms)${c.reset}`);
  console.log(`${c.gray}CSS Output Directory:${c.reset}           ${c.yellow}${path.relative(rootDir, outDir)}${c.reset}\n`);

  // Register sd-transforms with Style Dictionary
  await register(StyleDictionary);

  let brandsToTest = BRANDS;
  if (targetBrand) {
    const norm = targetBrand.toLowerCase().replace(/^awi\./, '');
    brandsToTest = BRANDS.filter(b => b.name.toLowerCase() === norm);
    if (brandsToTest.length === 0) {
      console.error(`${c.red}Error: Brand "${targetBrand}" not recognized.${c.reset}`);
      console.error(`Available brands: ${BRANDS.map(b => b.name).join(', ')}`);
      process.exit(1);
    }
  }

  const results = [];
  let hasErrors = false;

  for (const brand of brandsToTest) {
    process.stdout.write(`Testing ${c.bold}${brand.name}${c.reset} (${path.basename(brand.file)})... `);
    const startTime = Date.now();

    try {
      const sd = new StyleDictionary({
        source: [brand.file],
        preprocessors: ['tokens-studio'],
        platforms: {
          css: {
            transformGroup: 'tokens-studio',
            transforms: ['name/kebab'],
            buildPath: outDir.replace(/\\/g, '/') + '/',
            files: [
              {
                destination: brand.outFile,
                format: 'css/variables',
                options: {
                  selector: brand.selector,
                },
              },
            ],
          },
        },
        log: {
          verbosity: 'silent', // keep terminal output clean
        },
      });

      await sd.buildAllPlatforms();
      const elapsedMs = Date.now() - startTime;

      const fullOutPath = path.join(outDir, brand.outFile);
      const cssContent = fs.readFileSync(fullOutPath, 'utf8');

      // Count generated variables
      const varMatches = cssContent.match(/--[a-zA-Z0-9_-]+:/g) || [];
      const varCount = varMatches.length;
      const fileSizeBytes = fs.statSync(fullOutPath).size;

      console.log(`${c.green}✔ PASSED${c.reset} (${varCount} CSS variables generated, ${(fileSizeBytes / 1024).toFixed(1)} KB in ${elapsedMs}ms)`);

      results.push({
        brand: brand.name,
        status: 'PASSED',
        varCount,
        fileSize: fileSizeBytes,
        elapsedMs,
      });
    } catch (err) {
      console.log(`${c.red}✘ FAILED${c.reset}`);
      console.error(`  ${c.red}Error:${c.reset} ${err.message}`);
      hasErrors = true;
      results.push({
        brand: brand.name,
        status: 'FAILED',
        error: err.message,
      });
    }
  }

  console.log(`\n${c.bold}----------------------------------------------------------------${c.reset}`);
  console.log(`${c.bold}Transformation Test Summary:${c.reset}`);
  console.log(`${c.bold}----------------------------------------------------------------${c.reset}`);

  for (const r of results) {
    const statusStr = r.status === 'PASSED' ? `${c.green}✔ PASSED${c.reset}` : `${c.red}✘ FAILED${c.reset}`;
    const details = r.status === 'PASSED'
      ? `${r.varCount} variables | ${(r.fileSize / 1024).toFixed(1)} KB | ${r.elapsedMs}ms`
      : `Error: ${r.error}`;
    console.log(`  ${r.brand.padEnd(12)}: ${statusStr}  ${c.gray}(${details})${c.reset}`);
  }

  if (cleanAfter && fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
    console.log(`\n${c.dim}Cleaned up temporary output directory: ${outDir}${c.reset}`);
  } else {
    console.log(`\n${c.gray}Generated CSS variables files stored in:${c.reset} ${c.cyan}${path.relative(rootDir, outDir)}${c.reset}`);
  }

  if (hasErrors) {
    console.log(`\n${c.red}${c.bold}One or more brand token sets failed transformation!${c.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${c.green}${c.bold}All brand token sets successfully transformed with Style Dictionary v5 and @tokens-studio/sd-transforms!${c.reset}\n`);
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal error running transform test:', err);
  process.exit(1);
});
