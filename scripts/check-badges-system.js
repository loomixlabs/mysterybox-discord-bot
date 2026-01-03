const db = require('../utils/database-pg');

async function checkBadgesSystem() {
  try {
    console.log('🔍 VÉRIFICATION SYSTÈME DE BADGES\n');
    console.log('='.repeat(80));

    // 1. Vérifier tables badges
    console.log('\n📋 TABLES LIÉES AUX BADGES:');
    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE '%badge%' OR table_name LIKE '%achievement%')
      ORDER BY table_name
    `);
    console.table(tables);

    // 2. Vérifier colonnes dans players
    console.log('\n👤 COLONNES "BADGE" DANS TABLE PLAYERS:');
    const playerColumns = await db.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'players'
        AND column_name LIKE '%badge%'
      ORDER BY ordinal_position
    `);
    console.table(playerColumns);

    // 3. Vérifier dans player_progress
    console.log('\n📊 COLONNES "BADGE" DANS TABLE PLAYER_PROGRESS:');
    const progressColumns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_progress'
        AND (column_name LIKE '%badge%' OR column_name LIKE '%achievement%')
      ORDER BY ordinal_position
    `);
    console.table(progressColumns);

    // 4. Vérifier bonus_usage_history
    console.log('\n📜 STRUCTURE BONUS_USAGE_HISTORY (pour tracking):');
    const usageColumns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bonus_usage_history'
      ORDER BY ordinal_position
    `);
    console.table(usageColumns);

    // 5. Chercher références à "indestructible" ou tracking pièges
    console.log('\n🔍 RECHERCHE TRACKING PIÈGES BLOQUÉS:');
    const trapTracking = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name IN ('players', 'player_progress', 'player_active_bonuses')
        AND (column_name LIKE '%trap%' OR column_name LIKE '%blocked%' OR column_name LIKE '%protected%')
      ORDER BY table_name, ordinal_position
    `);

    if (trapTracking.length > 0) {
      console.table(trapTracking);
    } else {
      console.log('❌ Aucune colonne de tracking trouvée');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Vérification terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkBadgesSystem();
