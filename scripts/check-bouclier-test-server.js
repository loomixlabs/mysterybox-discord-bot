const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

const TEST_GUILD_ID = '297309737135898624'; // Serveur de test

async function checkBouclier() {
  console.log('🔍 VÉRIFICATION: Bouclier Anti-Piège sur serveur de test\n');
  console.log('='.repeat(80));

  try {
    // 1. Vérifier les joueurs avec Bouclier actif
    console.log('\n📋 Joueurs avec Bouclier Anti-Piège:');
    console.log('-'.repeat(80));

    const activeBonuses = await pool.query(`
      SELECT
        pab.id as active_bonus_id,
        pab.guild_id,
        pab.user_id,
        p.username,
        p.traps_blocked,
        sb.name as bonus_name,
        pab.remaining_charges,
        pab.is_active,
        pab.activated_at,
        pab.used_at,
        pab.obtained_from
      FROM player_active_bonuses pab
      JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE sb.name = 'Bouclier Anti-Piège'
        AND pab.guild_id = $1
      ORDER BY pab.is_active DESC, p.username
    `, [TEST_GUILD_ID]);

    if (activeBonuses.rows.length === 0) {
      console.log('⚠️  Aucun joueur n\'a de Bouclier (actif ou inactif)');
    } else {
      console.table(activeBonuses.rows);
      console.log(`\n✅ ${activeBonuses.rows.length} Bouclier(s) trouvé(s)`);

      // Analyser les problèmes
      const problems = [];
      activeBonuses.rows.forEach(bonus => {
        if (bonus.is_active && bonus.remaining_charges === null) {
          problems.push(`❌ Bonus ID ${bonus.active_bonus_id} (${bonus.username}): is_active=true mais remaining_charges=null`);
        }
        if (bonus.is_active && bonus.remaining_charges === 0) {
          problems.push(`❌ Bonus ID ${bonus.active_bonus_id} (${bonus.username}): is_active=true mais remaining_charges=0`);
        }
        if (!bonus.is_active && bonus.used_at === null) {
          problems.push(`⚠️  Bonus ID ${bonus.active_bonus_id} (${bonus.username}): is_active=false mais used_at=null`);
        }
      });

      if (problems.length > 0) {
        console.log('\n⚠️  PROBLÈMES DÉTECTÉS:');
        problems.forEach(p => console.log(`   ${p}`));
      } else {
        console.log('\n✅ Aucun problème détecté dans les données');
      }
    }

    // 2. Historique d'utilisation du bonus
    console.log('\n📋 Historique d\'utilisation du Bouclier:');
    console.log('-'.repeat(80));

    const usageHistory = await pool.query(`
      SELECT
        buh.id,
        buh.created_at,
        p.username,
        buh.action,
        buh.details,
        buh.usage_type
      FROM bonus_usage_history buh
      JOIN players p ON buh.player_id = p.id
      JOIN super_bonuses sb ON buh.bonus_id = sb.id
      WHERE sb.name = 'Bouclier Anti-Piège'
        AND buh.guild_id = $1
      ORDER BY buh.created_at DESC
      LIMIT 10
    `, [TEST_GUILD_ID]);

    if (usageHistory.rows.length === 0) {
      console.log('ℹ️  Aucun historique d\'utilisation');
    } else {
      console.table(usageHistory.rows);
      console.log(`\n✅ ${usageHistory.rows.length} utilisation(s) enregistrée(s)`);
    }

    // 3. Stats des joueurs (pièges bloqués)
    console.log('\n📋 Statistiques pièges bloqués:');
    console.log('-'.repeat(80));

    const trapStats = await pool.query(`
      SELECT
        username,
        discord_id,
        traps_blocked
      FROM players
      WHERE guild_id = $1 AND traps_blocked > 0
      ORDER BY traps_blocked DESC
    `, [TEST_GUILD_ID]);

    if (trapStats.rows.length === 0) {
      console.log('ℹ️  Aucun joueur n\'a encore bloqué de pièges');
    } else {
      console.table(trapStats.rows);
      console.log(`\n✅ ${trapStats.rows.length} joueur(s) avec pièges bloqués`);
    }

    // 4. Diagnostic
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DIAGNOSTIC');
    console.log('='.repeat(80));

    if (activeBonuses.rows.length > 0) {
      const activeCount = activeBonuses.rows.filter(b => b.is_active).length;
      const usedCount = activeBonuses.rows.filter(b => !b.is_active).length;

      console.log(`\n✅ Boucliers actifs: ${activeCount}`);
      console.log(`✅ Boucliers utilisés: ${usedCount}`);

      if (usageHistory.rows.length > 0) {
        console.log(`✅ Utilisations loggées: ${usageHistory.rows.length}`);
      }

      if (trapStats.rows.length > 0) {
        const totalBlocked = trapStats.rows.reduce((sum, p) => sum + parseInt(p.traps_blocked), 0);
        console.log(`✅ Total pièges bloqués: ${totalBlocked}`);
      }

      // Vérifier la cohérence
      if (usageHistory.rows.length !== trapStats.rows.reduce((sum, p) => sum + parseInt(p.traps_blocked), 0)) {
        console.log('\n⚠️  INCOHÉRENCE: Nombre d\'utilisations ≠ total pièges bloqués');
      }
    } else {
      console.log('\n⚠️  Aucun Bouclier trouvé sur ce serveur');
      console.log('   Suggestion: Distribuer un Bouclier via Mystery Box pour tester');
    }

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

checkBouclier();
