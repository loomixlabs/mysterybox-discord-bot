require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function executeReset() {
  console.log('🔄 Début de la réinitialisation...\n');

  try {
    // Étape 1: Afficher les données AVANT
    console.log('📊 Comptage des données AVANT réinitialisation:\n');

    const beforeCounts = await Promise.all([
      db.query(`SELECT COUNT(*) as count FROM players WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM collections WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM player_progress WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM mission_progress WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM give_logs WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM audit_logs WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM give_campaigns WHERE guild_id = $1`, [GUILD_ID])
    ]);

    console.log(`  players:           ${beforeCounts[0][0].count}`);
    console.log(`  collections:       ${beforeCounts[1][0].count}`);
    console.log(`  player_progress:   ${beforeCounts[2][0].count}`);
    console.log(`  mission_progress:  ${beforeCounts[3][0].count}`);
    console.log(`  give_logs:         ${beforeCounts[4][0].count}`);
    console.log(`  audit_logs:        ${beforeCounts[5][0].count}`);
    console.log(`  give_campaigns:    ${beforeCounts[6][0].count}\n`);

    // Étape 2: Suppression des données joueurs
    console.log('🗑️  Suppression des données joueurs...');

    await db.query(`DELETE FROM bonus_usage_history WHERE guild_id = $1`, [GUILD_ID]);
    await db.query(`DELETE FROM player_active_bonuses WHERE guild_id = $1`, [GUILD_ID]);
    await db.query(`DELETE FROM player_malus_points WHERE guild_id = $1`, [GUILD_ID]);
    await db.query(`DELETE FROM player_cooldowns WHERE guild_id = $1`, [GUILD_ID]);
    console.log('  ✅ Bonus, malus et cooldowns supprimés');

    await db.query(`DELETE FROM mission_progress WHERE guild_id = $1`, [GUILD_ID]);
    await db.query(`DELETE FROM collections WHERE guild_id = $1`, [GUILD_ID]);
    await db.query(`DELETE FROM player_progress WHERE guild_id = $1`, [GUILD_ID]);
    console.log('  ✅ Progressions et collections supprimées');

    await db.query(`DELETE FROM trap_triggered WHERE guild_id = $1`, [GUILD_ID]);
    await db.query(`DELETE FROM apple_game_winners WHERE guild_id = $1`, [GUILD_ID]);
    await db.query(`DELETE FROM give_logs WHERE guild_id = $1`, [GUILD_ID]);
    console.log('  ✅ Historique des événements supprimé');

    await db.query(`DELETE FROM players WHERE guild_id = $1`, [GUILD_ID]);
    console.log('  ✅ Joueurs supprimés\n');

    // Étape 3: Suppression des audit logs
    console.log('📝 Suppression des audit logs...');
    await db.query(`DELETE FROM audit_logs WHERE guild_id = $1`, [GUILD_ID]);
    await db.query(`DELETE FROM super_admin_logs WHERE target_guild_id = $1`, [GUILD_ID]);
    console.log('  ✅ Audit logs supprimés\n');

    // Étape 4: Suppression TOTALE des campagnes
    console.log('🎯 Suppression de TOUTES les campagnes...');
    await db.query(`DELETE FROM give_campaigns WHERE guild_id = $1`, [GUILD_ID]);
    console.log('  ✅ Toutes les campagnes supprimées\n');

    // Étape 5: Réinitialisation des stats
    console.log('📊 Réinitialisation des stats serveur...');
    await db.query(`
      UPDATE guild_stats
      SET total_players = 0,
          total_gives = 0,
          total_campaigns = 0,
          total_collections = 0,
          updated_at = NOW()
      WHERE guild_id = $1
    `, [GUILD_ID]);
    console.log('  ✅ Stats réinitialisées à 0\n');

    // Étape 6: Vérification POST
    console.log('✅ Réinitialisation terminée !\n');
    console.log('🔍 Vérification des données APRÈS réinitialisation:\n');

    const afterCounts = await Promise.all([
      db.query(`SELECT COUNT(*) as count FROM players WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM collections WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM player_progress WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM mission_progress WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM give_logs WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM audit_logs WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM give_campaigns WHERE guild_id = $1`, [GUILD_ID])
    ]);

    console.log(`  players:           ${afterCounts[0][0].count} ✅`);
    console.log(`  collections:       ${afterCounts[1][0].count} ✅`);
    console.log(`  player_progress:   ${afterCounts[2][0].count} ✅`);
    console.log(`  mission_progress:  ${afterCounts[3][0].count} ✅`);
    console.log(`  give_logs:         ${afterCounts[4][0].count} ✅`);
    console.log(`  audit_logs:        ${afterCounts[5][0].count} ✅`);
    console.log(`  give_campaigns:    ${afterCounts[6][0].count} ✅\n`);

    // Vérifier la config préservée
    console.log('🔒 Vérification de la configuration préservée:\n');

    const configCounts = await Promise.all([
      db.query(`SELECT COUNT(*) as count FROM collectibles WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM themes WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM missions WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM traps WHERE guild_id = $1`, [GUILD_ID]),
      db.query(`SELECT COUNT(*) as count FROM super_bonuses WHERE guild_id = $1`, [GUILD_ID])
    ]);

    console.log(`  collectibles:      ${configCounts[0][0].count} ✅`);
    console.log(`  themes:            ${configCounts[1][0].count} ✅`);
    console.log(`  missions:          ${configCounts[2][0].count} ✅`);
    console.log(`  traps:             ${configCounts[3][0].count} ✅`);
    console.log(`  super_bonuses:     ${configCounts[4][0].count} ✅\n`);

    // État final des stats
    console.log('📈 État final des stats:\n');
    const stats = await db.query(`
      SELECT total_players, total_gives, total_campaigns, total_collections
      FROM guild_stats
      WHERE guild_id = $1
    `, [GUILD_ID]);

    if (stats.length > 0) {
      console.log(`  total_players:      ${stats[0].total_players}`);
      console.log(`  total_gives:        ${stats[0].total_gives}`);
      console.log(`  total_campaigns:    ${stats[0].total_campaigns}`);
      console.log(`  total_collections:  ${stats[0].total_collections}\n`);
    }

    console.log('✅ Réinitialisation complète terminée avec succès !');
    console.log('🎮 Le bot peut maintenant être redémarré.\n');

  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

executeReset();
