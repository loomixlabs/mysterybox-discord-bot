/**
 * Script d'exécution de la migration - Nouveaux types de missions
 * Ajoute 5 nouveaux types : emoji-puzzle, wordle, unscramble, hangman, true-false
 *
 * Usage: node scripts/run-new-mission-types-migration.js
 */

const db = require('../utils/database-pg');

async function runMigration() {
  console.log('='.repeat(80));
  console.log('🎮 MIGRATION: Nouveaux Types de Missions (5 mini-jeux)');
  console.log('='.repeat(80));
  console.log('');

  try {
    // ========================================
    // ÉTAT AVANT MIGRATION
    // ========================================
    console.log('📊 ÉTAT AVANT MIGRATION:');
    console.log('-'.repeat(60));

    // Vérifier contrainte actuelle
    const currentConstraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'missions_type_check'
    `);
    console.log('   Contrainte actuelle:', currentConstraint?.definition || 'AUCUNE');

    // Vérifier colonne game_state
    const gameStateExists = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'mission_progress' AND column_name = 'game_state'
    `);
    console.log(`   Colonne game_state: ${gameStateExists ? '✅ Existe' : '❌ N\'existe pas'}`);

    console.log('\n');

    // ========================================
    // ÉTAPE 1: Supprimer ancienne contrainte
    // ========================================
    console.log('🚀 EXÉCUTION DE LA MIGRATION...');
    console.log('-'.repeat(60));

    const constraintExists = await db.queryOne(`
      SELECT 1 FROM pg_constraint WHERE conname = 'missions_type_check'
    `);

    if (constraintExists) {
      await db.query('ALTER TABLE missions DROP CONSTRAINT missions_type_check');
      console.log('✅ Étape 1: Ancienne contrainte supprimée');
    } else {
      console.log('⏭️  Étape 1: Contrainte n\'existait pas');
    }

    // ========================================
    // ÉTAPE 2: Créer nouvelle contrainte (12 types)
    // ========================================
    await db.query(`
      ALTER TABLE missions ADD CONSTRAINT missions_type_check CHECK (
        type = ANY (ARRAY[
          'keyword-message'::text,
          'reaction-message'::text,
          'quiz'::text,
          'voice-join'::text,
          'message-count'::text,
          'reaction-count'::text,
          'manual'::text,
          'emoji-puzzle'::text,
          'wordle'::text,
          'unscramble'::text,
          'hangman'::text,
          'true-false'::text
        ])
      )
    `);
    console.log('✅ Étape 2: Nouvelle contrainte créée (12 types)');

    // ========================================
    // ÉTAPE 3: Ajouter colonne game_state
    // ========================================
    if (!gameStateExists) {
      await db.query(`
        ALTER TABLE mission_progress
        ADD COLUMN game_state JSONB DEFAULT NULL
      `);
      console.log('✅ Étape 3: Colonne game_state ajoutée');
    } else {
      console.log('⏭️  Étape 3: Colonne game_state existe déjà');
    }

    console.log('\n');

    // ========================================
    // VÉRIFICATION APRÈS MIGRATION
    // ========================================
    console.log('📊 ÉTAT APRÈS MIGRATION:');
    console.log('-'.repeat(60));

    // Nouvelle contrainte
    const newConstraint = await db.queryOne(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'missions_type_check'
    `);

    // Extraire les types de la contrainte
    const typesMatch = newConstraint?.definition?.match(/ARRAY\[(.*?)\]/s);
    if (typesMatch) {
      const types = typesMatch[1].split(',').map(t => t.trim().replace(/::text/g, '').replace(/'/g, ''));
      console.log('\n   📋 Types de missions disponibles:');
      console.log('   ┌────────────────────────┬────────────────────────┐');
      console.log('   │ Types existants        │ Nouveaux types         │');
      console.log('   ├────────────────────────┼────────────────────────┤');

      const existingTypes = ['keyword-message', 'reaction-message', 'quiz', 'voice-join', 'message-count', 'reaction-count', 'manual'];
      const newTypes = ['emoji-puzzle', 'wordle', 'unscramble', 'hangman', 'true-false'];

      for (let i = 0; i < Math.max(existingTypes.length, newTypes.length); i++) {
        const existing = existingTypes[i] || '';
        const newType = newTypes[i] || '';
        console.log(`   │ ${existing.padEnd(22)} │ ${newType.padEnd(22)} │`);
      }
      console.log('   └────────────────────────┴────────────────────────┘');
    }

    // Vérifier game_state
    const gameStateCheck = await db.queryOne(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'mission_progress' AND column_name = 'game_state'
    `);
    console.log(`\n   Colonne game_state: ${gameStateCheck ? `✅ ${gameStateCheck.data_type}` : '❌ MANQUANTE'}`);

    console.log('\n');
    console.log('='.repeat(80));
    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS');
    console.log('='.repeat(80));
    console.log('\n🎮 Prochaine étape: Implémenter les handlers pour chaque type');
    console.log('   1. true-false   - Vrai ou Faux');
    console.log('   2. emoji-puzzle - Emoji Devinette');
    console.log('   3. unscramble   - Anagramme');
    console.log('   4. hangman      - Pendu');
    console.log('   5. wordle       - Wordle Discord');

  } catch (error) {
    console.error('\n❌ ERREUR LORS DE LA MIGRATION:', error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
