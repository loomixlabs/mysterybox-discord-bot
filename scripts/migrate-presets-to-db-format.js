/**
 * Migration des fichiers presets vers le format DB-First
 *
 * Convertit: missions: { quiz: [], keyword: [] }
 * Vers:      missions: [ { type: 'quiz', ... }, { type: 'keyword', ... } ]
 */

const fs = require('fs');
const path = require('path');

const presetsDir = path.join(__dirname, '..', 'themes', 'presets');
const presetFiles = [
  'monopoly.theme.json',
  'harry-potter.theme.json',
  'blanche-neige.theme.json',
  'pokemon.theme.json'
];

console.log('🔄 Migration des presets vers format DB-First\n');
console.log('='.repeat(60));

let migratedCount = 0;
let skippedCount = 0;

for (const file of presetFiles) {
  const filePath = path.join(presetsDir, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} - Fichier non trouvé, skip`);
    skippedCount++;
    continue;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const preset = JSON.parse(content);

    // Vérifier si déjà au format DB (missions est un array)
    if (Array.isArray(preset.missions)) {
      console.log(`✅ ${file} - Déjà au format DB-First`);
      skippedCount++;
      continue;
    }

    // Vérifier si format legacy (missions.quiz / missions.keyword)
    if (!preset.missions || typeof preset.missions !== 'object') {
      console.log(`⚠️  ${file} - Pas de missions, skip`);
      skippedCount++;
      continue;
    }

    // Migration vers flat array
    const flatMissions = [];

    // Quiz missions
    if (Array.isArray(preset.missions.quiz)) {
      for (const quiz of preset.missions.quiz) {
        flatMissions.push({
          ...quiz,
          type: 'quiz'
        });
      }
      console.log(`   📋 ${preset.missions.quiz.length} quiz migrés`);
    }

    // Keyword missions
    if (Array.isArray(preset.missions.keyword)) {
      for (const kw of preset.missions.keyword) {
        flatMissions.push({
          ...kw,
          type: kw.type || 'keyword' // Garder le type existant si présent
        });
      }
      console.log(`   🔤 ${preset.missions.keyword.length} keyword migrés`);
    }

    // Remplacer missions
    preset.missions = flatMissions;

    // Sauvegarder
    fs.writeFileSync(filePath, JSON.stringify(preset, null, 2), 'utf8');

    console.log(`✅ ${file} - Migré (${flatMissions.length} missions total)`);
    migratedCount++;

  } catch (error) {
    console.error(`❌ ${file} - Erreur: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log(`📊 Résumé: ${migratedCount} migrés, ${skippedCount} skippés`);
console.log('✅ Migration terminée');
