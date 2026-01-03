const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

/**
 * Exécuter la migration pour ajouter activation_mode et corriger activated_at
 */
async function runMigration() {
  console.log('\n🔧 MIGRATION: Ajout de activation_mode + Correction activated_at\n');
  console.log('='.repeat(100));

  try {
    // 1. Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../database/migrations/add-activation-mode.sql');

    if (!fs.existsSync(sqlPath)) {
      console.error('❌ Fichier SQL introuvable:', sqlPath);
      process.exit(1);
    }

    console.log('📄 Lecture du fichier SQL...');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('✅ Fichier chargé\n');

    // 2. Afficher l'état AVANT migration
    console.log('📋 AVANT MIGRATION:');
    console.log('-'.repeat(100));

    // Vérifier si activation_mode existe
    const beforeActivationMode = await db.queryOne(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      AND column_name = 'activation_mode'
    `);

    if (beforeActivationMode) {
      console.log('⚠️  Colonne activation_mode EXISTE déjà');
    } else {
      console.log('❌ Colonne activation_mode N\'EXISTE PAS');
    }

    // Vérifier DEFAULT de activated_at
    const beforeActivatedAt = await db.queryOne(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      AND column_name = 'activated_at'
    `);

    console.log('Valeur DEFAULT de activated_at:', beforeActivatedAt?.column_default || 'NULL');

    // Compter les super bonus
    const beforeCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM super_bonuses
      WHERE guild_id = $1
    `, [process.env.GUILD_ID || '1248028543389143070']);

    console.log(`Super bonus existants: ${beforeCount.count}`);

    // 3. Exécuter la migration
    console.log('\n\n🚀 EXÉCUTION DE LA MIGRATION...\n');

    await db.query(sql);

    console.log('✅ Migration exécutée avec succès\n');

    // 4. Vérifier l'état APRÈS migration
    console.log('📋 APRÈS MIGRATION:');
    console.log('-'.repeat(100));

    // Vérifier activation_mode
    const afterActivationMode = await db.queryOne(`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      AND column_name = 'activation_mode'
    `);

    if (afterActivationMode) {
      console.log('✅ Colonne activation_mode EXISTE');
      console.log('   DEFAULT:', afterActivationMode.column_default);
    } else {
      console.log('❌ Colonne activation_mode N\'EXISTE PAS après migration');
    }

    // Vérifier contrainte
    const constraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'super_bonuses_activation_mode_check'
    `);

    if (constraint) {
      console.log('✅ Contrainte CHECK créée:', constraint.definition);
    }

    // Vérifier DEFAULT de activated_at
    const afterActivatedAt = await db.queryOne(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      AND column_name = 'activated_at'
    `);

    console.log('✅ Nouveau DEFAULT de activated_at:', afterActivatedAt?.column_default || 'NULL');

    // 5. Afficher la répartition des modes
    console.log('\n📊 RÉPARTITION PAR MODE:');
    console.log('-'.repeat(100));

    const modeStats = await db.queryAll(`
      SELECT
        activation_mode,
        COUNT(*) as count,
        array_agg(name) as bonuses
      FROM super_bonuses
      WHERE guild_id = $1
      GROUP BY activation_mode
      ORDER BY activation_mode
    `, [process.env.GUILD_ID || '1248028543389143070']);

    if (modeStats.length > 0) {
      for (const stat of modeStats) {
        console.log(`\n${stat.activation_mode.toUpperCase()}:`);
        console.log(`  Nombre: ${stat.count}`);
        console.log(`  Bonus: ${stat.bonuses.join(', ')}`);
      }
    } else {
      console.log('ℹ️  Aucun super bonus trouvé (normal si table vide)');
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ Migration terminée avec succès');
    console.log('\n💡 Prochaine étape: Créer revealSuperBonus() dans mysteryBoxHandler.js\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR lors de la migration:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();
