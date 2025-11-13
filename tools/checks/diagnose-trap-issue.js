const db = require('./utils/database-pg');
require('dotenv').config();

async function diagnose() {
  try {
    // Demander l'ID Discord de l'utilisateur concerné
    const userDiscordId = process.argv[2];

    if (!userDiscordId) {
      console.log('Usage: node diagnose-trap-issue.js <discord_id>');
      process.exit(1);
    }

    const guildId = '1248028543389143070';

    console.log('🔍 Diagnostic du problème de piège...\n');
    console.log(`Discord ID: ${userDiscordId}\n`);

    // Récupérer le joueur
    const player = await db.getPlayerByDiscordId(guildId, userDiscordId);

    if (!player) {
      console.log('❌ Joueur introuvable');
      process.exit(1);
    }

    console.log('👤 Joueur:', player.username, `(ID: ${player.id})\n`);

    // Récupérer le thème actif
    const theme = await db.getActiveTheme(guildId);
    console.log('🎯 Thème actif:', theme.name, `(ID: ${theme.id})\n`);

    // Vérifier TOUS les collectibles (possédés ET perdus)
    const allCollections = await db.queryAll(`
      SELECT
        col.id as collectible_id,
        col.name as collectible_name,
        c.id as collection_id,
        c.collected_at,
        c.lost_at,
        CASE WHEN c.lost_at IS NULL THEN 'Possédé' ELSE 'Perdu' END as status
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1
        AND c.guild_id = $2
        AND col.theme_id = $3
      ORDER BY c.lost_at DESC NULLS LAST, c.collected_at DESC
    `, [player.id, guildId, theme.id]);

    console.log(`📦 TOUS les collectibles (${allCollections.length} total):\n`);

    const possessed = allCollections.filter(c => !c.lost_at);
    const lost = allCollections.filter(c => c.lost_at);

    console.log(`✅ Possédés actuellement: ${possessed.length}`);
    possessed.forEach(c => {
      console.log(`  - ${c.collectible_name} (collectible_id=${c.collectible_id}, collection_id=${c.collection_id})`);
    });

    console.log(`\n❌ Perdus: ${lost.length}`);
    lost.forEach(c => {
      console.log(`  - ${c.collectible_name} (collectible_id=${c.collectible_id}, perdu le ${c.lost_at})`);
    });

    // Vérifier ce que retourne getPlayerCollectibles
    console.log('\n🔍 Test de getPlayerCollectibles():\n');
    const playerCollectibles = await db.getPlayerCollectibles(guildId, player.id, theme.id);

    console.log(`Nombre retourné: ${playerCollectibles.length}`);
    playerCollectibles.forEach(c => {
      console.log(`  - ${c.name} (id=${c.id})`);
    });

    // Vérifier s'il y a des incohérences
    console.log('\n⚠️ VÉRIFICATION D\'INCOHÉRENCES:\n');

    if (playerCollectibles.length !== possessed.length) {
      console.log(`❌ INCOHÉRENCE: getPlayerCollectibles retourne ${playerCollectibles.length} items mais il y a ${possessed.length} collectibles possédés`);
    } else {
      console.log(`✅ Nombre cohérent: ${playerCollectibles.length} collectibles`);
    }

    // Vérifier si les IDs correspondent
    const playerCollIds = playerCollectibles.map(c => c.id).sort();
    const possessedIds = possessed.map(c => c.collectible_id).sort();

    console.log('\nIDs retournés par getPlayerCollectibles:', playerCollIds);
    console.log('IDs réels possédés (collectible_id):', possessedIds);

    const missingInPlayer = possessedIds.filter(id => !playerCollIds.includes(id));
    const extraInPlayer = playerCollIds.filter(id => !possessedIds.includes(id));

    if (missingInPlayer.length > 0) {
      console.log('\n❌ Manquants dans getPlayerCollectibles:', missingInPlayer);
    }

    if (extraInPlayer.length > 0) {
      console.log('\n❌ En trop dans getPlayerCollectibles:', extraInPlayer);
    }

    if (missingInPlayer.length === 0 && extraInPlayer.length === 0) {
      console.log('\n✅ Tous les IDs correspondent');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

diagnose();
