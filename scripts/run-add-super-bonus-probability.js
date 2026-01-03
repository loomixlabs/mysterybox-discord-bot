const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

/**
 * Exécuter la migration pour ajouter probability_super_bonus à theme_config
 */
async function runMigration() {
  console.log('\n🔧 MIGRATION: Ajout de probability_super_bonus\n');
  console.log('='.repeat(100));

  try {
    // 1. Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../database/migrations/add-super-bonus-probability.sql');

    if (!fs.existsSync(sqlPath)) {
      console.error('❌ Fichier SQL introuvable:', sqlPath);
      process.exit(1);
    }

    console.log('📄 Lecture du fichier SQL...');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('✅ Fichier chargé\n');

    // 2. Vérifier si la colonne existe déjà
    console.log('🔍 Vérification de l\'existence de probability_super_bonus...\n');

    const columnExists = await db.queryOne(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      AND column_name = 'probability_super_bonus'
    `);

    // 3. Afficher l'état actuel
    console.log('📋 AVANT MIGRATION:');
    console.log('-'.repeat(100));

    // Requête différente selon que la colonne existe ou non
    const beforeConfig = await db.queryAll(`
      SELECT
        theme_id,
        probability_collectible,
        probability_mission,
        probability_trap
        ${columnExists ? ', probability_super_bonus' : ''}
      FROM theme_config
      ORDER BY theme_id
    `);

    if (beforeConfig.length > 0) {
      console.log('\n✅ Configurations actuelles:');
      console.table(beforeConfig);
    } else {
      console.log('⚠️  Aucune configuration trouvée');
    }

    if (columnExists) {
      console.log('\n⚠️  La colonne probability_super_bonus existe déjà');
      console.log('   Migration déjà appliquée ou colonne créée manuellement');

      // Vérifier quand même la somme
      const invalidConfigs = await db.queryAll(`
        SELECT
          theme_id,
          (probability_collectible + probability_mission + probability_trap + COALESCE(probability_super_bonus, 0)) as total
        FROM theme_config
        WHERE (probability_collectible + probability_mission + probability_trap + COALESCE(probability_super_bonus, 0)) != 100
      `);

      if (invalidConfigs.length > 0) {
        console.log('\n❌ ATTENTION: Certaines configs ont une somme != 100%:');
        console.table(invalidConfigs);
        process.exit(1);
      } else {
        console.log('\n✅ Toutes les configurations sont valides (somme = 100%)');
        process.exit(0);
      }
    }

    // 4. Exécuter la migration
    console.log('\n\n🚀 EXÉCUTION DE LA MIGRATION...\n');

    await db.query(sql);

    console.log('✅ Migration exécutée avec succès\n');

    // 5. Vérifier la nouvelle configuration
    console.log('📋 APRÈS MIGRATION:');
    console.log('-'.repeat(100));

    const afterConfig = await db.queryAll(`
      SELECT
        theme_id,
        probability_collectible,
        probability_mission,
        probability_trap,
        probability_super_bonus,
        (probability_collectible + probability_mission + probability_trap + probability_super_bonus) as total
      FROM theme_config
      ORDER BY theme_id
    `);

    if (afterConfig.length > 0) {
      console.log('\n✅ Nouvelles configurations:');
      console.table(afterConfig);

      // Vérifier que toutes les sommes = 100
      const allValid = afterConfig.every(c => c.total === 100);

      if (allValid) {
        console.log('\n✅ Toutes les configurations sont valides (total = 100%)');
      } else {
        console.log('\n❌ ERREUR: Certaines configurations ont un total != 100%');
        process.exit(1);
      }
    } else {
      console.log('⚠️  Aucune configuration trouvée après migration');
    }

    // 6. Vérifier la contrainte CHECK
    console.log('\n\n💎 VÉRIFICATION CONTRAINTE CHECK:');
    console.log('-'.repeat(100));

    const constraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'check_probabilities_sum_100'
    `);

    if (constraint) {
      console.log('✅ Contrainte trouvée:');
      console.log(`   ${constraint.definition}\n`);
    } else {
      console.log('❌ Contrainte check_probabilities_sum_100 introuvable');
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ Migration terminée avec succès');
    console.log('\n💡 Prochaine étape: Modifier rollMysteryContent() dans handlers/mysteryBoxHandler.js\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR lors de la migration:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();
