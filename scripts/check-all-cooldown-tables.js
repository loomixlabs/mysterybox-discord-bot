const db = require('../utils/database-pg');

async function checkAllCooldownTables() {
  try {
    const guildId = '1248028543389143070'; // Serveur de test
    const userId = '297307186307006464'; // xmicordix

    console.log('🔍 VÉRIFICATION COMPLÈTE DES COOLDOWNS\n');
    console.log('='.repeat(80));

    // 1. Récupérer le player_id
    const player = await db.queryOne(
      `SELECT id, username FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, userId]
    );

    if (!player) {
      console.log('❌ Joueur introuvable\n');
      process.exit(1);
    }

    console.log(`✅ Player trouvé: ${player.username} (ID: ${player.id})\n`);

    // 2. Vérifier player_cooldowns
    console.log('📋 TABLE: player_cooldowns');
    console.log('-'.repeat(80));
    const cooldowns1 = await db.query(
      `SELECT * FROM player_cooldowns WHERE guild_id = $1 AND player_id = $2`,
      [guildId, player.id]
    );
    console.log(`   Résultats: ${cooldowns1.length} entrée(s)`);
    if (cooldowns1.length > 0) {
      cooldowns1.forEach((c, i) => {
        console.log(`   ${i + 1}. Type: ${c.cooldown_type}, Expire: ${new Date(c.expires_at).toLocaleString('fr-FR')}`);
      });
    }
    console.log('');

    // 3. Vérifier trap_triggered
    console.log('📋 TABLE: trap_triggered');
    console.log('-'.repeat(80));
    const traps = await db.query(
      `SELECT * FROM trap_triggered WHERE guild_id = $1 AND player_id = $2 ORDER BY triggered_at DESC LIMIT 5`,
      [guildId, player.id]
    );
    console.log(`   Résultats: ${traps.length} entrée(s)`);
    if (traps.length > 0) {
      traps.forEach((t, i) => {
        console.log(`   ${i + 1}. Trap ID: ${t.trap_id}, Triggered: ${new Date(t.triggered_at).toLocaleString('fr-FR')}`);
      });
    }
    console.log('');

    // 4. Vérifier la table traps pour voir tous les pièges disponibles
    console.log('📋 TABLE: traps (tous les pièges du thème actif)');
    console.log('-'.repeat(80));
    const allTraps = await db.query(
      `SELECT t.id, t.name, t.description, t.effect_type, t.effect_value, t.effect_unit
       FROM traps t
       JOIN themes th ON t.theme_id = th.id
       WHERE th.guild_id = $1 AND th.is_active = TRUE`,
      [guildId]
    );
    console.log(`   Résultats: ${allTraps.length} piège(s)`);
    if (allTraps.length > 0) {
      allTraps.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.name} (ID: ${t.id}) - ${t.effect_type} ${t.effect_value} ${t.effect_unit}`);
      });
    }
    console.log('');

    // 5. Lister TOUTES les tables avec "cooldown" dans le nom
    console.log('📋 RECHERCHE: Tables contenant "cooldown"');
    console.log('-'.repeat(80));
    const allTables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%cooldown%'
    `);
    console.log(`   ${allTables.length} table(s) trouvée(s):`);
    allTables.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.table_name}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Vérification terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkAllCooldownTables();
