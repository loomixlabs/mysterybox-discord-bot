/**
 * Script pour valider tous les fichiers de thèmes
 */

const fs = require('fs');
const path = require('path');
const ThemeValidator = require('../utils/themeValidator');

const PRESETS_DIR = path.join(__dirname, '..', 'themes', 'presets');

console.log('🔍 Validation de tous les fichiers de thèmes\n');
console.log('='.repeat(60));

const files = fs.readdirSync(PRESETS_DIR).filter(f => f.endsWith('.theme.json'));
const validator = new ThemeValidator();

let allValid = true;

for (const file of files) {
  const filePath = path.join(PRESETS_DIR, file);
  console.log(`\n📁 ${file}`);

  const result = validator.validateFile(filePath);

  if (result.valid) {
    console.log('   ✅ VALIDE');
  } else {
    console.log('   ❌ ERREURS:');
    for (const error of result.errors) {
      console.log(`      - ${error}`);
    }
    allValid = false;
  }
}

console.log('\n' + '='.repeat(60));

if (allValid) {
  console.log('\n✅ Tous les thèmes sont valides !');
  process.exit(0);
} else {
  console.log('\n❌ Certains thèmes ont des erreurs de validation.');
  process.exit(1);
}
