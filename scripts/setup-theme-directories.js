/**
 * Script pour créer la structure de dossiers pour les thèmes
 */

const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');

const directories = [
  'themes',
  'themes/schema',
  'themes/presets',
  'themes/exports'
];

console.log('📁 Création de la structure de dossiers pour les thèmes...\n');

directories.forEach(dir => {
  const fullPath = path.join(baseDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Créé: ${dir}/`);
  } else {
    console.log(`⏭️  Existe déjà: ${dir}/`);
  }
});

console.log('\n✅ Structure de dossiers créée avec succès!');
console.log('\nStructure:');
console.log('themes/');
console.log('├── schema/     # JSON Schema de validation');
console.log('├── presets/    # Thèmes préconfigurés');
console.log('└── exports/    # Exports de thèmes existants');
