const fs = require('fs');
const path = require('path');

/**
 * Script pour trouver tous les endroits où la durée des bonus est affichée
 * Cherche les patterns: "jour", "jours", "day", "days", "86400", "duration_value"
 */

const searchPatterns = [
  /jours?\b/gi,  // "jour" ou "jours"
  /days?\b/gi,   // "day" ou "days"
  /86400/g,      // Constante de 1 jour en secondes
  /duration_value/gi,  // Accès direct à la durée
  /Math\.floor.*\/\s*86400/g,  // Conversion en jours
  /formatDuration/gi  // Fonction de formatage
];

const filesToCheck = [
  'views/profileView.js',
  'handlers/profileHandler.js',
  'handlers/superBonusHandler.js',
  'handlers/modalHandler.js',
  'handlers/mysteryBoxHandler.js'
];

console.log('\n🔍 RECHERCHE - Affichage de durée des Super Bonus\n');
console.log('='.repeat(80));

const results = [];

filesToCheck.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Fichier introuvable: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');

  searchPatterns.forEach(pattern => {
    lines.forEach((line, index) => {
      const matches = line.match(pattern);
      if (matches) {
        results.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          pattern: pattern.source
        });
      }
    });
  });
});

// Grouper par fichier
const byFile = results.reduce((acc, result) => {
  if (!acc[result.file]) {
    acc[result.file] = [];
  }
  acc[result.file].push(result);
  return acc;
}, {});

console.log('\n📊 RÉSULTATS PAR FICHIER\n');

Object.entries(byFile).forEach(([file, matches]) => {
  console.log(`\n📁 ${file} (${matches.length} occurrences)`);
  console.log('─'.repeat(80));

  matches.forEach(match => {
    console.log(`   Ligne ${match.line}: ${match.content.substring(0, 100)}${match.content.length > 100 ? '...' : ''}`);
  });
});

console.log('\n' + '='.repeat(80));
console.log(`\n✅ Total: ${results.length} occurrences trouvées dans ${Object.keys(byFile).length} fichiers\n`);

// Résumé des zones critiques
console.log('🎯 ZONES CRITIQUES À MODIFIER\n');
console.log('─'.repeat(80));

const criticalZones = [
  {
    file: 'handlers/superBonusHandler.js',
    lines: [313, 753],
    description: 'Affichage "X jours" si >= 24h → Changer pour toujours afficher en heures'
  },
  {
    file: 'handlers/superBonusHandler.js',
    lines: [455, 484],
    description: 'Sélecteur de jours (1-10) → Remplacer par sélecteur d\'heures'
  },
  {
    file: 'handlers/superBonusHandler.js',
    lines: [581, 624],
    description: 'Handler sauvegarde en jours → Modifier pour sauvegarder en heures'
  }
];

criticalZones.forEach((zone, index) => {
  console.log(`${index + 1}. ${zone.file}`);
  console.log(`   Lignes: ${zone.lines.join(', ')}`);
  console.log(`   Action: ${zone.description}\n`);
});

console.log('='.repeat(80));

process.exit(0);
