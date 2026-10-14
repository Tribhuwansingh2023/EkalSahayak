const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/i18n/locales');
const enPath = path.join(localesDir, 'en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_meta') continue;
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys = keys.concat(getAllKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const enKeys = new Set(getAllKeys(enData));
console.log(`Reference locale (en.json) has ${enKeys.size} translation keys.`);

const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
let hasError = false;

const devanagariRegex = /[\u0900-\u097F]/;

for (const file of files) {
  const code = file.replace('.json', '');
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Check Devanagari in Hinglish
  if (code === 'hi-Latn') {
    const checkObj = (obj, p = '') => {
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = p ? `${p}.${k}` : k;
        if (typeof v === 'string' && devanagariRegex.test(v)) {
          console.error(`[ERROR] Devanagari character found in hi-Latn at ${fullKey}: "${v}"`);
          hasError = true;
        } else if (typeof v === 'object' && v !== null) {
          checkObj(v, fullKey);
        }
      }
    };
    checkObj(data);
  }

  // Check missing keys
  const curKeys = new Set(getAllKeys(data));
  const missing = [...enKeys].filter(k => !curKeys.has(k));
  if (missing.length > 0) {
    console.error(`[ERROR] ${file} is missing ${missing.length} keys:`, missing.slice(0, 5));
    hasError = true;
  }

  // Check extra keys
  const extra = [...curKeys].filter(k => !enKeys.has(k));
  if (extra.length > 0) {
    console.error(`[ERROR] ${file} has ${extra.length} unexpected keys:`, extra.slice(0, 5));
    hasError = true;
  }
}

if (hasError) {
  console.error('\n❌ i18n:check failed with errors.');
  process.exit(1);
} else {
  console.log(`\n✅ i18n:check passed! All ${files.length} locale files match en.json structure, and hi-Latn is 100% Devanagari-free.`);
}
