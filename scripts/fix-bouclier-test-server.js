const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

const TEST_GUILD_ID = '297309737135898624'; // Serveur de test
const TEST_USER_ID = '297307186307006464'; // xmicordix

async function fixBouclier() {
  console.log('🔧 CORRECTION: Bouclier Anti-Piège sur serveur de test\n');
  console.log('='.repeat(80));

  try {
    // 1. État AVANT correction
    console.log('\n📋 ÉTAT AVANT CORRECTION:');
    console.log('-'.repeat(80));

    const before = await pool.query(`
      SELECT
        pab.id,
        pab.remaining_charges,
        pab.is_active,
        p.traps_blocked,
        p.username
      FROM player_active_bonuses pab
      JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE sb.name = 'Bouclier Anti-Piège'
        AND pab.guild_id = $1
        AND pab.user_id = $2
    `, [TEST_GUILD_ID, TEST_USER_ID]);

    if (before.rows.length === 0) {
      console.log('⚠️  Aucun Bouclier trouvé pour cet utilisateur');
      process.exit(0);
    }

    console.table(before.rows);

    const bonusId = before.rows[0].id;
    const currentCharges = before.rows[0].remaining_charges;
    const currentTrapsBlocked = before.rows[0].traps_blocked;

    // 2. Corrections
    console.log('\n🔧 APPLICATION DES CORRECTIONS:');
    console.log('-'.repeat(80));

    // Option 1: Réinitialiser complètement (3 charges)
    console.log('\nOption choisie: Réinitialiser à 3 charges (comme nouveau bonus)');

    await pool.query(`
      UPDATE player_active_bonuses
      SET remaining_charges = 3,
          is_active = TRUE,
          used_at = NULL
      WHERE id = $1 AND guild_id = $2
    `, [bonusId, TEST_GUILD_ID]);

    console.log('✅ Charges réinitialisées à 3');
    console.log('✅ Bonus réactivé (is_active = true)');

    // Note: On garde traps_blocked à 0 car il n'a vraiment pas été incrémenté
    console.log(`ℹ️  traps_blocked gardé à ${currentTrapsBlocked} (car non incrémenté lors du test bugué)`);

    // 3. État APRÈS correction
    console.log('\n📋 ÉTAT APRÈS CORRECTION:');
    console.log('-'.repeat(80));

    const after = await pool.query(`
      SELECT
        pab.id,
        pab.remaining_charges,
        pab.is_active,
        pab.used_at,
        p.traps_blocked,
        p.username
      FROM player_active_bonuses pab
      JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE sb.name = 'Bouclier Anti-Piège'
        AND pab.guild_id = $1
        AND pab.user_id = $2
    `, [TEST_GUILD_ID, TEST_USER_ID]);

    console.table(after.rows);

    console.log('\n' + '='.repeat(80));
    console.log('✅ CORRECTION TERMINÉE');
    console.log('='.repeat(80));
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Le bot est déjà en cours d\'exécution avec le code corrigé');
    console.log('   2. Tester à nouveau en déclenchant un piège');
    console.log('   3. Vérifier que remaining_charges passe de 3 → 2');
    console.log('   4. Vérifier que traps_blocked passe de 0 → 1');
    console.log('   5. Vérifier le logging dans bonus_usage_history');
    console.log('\n' + '='.repeat(80) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixBouclier();
