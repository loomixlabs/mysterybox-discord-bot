const db = require('../utils/database-pg');

async function checkStructure() {
  try {
    console.log('🛡️ VÉRIFICATION STRUCTURE DB - BOUCLIER ANTI-PIÈGE\n');
    console.log('='.repeat(80));

    // 1. Vérifier colonnes existantes dans players
    console.log('\n👤 COLONNES "TRAP" DANS TABLE PLAYERS:');
    const playerColumns = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'players'
        AND (column_name LIKE '%trap%' OR column_name LIKE '%block%' OR column_name LIKE '%shield%')
      ORDER BY ordinal_position
    `);

    if (playerColumns.length > 0) {
      console.table(playerColumns);
    } else {
      console.log('❌ Aucune colonne de tracking trouvée dans players');
      console.log('✅ Migration nécessaire: ALTER TABLE players ADD COLUMN traps_blocked INTEGER DEFAULT 0');
    }

    // 2. Vérifier table player_progress
    console.log('\n📊 COLONNES "TRAP" DANS TABLE PLAYER_PROGRESS:');
    const progressColumns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_progress'
        AND (column_name LIKE '%trap%' OR column_name LIKE '%block%' OR column_name LIKE '%shield%')
      ORDER BY ordinal_position
    `);

    if (progressColumns.length > 0) {
      console.table(progressColumns);
    } else {
      console.log('❌ Aucune colonne de tracking trouvée dans player_progress');
    }

    // 3. Vérifier super_bonuses - Bouclier existe-t-il ?
    console.log('\n🛡️ SUPER BONUS "BOUCLIER" DANS LA DB:');
    const shieldBonus = await db.query(`
      SELECT id, code, name, icon, effect_type, duration_type, default_charges, is_enabled
      FROM super_bonuses
      WHERE code LIKE '%shield%' OR code LIKE '%bouclier%' OR code LIKE '%protection%' OR effect_type = 'protection'
      ORDER BY id
    `);

    if (shieldBonus.length > 0) {
      console.table(shieldBonus);
      console.log(`\n✅ ${shieldBonus.length} super bonus de protection trouvé(s)`);
    } else {
      console.log('❌ Aucun super bonus de protection trouvé');
      console.log('⚠️  Le super bonus Bouclier doit être créé via le système d\'installation automatique');
    }

    // 4. Vérifier les logs d'usage
    console.log('\n📜 TABLE BONUS_USAGE_HISTORY (pour logging):');
    const usageTable = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'bonus_usage_history'
    `);

    if (usageTable.length > 0) {
      console.log('✅ Table bonus_usage_history existe');

      const columns = await db.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'bonus_usage_history'
        ORDER BY ordinal_position
      `);
      console.table(columns);
    } else {
      console.log('❌ Table bonus_usage_history n\'existe pas');
    }

    // 5. Vérifier si méthode logBonusUsage() existe
    console.log('\n🔧 VÉRIFICATION MÉTHODE db.logBonusUsage():');
    if (typeof db.logBonusUsage === 'function') {
      console.log('✅ Méthode db.logBonusUsage() existe');
    } else {
      console.log('❌ Méthode db.logBonusUsage() n\'existe PAS');
      console.log('⚠️  TODO ligne 220-226 dans superBonusHandler.js à implémenter');
    }

    // 6. Statistiques actuelles sur les pièges
    console.log('\n📊 STATISTIQUES PIÈGES DÉCLENCHÉS:');
    const trapStats = await db.query(`
      SELECT COUNT(*) as total_traps_triggered
      FROM trap_triggered
    `);

    if (trapStats.length > 0) {
      console.table(trapStats);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Vérification terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkStructure();
