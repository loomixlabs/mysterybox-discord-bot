/**
 * Vérifie que les valeurs enum du schéma JSON correspondent aux contraintes CHECK de la DB
 */

require('dotenv').config();
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

// Extraire les contraintes CHECK de la DB
async function getCheckConstraintValues(tableName, constraintName) {
  const result = await db.queryOne(`
    SELECT pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = $1::regclass AND conname = $2
  `, [tableName, constraintName]);

  if (!result) return null;

  // Parser la contrainte pour extraire les valeurs
  // Format: CHECK ((column = ANY (ARRAY['val1'::text, 'val2'::text, ...])))
  const match = result.definition.match(/ARRAY\[([^\]]+)\]/);
  if (!match) return null;

  const values = match[1].match(/'([^']+)'/g);
  return values ? values.map(v => v.replace(/'/g, '')) : null;
}

async function main() {
  console.log('🔍 VÉRIFICATION: Schéma JSON vs Contraintes DB');
  console.log('='.repeat(70));

  // Charger le schéma JSON
  const schemaPath = path.join(__dirname, '..', 'themes', 'schema', 'theme.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  let allValid = true;

  // 1. Vérifier collectibles.rarity
  console.log('\n📋 1. COLLECTIBLES RARITY');
  console.log('-'.repeat(50));

  const dbRarities = await getCheckConstraintValues('collectibles', 'collectibles_rarity_check');
  const schemaRarities = schema.properties.collectibles.items.properties.rarity.enum;

  console.log(`DB:     [${dbRarities?.sort().join(', ')}]`);
  console.log(`Schema: [${schemaRarities?.sort().join(', ')}]`);

  if (JSON.stringify(dbRarities?.sort()) === JSON.stringify(schemaRarities?.sort())) {
    console.log('✅ MATCH');
  } else {
    console.log('❌ MISMATCH');
    allValid = false;
  }

  // 2. Vérifier traps.type
  console.log('\n📋 2. TRAPS TYPE');
  console.log('-'.repeat(50));

  const dbTrapTypes = await getCheckConstraintValues('traps', 'traps_type_check');
  const schemaTrapTypes = schema.properties.traps.items.properties.type.enum;

  console.log(`DB:     [${dbTrapTypes?.sort().join(', ')}]`);
  console.log(`Schema: [${schemaTrapTypes?.sort().join(', ')}]`);

  if (JSON.stringify(dbTrapTypes?.sort()) === JSON.stringify(schemaTrapTypes?.sort())) {
    console.log('✅ MATCH');
  } else {
    console.log('❌ MISMATCH');
    allValid = false;
  }

  // 3. Vérifier missions.type (keyword-message, quiz, etc.)
  console.log('\n📋 3. MISSIONS TYPE');
  console.log('-'.repeat(50));

  const dbMissionTypes = await getCheckConstraintValues('missions', 'missions_type_check');
  console.log(`DB:     [${dbMissionTypes?.sort().join(', ')}]`);

  // Le schéma n'a pas d'enum pour mission type car c'est implicite (keyword vs quiz)
  // Mais l'importer utilise 'keyword-message' et 'quiz' qui doivent être dans la DB
  const importerMissionTypes = ['keyword-message', 'quiz'];
  const importerTypesInDb = importerMissionTypes.every(t => dbMissionTypes?.includes(t));

  console.log(`Importer utilise: [${importerMissionTypes.join(', ')}]`);
  if (importerTypesInDb) {
    console.log('✅ Types Importer valides dans DB');
  } else {
    console.log('❌ Types Importer manquants dans DB');
    allValid = false;
  }

  // 4. Vérifier mission_keywords.difficulty
  console.log('\n📋 4. MISSION KEYWORDS DIFFICULTY');
  console.log('-'.repeat(50));

  const dbDifficulties = await getCheckConstraintValues('mission_keywords', 'mission_keywords_difficulty_check');
  const schemaDifficulties = schema.properties.missions.properties.keyword.items.properties.keywords.items.properties.difficulty.enum;

  console.log(`DB:     [${dbDifficulties?.sort().join(', ')}]`);
  console.log(`Schema: [${schemaDifficulties?.sort().join(', ')}]`);

  if (JSON.stringify(dbDifficulties?.sort()) === JSON.stringify(schemaDifficulties?.sort())) {
    console.log('✅ MATCH');
  } else {
    console.log('❌ MISMATCH');
    allValid = false;
  }

  // 5. Vérifier missions.validation_type
  console.log('\n📋 5. MISSIONS VALIDATION_TYPE');
  console.log('-'.repeat(50));

  const dbValidationTypes = await getCheckConstraintValues('missions', 'missions_validation_type_check');
  console.log(`DB:     [${dbValidationTypes?.sort().join(', ')}]`);

  // L'importer utilise 'auto' par défaut
  const importerValidationTypes = ['auto'];
  const validationTypesInDb = importerValidationTypes.every(t => dbValidationTypes?.includes(t));

  console.log(`Importer utilise: [${importerValidationTypes.join(', ')}]`);
  if (validationTypesInDb) {
    console.log('✅ Types Importer valides dans DB');
  } else {
    console.log('❌ Types Importer manquants dans DB');
    allValid = false;
  }

  // 6. Vérifier missions.reward_type
  console.log('\n📋 6. MISSIONS REWARD_TYPE');
  console.log('-'.repeat(50));

  const dbRewardTypes = await getCheckConstraintValues('missions', 'missions_reward_type_check');
  console.log(`DB:     [${dbRewardTypes?.sort().join(', ')}]`);

  // L'importer utilise 'random-collectible' par défaut
  const importerRewardTypes = ['random-collectible'];
  const rewardTypesInDb = importerRewardTypes.every(t => dbRewardTypes?.includes(t));

  console.log(`Importer utilise: [${importerRewardTypes.join(', ')}]`);
  if (rewardTypesInDb) {
    console.log('✅ Types Importer valides dans DB');
  } else {
    console.log('❌ Types Importer manquants dans DB');
    allValid = false;
  }

  // Résumé
  console.log('\n' + '='.repeat(70));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(70));

  if (allValid) {
    console.log('\n✅✅✅ SCHÉMA JSON ALIGNÉ AVEC CONTRAINTES DB ✅✅✅');
  } else {
    console.log('\n❌❌❌ DÉSALIGNEMENT DÉTECTÉ ❌❌❌');
  }

  process.exit(allValid ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
