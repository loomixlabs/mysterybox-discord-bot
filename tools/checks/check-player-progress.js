const db = require('./utils/database-pg');
require('dotenv').config();

async function checkProgress() {
  try {
    const discordId = '297307186307006464';
    const guildId = '1248028543389143070';

    console.log('🔍 Vérification de la progression du joueur...\n');

    // Récupérer le joueur
    const player = await db.getPlayerByDiscordId(guildId, discordId);
    console.log('👤 Joueur:', player);

    // Récupérer le thème actif
    const theme = await db.getActiveTheme(guildId);
    console.log('\n🎯 Thème actif:', theme.name, `(ID: ${theme.id})`);

    // Récupérer la progression
    const progress = await db.getPlayerProgress(guildId, player.id, theme.id);
    console.log('\n📊 Progression (table player_progress):');
    console.log('  - collected_count:', progress.collected_count);
    console.log('  - is_completed:', progress.is_completed);

    // Compter les collectibles réellement possédés (lost_at IS NULL)
    const actualCount = await db.queryOne(`
      SELECT COUNT(DISTINCT collectible_id) as count
      FROM collections
      WHERE player_id = $1
        AND guild_id = $2
        AND lost_at IS NULL
    `, [player.id, guildId]);
    console.log('\n✅ Collectibles réellement possédés (lost_at IS NULL):', actualCount.count);

    // Compter tous les collectibles (incluant perdus)
    const totalCount = await db.queryOne(`
      SELECT COUNT(DISTINCT collectible_id) as count
      FROM collections
      WHERE player_id = $1
        AND guild_id = $2
    `, [player.id, guildId]);
    console.log('📦 Total collectibles (incluant perdus):', totalCount.count);

    // Lister les collectibles
    const collectibles = await db.queryAll(`
      SELECT
        col.name,
        c.collected_at,
        c.lost_at,
        CASE WHEN c.lost_at IS NULL THEN 'Possédé' ELSE 'Perdu' END as status
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1
        AND c.guild_id = $2
      ORDER BY c.collected_at DESC
    `, [player.id, guildId]);

    console.log('\n📋 Liste des collectibles:');
    collectibles.forEach((col, i) => {
      console.log(`  ${i + 1}. ${col.name} - ${col.status}`);
      console.log(`     Obtenu: ${col.collected_at}`);
      if (col.lost_at) {
        console.log(`     Perdu: ${col.lost_at}`);
      }
    });

    // Vérification de cohérence
    console.log('\n⚠️ VÉRIFICATION DE COHÉRENCE:');
    if (parseInt(actualCount.count) !== progress.collected_count) {
      console.log(`  ❌ INCOHÉRENCE DÉTECTÉE !`);
      console.log(`     - player_progress.collected_count = ${progress.collected_count}`);
      console.log(`     - Collectibles réels (lost_at IS NULL) = ${actualCount.count}`);
      console.log(`     → Il faut synchroniser le compteur !`);
    } else {
      console.log(`  ✅ Cohérence OK (${progress.collected_count} = ${actualCount.count})`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkProgress();
