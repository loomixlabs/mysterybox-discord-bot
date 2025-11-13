const db = require('./utils/database-pg');
require('dotenv').config();

async function checkOverCompensation() {
  try {
    const guildId = '1248028543389143070';

    console.log('🔍 VÉRIFICATION DES SUR-COMPENSATIONS\n');
    console.log('═'.repeat(80));

    // Récupérer tous les joueurs avec leurs collectibles
    const players = await db.queryAll(`
      SELECT p.id, p.username, p.discord_id,
             COUNT(c.id) FILTER (WHERE c.lost_at IS NULL) as active_count,
             COUNT(c.id) FILTER (WHERE c.lost_at IS NOT NULL) as lost_count
      FROM players p
      LEFT JOIN collections c ON c.player_id = p.id AND c.guild_id = p.guild_id
      WHERE p.guild_id = $1
      GROUP BY p.id, p.username, p.discord_id
      HAVING COUNT(c.id) FILTER (WHERE c.lost_at IS NULL) > 0
      ORDER BY COUNT(c.id) FILTER (WHERE c.lost_at IS NULL) DESC
    `, [guildId]);

    console.log(`Total joueurs avec collectibles: ${players.length}\n`);

    const maxCollectibles = 7; // Blanche neige a 7 collectibles

    const overCompensated = [];

    for (const player of players) {
      if (parseInt(player.active_count) > maxCollectibles) {
        overCompensated.push(player);

        console.log(`⚠️  ${player.username}`);
        console.log(`   Discord ID: ${player.discord_id}`);
        console.log(`   Player ID: ${player.id}`);
        console.log(`   Collectibles actifs: ${player.active_count} (MAX: ${maxCollectibles})`);
        console.log(`   EN TROP: ${parseInt(player.active_count) - maxCollectibles}\n`);

        // Afficher les détails des collectibles
        const collectibles = await db.queryAll(`
          SELECT col.id as collectible_id, col.name, col.rarity, c.source, c.collected_at, c.id as collection_id
          FROM collections c
          JOIN collectibles col ON c.collectible_id = col.id
          WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
          ORDER BY c.collected_at DESC
        `, [guildId, player.id]);

        console.log(`   Détails des collectibles:`);
        collectibles.forEach((c, i) => {
          const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
          const date = new Date(c.collected_at).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          console.log(`      ${i + 1}. ${emoji} ${c.name} (${c.rarity}) - ${c.source} - ${date}`);
        });

        // Détecter les doublons (même collectible_id)
        const collectibleIds = collectibles.map(c => c.collectible_id);
        const uniqueIds = [...new Set(collectibleIds)];

        if (collectibleIds.length !== uniqueIds.length) {
          console.log(`\n   ⚠️  DOUBLONS DÉTECTÉS !`);
          const duplicates = collectibleIds.filter((id, index) => collectibleIds.indexOf(id) !== index);
          const uniqueDuplicates = [...new Set(duplicates)];

          for (const dupId of uniqueDuplicates) {
            const dupCollectibles = collectibles.filter(c => c.collectible_id === dupId);
            console.log(`      - ${dupCollectibles[0].name} : ${dupCollectibles.length} fois`);
            dupCollectibles.forEach((c, i) => {
              const date = new Date(c.collected_at).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              });
              console.log(`         ${i + 1}. ID ${c.collection_id} - ${c.source} - ${date}`);
            });
          }
        }

        console.log('\n' + '─'.repeat(80) + '\n');
      }
    }

    console.log('═'.repeat(80));

    if (overCompensated.length === 0) {
      console.log('\n✅ Aucune sur-compensation détectée\n');
    } else {
      console.log(`\n⚠️  ${overCompensated.length} joueur(s) sur-compensé(s)\n`);
      console.log('💡 Actions recommandées:');
      overCompensated.forEach((p, i) => {
        const tooMany = parseInt(p.active_count) - maxCollectibles;
        console.log(`   ${i + 1}. ${p.username}: Retirer ${tooMany} collectible(s) en trop`);
      });
    }

    console.log('\n' + '═'.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkOverCompensation();
