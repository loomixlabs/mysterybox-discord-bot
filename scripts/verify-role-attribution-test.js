const db = require('../utils/database-pg');

async function verify() {
  try {
    console.log('🔍 VÉRIFICATION ATTRIBUTION RÔLE - Collection Monopoly\n');
    console.log('='.repeat(80));

    const guildId = '297309737135898624';
    const playerId = 1;
    const themeId = 43;

    // 1. Structure table player_progress
    console.log('\n📋 1. Structure de player_progress:');
    const columns = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_progress'
      ORDER BY ordinal_position
    `);
    console.table(columns);

    // 2. Données player_progress pour le joueur
    console.log('\n📊 2. Données player_progress:');
    const progress = await db.queryAll(`
      SELECT * FROM player_progress
      WHERE guild_id = $1 AND player_id = $2
    `, [guildId, playerId]);
    console.log(JSON.stringify(progress, null, 2));

    // 3. Thème actif et son rôle
    console.log('\n🎨 3. Thème actif et rôle:');
    const theme = await db.queryOne(`
      SELECT id, name, final_role_name, final_role_discord_id, is_active
      FROM themes
      WHERE guild_id = $1 AND id = $2
    `, [guildId, themeId]);
    console.log(JSON.stringify(theme, null, 2));

    // 4. Nombre de collectibles
    console.log('\n📦 4. Collectibles du joueur:');
    const collections = await db.queryAll(`
      SELECT COUNT(*) as count
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1
      AND c.player_id = $2
      AND col.theme_id = $3
      AND c.lost_at IS NULL
    `, [guildId, playerId, themeId]);
    console.log(`Collectibles possédés: ${collections[0].count}/20`);

    // 5. Total collectibles du thème
    const totalCollectibles = await db.queryOne(`
      SELECT COUNT(*) as total
      FROM collectibles
      WHERE guild_id = $1 AND theme_id = $2
    `, [guildId, themeId]);
    console.log(`Total collectibles thème: ${totalCollectibles.total}`);

    // 6. Vérifier si collection complète
    const isComplete = parseInt(collections[0].count) >= parseInt(totalCollectibles.total);
    console.log(`\n✅ Collection complète: ${isComplete ? 'OUI' : 'NON'}`);

    // 7. Vérifier player_progress pour ce thème
    console.log('\n📈 7. Progress pour ce thème:');
    const themeProgress = await db.queryOne(`
      SELECT * FROM player_progress
      WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
    `, [guildId, playerId, themeId]);

    if (themeProgress) {
      console.log('Progress trouvé:');
      console.log(JSON.stringify(themeProgress, null, 2));
      console.log(`\n🎯 role_obtained: ${themeProgress.role_obtained}`);
      console.log(`📅 completed_at: ${themeProgress.completed_at}`);
    } else {
      console.log('❌ Aucun progress trouvé pour ce thème!');
    }

    // 8. Audit logs récents
    console.log('\n📜 8. Audit logs récents (role attribution):');
    const auditLogs = await db.queryAll(`
      SELECT action, details, created_at
      FROM audit_logs
      WHERE guild_id = $1
      AND (action LIKE '%role%' OR action LIKE '%complet%' OR details LIKE '%Monopoly%')
      ORDER BY created_at DESC
      LIMIT 10
    `, [guildId]);
    console.table(auditLogs);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verify();
