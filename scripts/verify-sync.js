#!/usr/bin/env node

/**
 * AWI Multibrand Design Tokens Synchronization & Parity Verifier
 *
 * Verifies token quantity, parity, and consistency across all brands (Awintura, Maggico, Twindor)
 * for the Tokens Studio (Figma) -> Frontend CSS Variables pipeline.
 *
 * Mode 1: Baseline Comparison (default: Awi.Awintura)
 *   Compares each theme against baseline to detect missing tokens, extra tokens,
 *   type mismatches, and "-copy" artifacts.
 *
 * Mode 2: Multi-Brand Parity (--parity, -p)
 *   Verifies that ALL brands have 100% of tokens defined across the entire design system union.
 *   Ensures frontend developers never encounter missing CSS variables in any brand.
 *
 * Mode 3: Disparity Matrix (--matrix, -m)
 *   Displays a cross-brand comparison table for all tokens that are not present in every brand.
 *
 * Usage:
 *   node scripts/verify-sync.js [options]
 *
 * Options:
 *   -s, --summary-only        Show only the summary table
 *   -t, --theme <name>        Inspect only a specific theme (e.g. "maggico", "twindor")
 *   -b, --base <name>         Baseline theme (default: "Awi.Awintura")
 *   -p, --parity              Verify full multi-brand parity against union of all tokens
 *   -m, --matrix              Show cross-brand disparity matrix table
 *   -f, --filter <pattern>    Filter displayed tokens by substring or regex pattern
 *   --json                    Output results in JSON format
 *   -h, --help                Show this help message
 */

const fs = require('fs');
const path = require('path');

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

// Parse command line arguments
const args = process.argv.slice(2);
let summaryOnly = false;
let targetTheme = null;
let baseThemeName = 'Awi.Awintura';
let parityMode = false;
let matrixMode = false;
let filterPattern = null;
let outputJson = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '-s' || arg === '--summary-only') {
    summaryOnly = true;
  } else if (arg === '-t' || arg === '--theme') {
    targetTheme = args[++i];
  } else if (arg === '-b' || arg === '--base') {
    baseThemeName = args[++i];
  } else if (arg === '-p' || arg === '--parity') {
    parityMode = true;
  } else if (arg === '-m' || arg === '--matrix') {
    matrixMode = true;
  } else if (arg === '-f' || arg === '--filter') {
    filterPattern = args[++i];
  } else if (arg === '--json') {
    outputJson = true;
  } else if (arg === '-h' || arg === '--help') {
    console.log(`
${c.bold}AWI Multibrand Design Tokens Synchronization Verifier${c.reset}

${c.cyan}Usage:${c.reset}
  node scripts/verify-sync.js [options]

${c.cyan}Options:${c.reset}
  -s, --summary-only        Show only the summary table
  -t, --theme <name>        Inspect only a specific theme (e.g. "maggico", "twindor")
  -b, --base <name>         Baseline theme (default: "Awi.Awintura")
  -p, --parity              Verify full multi-brand parity against union of all tokens
  -m, --matrix              Display cross-brand disparity matrix table
  -f, --filter <pattern>    Filter displayed tokens by substring or regex pattern
  --json                    Output results in JSON format
  -h, --help                Show this help message

${c.yellow}Brand Aliases Accepted:${c.reset}
  "awintura", "awi"     -> Awi.Awintura
  "maggico", "mg"       -> Awi.Maggico
  "twindor", "twi"      -> Awi.Twindor

${c.yellow}Token Studio "-copy" Artifacts:${c.reset}
  Tokens ending in "-copy" (e.g. "contextual.tabs.item.line-copy.default") are created
  automatically by Token Studio when duplicating tokens in Figma. The tool flags them
  so they can be cleanly renamed to canonical names or removed.
`);
    process.exit(0);
  }
}

// Find token sets directory (awi/ or themes/)
const rootDir = path.resolve(__dirname, '..');
let tokensDir = path.join(rootDir, 'awi');
if (!fs.existsSync(tokensDir)) {
  tokensDir = path.join(rootDir, 'themes');
}
if (!fs.existsSync(tokensDir)) {
  tokensDir = rootDir;
}

const metadataPath = path.join(tokensDir, '$metadata.json');

// Discover token set list from $metadata.json or directory
let tokenSets = [];
if (fs.existsSync(metadataPath)) {
  try {
    const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    if (Array.isArray(meta.tokenSetOrder)) {
      tokenSets = meta.tokenSetOrder;
    }
  } catch (err) {
    console.error(`${c.red}Warning: Failed to parse $metadata.json:${c.reset}`, err.message);
  }
}

if (tokenSets.length === 0) {
  tokenSets = fs.readdirSync(tokensDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('$'))
    .map(f => f.replace(/\.json$/, ''));
}

// Brand name alias resolver
function normalizeThemeName(name) {
  if (!name) return name;
  let clean = name.replace(/\.json$/, '');
  const lower = clean.toLowerCase();

  if (lower === 'awintura' || lower === 'awi') return 'Awi.Awintura';
  if (lower === 'maggico' || lower === 'mg') return 'Awi.Maggico';
  if (lower === 'twindor' || lower === 'twi') return 'Awi.Twindor';

  // Case-insensitive match against discovered tokenSets
  const match = tokenSets.find(ts => ts.toLowerCase() === lower);
  if (match) return match;

  if (!clean.startsWith('Awi.') && !clean.includes('.')) {
    const prefixed = 'Awi.' + clean.charAt(0).toUpperCase() + clean.slice(1);
    const prefixMatch = tokenSets.find(ts => ts.toLowerCase() === prefixed.toLowerCase());
    if (prefixMatch) return prefixMatch;
  }

  return clean;
}

baseThemeName = normalizeThemeName(baseThemeName);
if (targetTheme) {
  targetTheme = normalizeThemeName(targetTheme);
}

// Helper to test if a token path is a copy artifact
function isCopyToken(tokenPath) {
  return /-copy(\b|\.|$)|_copy(\b|\.|$)/i.test(tokenPath);
}

// Suggest canonical name by stripping -copy
function getCanonicalSuggestion(tokenPath) {
  return tokenPath.replace(/-copy(-\d+)?|_copy(_\d+)?/gi, '');
}

// Recursively traverse JSON to extract tokens
function extractTokens(obj, currentPath = [], tokenMap = new Map()) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return tokenMap;

  // A token node is identified by the presence of a 'value' property
  if ('value' in obj) {
    tokenMap.set(currentPath.join('.'), {
      path: currentPath.join('.'),
      type: obj.type || 'unknown',
      value: obj.value,
      description: obj.description || '',
    });
  }

  // Also traverse child objects (handles composite/nested token groups)
  for (const [key, val] of Object.entries(obj)) {
    if (
      key !== 'value' &&
      key !== 'type' &&
      key !== 'description' &&
      !key.startsWith('$') &&
      typeof val === 'object' &&
      val !== null
    ) {
      extractTokens(val, [...currentPath, key], tokenMap);
    }
  }

  return tokenMap;
}

function loadTokens(themeName) {
  const filePath = path.join(tokensDir, `${themeName}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return extractTokens(content);
}

// Load all available token maps
const allTokenMaps = new Map();
for (const setName of tokenSets) {
  try {
    allTokenMaps.set(setName, loadTokens(setName));
  } catch (err) {
    console.error(`${c.red}Error loading token set "${setName}":${c.reset} ${err.message}`);
  }
}

if (allTokenMaps.size === 0) {
  console.error(`${c.red}Error: No token sets could be loaded from ${tokensDir}.${c.reset}`);
  process.exit(1);
}

// Build union of all tokens across all sets
const unionTokens = new Map();
for (const [setName, map] of allTokenMaps.entries()) {
  for (const [tokenPath, token] of map.entries()) {
    if (!unionTokens.has(tokenPath)) {
      unionTokens.set(tokenPath, { ...token, sourceThemes: [setName] });
    } else {
      unionTokens.get(tokenPath).sourceThemes.push(setName);
    }
  }
}

// Filter setup
let filterRegex = null;
if (filterPattern) {
  try {
    filterRegex = new RegExp(filterPattern, 'i');
  } catch (e) {
    filterRegex = new RegExp(filterPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
}

// Setup report container
const report = {
  mode: parityMode ? 'parity' : 'baseline',
  timestamp: new Date().toISOString(),
  tokensDirectory: tokensDir,
  availableThemes: Array.from(allTokenMaps.keys()),
  totalUnionTokens: unionTokens.size,
  results: [],
};

// ============================================================================
// MODE: DISPARITY MATRIX
// ============================================================================
if (matrixMode) {
  const disparityList = [];
  for (const [tokenPath, info] of Array.from(unionTokens.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (filterRegex && !filterRegex.test(tokenPath)) continue;
    if (info.sourceThemes.length < allTokenMaps.size) {
      const presence = {};
      for (const setName of allTokenMaps.keys()) {
        presence[setName] = allTokenMaps.get(setName).has(tokenPath);
      }
      disparityList.push({
        token: tokenPath,
        type: info.type,
        presence,
      });
    }
  }

  if (outputJson) {
    console.log(JSON.stringify({ totalDisparities: disparityList.length, disparities: disparityList }, null, 2));
    process.exit(disparityList.length === 0 ? 0 : 1);
  }

  console.log(`\n${c.bold}================================================================${c.reset}`);
  console.log(`${c.bold}         AWI Multibrand Tokens: Cross-Brand Disparity Matrix    ${c.reset}`);
  console.log(`${c.bold}================================================================${c.reset}`);
  console.log(`${c.gray}Total Union Tokens:${c.reset} ${unionTokens.size}`);
  console.log(`${c.gray}Disparity Tokens:${c.reset}   ${disparityList.length === 0 ? c.green + '0 (Perfect Parity!)' : c.red + disparityList.length + ' token(s) missing in one or more brands'}${c.reset}`);
  if (filterPattern) {
    console.log(`${c.gray}Filter Pattern:${c.reset}     ${c.yellow}${filterPattern}${c.reset}`);
  }
  console.log('');

  if (disparityList.length === 0) {
    console.log(`${c.green}${c.bold}✔ All brands have 100% token parity! Every brand contains all ${unionTokens.size} tokens.${c.reset}\n`);
    process.exit(0);
  }

  // Display Matrix Table
  const themeNames = Array.from(allTokenMaps.keys());
  const maxTokenLen = Math.max(28, ...disparityList.map(d => d.token.length));
  const tokenColWidth = Math.min(65, maxTokenLen);

  console.log(
    '| ' +
    'Token'.padEnd(tokenColWidth) +
    ' | ' +
    'Type'.padEnd(12) +
    ' | ' +
    themeNames.map(t => t.replace(/^Awi\./, '').padStart(10)).join(' | ') +
    ' |'
  );
  console.log(
    '|' +
    '-'.repeat(tokenColWidth + 2) +
    '|' +
    '-'.repeat(14) +
    '|' +
    themeNames.map(() => '-'.repeat(12)).join('|') +
    '|'
  );

  for (const item of disparityList) {
    const truncatedToken = item.token.length > tokenColWidth
      ? item.token.slice(0, tokenColWidth - 3) + '...'
      : item.token.padEnd(tokenColWidth);

    const typeStr = (item.type || 'unknown').padEnd(12);
    const presenceCells = themeNames.map(t => {
      const has = item.presence[t];
      return has ? `${c.green}  YES     ${c.reset}` : `${c.red}  MISSING ${c.reset}`;
    }).join(' | ');

    console.log(`| ${truncatedToken} | ${typeStr} | ${presenceCells} |`);
  }
  console.log('\n');
  process.exit(1);
}

// ============================================================================
// MODE: FULL MULTI-BRAND PARITY
// ============================================================================
if (parityMode) {
  let themesToCheck = Array.from(allTokenMaps.keys());
  if (targetTheme) {
    themesToCheck = themesToCheck.filter(t => t.toLowerCase() === targetTheme.toLowerCase());
    if (themesToCheck.length === 0) {
      console.error(`${c.red}Error: Target theme "${targetTheme}" not found.${c.reset}`);
      console.error(`Available themes: ${Array.from(allTokenMaps.keys()).join(', ')}`);
      process.exit(1);
    }
  }

  for (const setName of themesToCheck) {
    const themeTokens = allTokenMaps.get(setName);
    const missing = [];
    const copyTokens = [];
    const typeMismatches = [];

    // Check missing vs union
    for (const [tokenPath, unionToken] of unionTokens.entries()) {
      if (!themeTokens.has(tokenPath)) {
        if (!filterRegex || filterRegex.test(tokenPath)) {
          missing.push({
            path: tokenPath,
            expectedType: unionToken.type,
            presentIn: unionToken.sourceThemes,
          });
        }
      } else {
        const currentToken = themeTokens.get(tokenPath);
        if (unionToken.type !== 'unknown' && currentToken.type !== 'unknown' && unionToken.type !== currentToken.type) {
          if (!filterRegex || filterRegex.test(tokenPath)) {
            typeMismatches.push({
              path: tokenPath,
              expectedType: unionToken.type,
              themeType: currentToken.type,
            });
          }
        }
      }
    }

    // Check -copy artifacts
    for (const [tokenPath, token] of themeTokens.entries()) {
      if (isCopyToken(tokenPath)) {
        if (!filterRegex || filterRegex.test(tokenPath)) {
          const canonical = getCanonicalSuggestion(tokenPath);
          copyTokens.push({
            path: tokenPath,
            canonical,
            existsInTheme: themeTokens.has(canonical),
            existsInUnion: unionTokens.has(canonical),
          });
        }
      }
    }

    report.results.push({
      theme: setName,
      totalTokens: themeTokens.size,
      missingCount: missing.length,
      extraCount: 0,
      typeMismatchCount: typeMismatches.length,
      copyTokensCount: copyTokens.length,
      isSynced: missing.length === 0 && typeMismatches.length === 0 && copyTokens.length === 0,
      missing,
      extra: [],
      typeMismatches,
      copyTokens,
    });
  }

// ============================================================================
// MODE: BASELINE COMPARISON
// ============================================================================
} else {
  if (!allTokenMaps.has(baseThemeName)) {
    console.error(`${c.red}Error: Baseline theme "${baseThemeName}" not found.${c.reset}`);
    console.error(`Available themes: ${Array.from(allTokenMaps.keys()).join(', ')}`);
    process.exit(1);
  }

  const baseTokens = allTokenMaps.get(baseThemeName);

  // Check baseline -copy tokens
  const baseCopyTokens = [];
  for (const [pathKey, token] of baseTokens.entries()) {
    if (isCopyToken(pathKey)) {
      baseCopyTokens.push({
        path: pathKey,
        type: token.type,
        canonical: getCanonicalSuggestion(pathKey),
      });
    }
  }

  report.baseline = {
    theme: baseThemeName,
    totalTokens: baseTokens.size,
    copyTokens: baseCopyTokens,
  };

  let themesToCompare = Array.from(allTokenMaps.keys()).filter(t => t !== baseThemeName);
  if (targetTheme) {
    themesToCompare = themesToCompare.filter(t => t.toLowerCase() === targetTheme.toLowerCase());
    if (themesToCompare.length === 0) {
      console.error(`${c.red}Error: Target theme "${targetTheme}" not found.${c.reset}`);
      console.error(`Available themes: ${Array.from(allTokenMaps.keys()).filter(t => t !== baseThemeName).join(', ')}`);
      process.exit(1);
    }
  }

  for (const themeName of themesToCompare) {
    const themeTokens = allTokenMaps.get(themeName);
    const missing = [];
    const extra = [];
    const typeMismatches = [];
    const copyTokens = [];

    // Missing tokens & type mismatches
    for (const [pathKey, baseToken] of baseTokens.entries()) {
      if (!themeTokens.has(pathKey)) {
        if (!filterRegex || filterRegex.test(pathKey)) {
          missing.push({
            path: pathKey,
            expectedType: baseToken.type,
          });
        }
      } else {
        const themeToken = themeTokens.get(pathKey);
        if (baseToken.type !== 'unknown' && themeToken.type !== 'unknown' && baseToken.type !== themeToken.type) {
          if (!filterRegex || filterRegex.test(pathKey)) {
            typeMismatches.push({
              path: pathKey,
              baselineType: baseToken.type,
              themeType: themeToken.type,
            });
          }
        }
      }
    }

    // Extra tokens & copy tokens
    for (const [pathKey, themeToken] of themeTokens.entries()) {
      if (!baseTokens.has(pathKey)) {
        if (!filterRegex || filterRegex.test(pathKey)) {
          extra.push({
            path: pathKey,
            type: themeToken.type,
          });
        }
      }

      if (isCopyToken(pathKey)) {
        if (!filterRegex || filterRegex.test(pathKey)) {
          const canonical = getCanonicalSuggestion(pathKey);
          copyTokens.push({
            path: pathKey,
            canonical,
            existsInBaseline: baseTokens.has(canonical),
            existsInTheme: themeTokens.has(canonical),
          });
        }
      }
    }

    report.results.push({
      theme: themeName,
      totalTokens: themeTokens.size,
      missingCount: missing.length,
      extraCount: extra.length,
      typeMismatchCount: typeMismatches.length,
      copyTokensCount: copyTokens.length,
      isSynced: missing.length === 0 && extra.length === 0 && typeMismatches.length === 0 && copyTokens.length === 0,
      missing,
      extra,
      typeMismatches,
      copyTokens,
    });
  }
}

// JSON Output
if (outputJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.results.every(r => r.isSynced) ? 0 : 1);
}

// Terminal Output
console.log(`\n${c.bold}================================================================${c.reset}`);
console.log(`${c.bold}   AWI Multibrand Design Tokens Synchronization Verifier        ${c.reset}`);
console.log(`${c.bold}================================================================${c.reset}`);

if (parityMode) {
  console.log(`${c.gray}Verification Mode:${c.reset} ${c.cyan}${c.bold}Full Multi-Brand Parity${c.reset} (against all ${unionTokens.size} unique tokens)`);
  console.log(`${c.gray}Brands Checked:${c.reset}    ${report.results.map(r => r.theme.replace(/^Awi\./, '')).join(', ')}`);
} else {
  console.log(`${c.gray}Verification Mode:${c.reset} Baseline Comparison`);
  console.log(`${c.gray}Baseline Brand:${c.reset}    ${c.cyan}${c.bold}${baseThemeName}${c.reset} (${allTokenMaps.get(baseThemeName).size} tokens)`);
  console.log(`${c.gray}Comparing:${c.reset}         ${report.results.length} brand(s)`);
}

if (filterPattern) {
  console.log(`${c.gray}Filter Pattern:${c.reset}    ${c.yellow}${filterPattern}${c.reset}`);
}
console.log(`${c.dim}Memo: "-copy" tokens are auto-created when copying in Token Studio (Figma).${c.reset}\n`);

// Baseline -copy warnings if any
if (report.baseline && report.baseline.copyTokens.length > 0) {
  console.log(`${c.yellow}${c.bold}⚠️  Baseline "${baseThemeName}" has ${report.baseline.copyTokens.length} "-copy" artifact(s):${c.reset}`);
  report.baseline.copyTokens.forEach(b => {
    console.log(`   ${c.yellow}*${c.reset} ${b.path} ${c.gray}(suggested: "${b.canonical}")${c.reset}`);
  });
  console.log('');
}

// Summary Table Helpers
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function padRight(str, len) {
  const visibleLen = stripAnsi(str).length;
  return str + ' '.repeat(Math.max(0, len - visibleLen));
}

function padLeft(str, len) {
  const visibleLen = stripAnsi(str).length;
  return ' '.repeat(Math.max(0, len - visibleLen)) + str;
}

const cols = parityMode
  ? [
      { name: 'Brand Theme', width: 18, align: 'left' },
      { name: 'Tokens', width: 8, align: 'right' },
      { name: 'Missing', width: 10, align: 'right' },
      { name: 'Type Err', width: 10, align: 'right' },
      { name: '-copy', width: 8, align: 'right' },
      { name: 'Status', width: 12, align: 'left' },
    ]
  : [
      { name: 'Brand Theme', width: 18, align: 'left' },
      { name: 'Tokens', width: 8, align: 'right' },
      { name: 'Missing', width: 9, align: 'right' },
      { name: 'Extra', width: 8, align: 'right' },
      { name: 'Type Err', width: 10, align: 'right' },
      { name: '-copy', width: 8, align: 'right' },
      { name: 'Status', width: 12, align: 'left' },
    ];

const headerLine = '| ' + cols.map(col => col.align === 'left' ? padRight(col.name, col.width) : padLeft(col.name, col.width)).join(' | ') + ' |';
const sepLine = '|' + cols.map(col => '-'.repeat(col.width + 2)).join('|') + '|';

console.log(c.bold + sepLine + c.reset);
console.log(c.bold + headerLine + c.reset);
console.log(c.bold + sepLine + c.reset);

for (const res of report.results) {
  const shortName = res.theme.replace(/^Awi\./, '');
  const missingStr = res.missingCount === 0
    ? `${c.green}0${c.reset}`
    : `${c.red}${res.missingCount}${c.reset}`;
  const extraStr = res.extraCount === 0
    ? `${c.green}0${c.reset}`
    : `${c.yellow}${res.extraCount}${c.reset}`;
  const typeErrStr = res.typeMismatchCount === 0
    ? `${c.green}0${c.reset}`
    : `${c.magenta}${res.typeMismatchCount}${c.reset}`;
  const copyStr = res.copyTokensCount === 0
    ? `${c.green}0${c.reset}`
    : `${c.yellow}${res.copyTokensCount}${c.reset}`;
  const statusStr = res.isSynced
    ? `${c.green}✔ SYNCED${c.reset}`
    : `${c.red}✘ DESYNC${c.reset}`;

  const row = parityMode
    ? '| ' + [
        padRight(shortName, cols[0].width),
        padLeft(String(res.totalTokens), cols[1].width),
        padLeft(missingStr, cols[2].width),
        padLeft(typeErrStr, cols[3].width),
        padLeft(copyStr, cols[4].width),
        padRight(statusStr, cols[5].width),
      ].join(' | ') + ' |'
    : '| ' + [
        padRight(shortName, cols[0].width),
        padLeft(String(res.totalTokens), cols[1].width),
        padLeft(missingStr, cols[2].width),
        padLeft(extraStr, cols[3].width),
        padLeft(typeErrStr, cols[4].width),
        padLeft(copyStr, cols[5].width),
        padRight(statusStr, cols[6].width),
      ].join(' | ') + ' |';

  console.log(row);
}
console.log(sepLine + '\n');

// Detailed Breakdown
if (!summaryOnly) {
  for (const res of report.results) {
    if (res.isSynced) {
      console.log(`${c.green}${c.bold}✔ ${res.theme}${c.reset}: All ${res.totalTokens} tokens perfectly aligned.\n`);
      continue;
    }

    console.log(`${c.bold}${c.red}▶ Brand: ${res.theme}${c.reset} (${res.totalTokens} tokens)`);

    // 1. Missing Tokens
    if (res.missing.length > 0) {
      const label = parityMode ? `Missing from multi-brand union (${res.missing.length}):` : `Missing from baseline (${res.missing.length}):`;
      console.log(`  ${c.red}${c.bold}${label}${c.reset}`);
      res.missing.forEach(m => {
        const foundIn = m.presentIn ? ` [present in: ${m.presentIn.map(p => p.replace(/^Awi\./, '')).join(', ')}]` : '';
        console.log(`    ${c.red}-${c.reset} ${c.bold}${m.path}${c.reset} ${c.gray}(expected type: ${m.expectedType})${c.reset}${c.dim}${foundIn}${c.reset}`);
      });
    }

    // 2. Extra Tokens (Baseline mode only)
    if (!parityMode && res.extra.length > 0) {
      console.log(`  ${c.yellow}${c.bold}Extra tokens not in baseline (${res.extra.length}):${c.reset}`);
      res.extra.forEach(e => {
        console.log(`    ${c.yellow}+${c.reset} ${c.bold}${e.path}${c.reset} ${c.gray}(type: ${e.type})${c.reset}`);
      });
    }

    // 3. Type Mismatches
    if (res.typeMismatches.length > 0) {
      console.log(`  ${c.magenta}${c.bold}Type mismatches (${res.typeMismatches.length}):${c.reset}`);
      res.typeMismatches.forEach(tm => {
        console.log(`    ${c.magenta}~${c.reset} ${c.bold}${tm.path}${c.reset}: expected=${c.cyan}${tm.expectedType || tm.baselineType}${c.reset}, theme=${c.yellow}${tm.themeType}${c.reset}`);
      });
    }

    // 4. Copy Artifacts (-copy)
    if (res.copyTokens.length > 0) {
      console.log(`  ${c.yellow}${c.bold}Artifact "-copy" tokens (${res.copyTokens.length}) [Auto-created by Token Studio]:${c.reset}`);
      res.copyTokens.forEach(ct => {
        let note = '';
        if (ct.existsInBaseline || ct.existsInUnion) {
          note = `${c.green}→ Canonical token "${ct.canonical}" exists${c.reset}`;
        } else if (ct.existsInTheme) {
          note = `${c.red}→ Duplicate: theme already has "${ct.canonical}"${c.reset}`;
        } else {
          note = `${c.gray}→ Suggested canonical: "${ct.canonical}"${c.reset}`;
        }
        console.log(`    ${c.yellow}⚠️ ${c.reset} ${c.bold}${ct.path}${c.reset} ${note}`);
      });
    }

    console.log('');
  }
}

// Exit code
const allSynced = report.results.every(r => r.isSynced);
if (allSynced) {
  console.log(`${c.green}${c.bold}All brands are completely synchronized and have full token parity!${c.reset}\n`);
  process.exit(0);
} else {
  console.log(`${c.yellow}${c.bold}Helpful commands:${c.reset}`);
  console.log(`  Full multi-brand parity: ${c.cyan}node scripts/verify-sync.js --parity${c.reset}`);
  console.log(`  Disparity matrix table:  ${c.cyan}node scripts/verify-sync.js --matrix${c.reset}`);
  console.log(`  Inspect single brand:    ${c.cyan}node scripts/verify-sync.js -t <brand>${c.reset}`);
  console.log(`  Filter by token name:    ${c.cyan}node scripts/verify-sync.js -f <pattern>${c.reset}`);
  console.log(`  Show only summary:       ${c.cyan}node scripts/verify-sync.js -s${c.reset}\n`);
  process.exit(1);
}
