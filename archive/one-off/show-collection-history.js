const db = require('./utils/database-pg');
require('dotenv').config();

async function showCollectionHistory() {
  try {
    const guildId = '1248028543389143070';
    const discordId = '692649463805640724'; // floerin

    console.log('📜 Historique complet des collections\n');

    const player = await db.queryOne(`
      SELECT id, username FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, discordId]);

    console.log(`Joueur: ${player.username}\n`);

    // Toutes les collections (actives + perdues)
    const allCollections = await db.queryAll(`
      SELECT col.name, col.rarity, c.collected_at, c.lost_at, c.source
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2
      ORDER BY c.collected_at
    `, [guildId, player.id]);

    console.log(`📊 Total collections (historique): ${allCollections.length}\n`);

    console.log('HISTORIQUE COMPLET:');
    console.log('═'.repeat(80));

    allCollections.forEach((c, i) => {
      const status = c.lost_at ? '❌ PERDU' : '✅ ACTIF';
      const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';

      console.log(`\n${i + 1}. ${emoji} ${c.name} (${c.rarity}) - ${status}`);
      console.log(`   Collecté: ${new Date(c.collected_at).toLocaleString('fr-FR')}`);
      console.log(`   Source: ${c.source}`);
      if (c.lost_at) {
        console.log(`   Perdu: ${new Date(c.lost_at).toLocaleString('fr-FR')}`);
      }
    });

    console.log('\n' + '═'.repeat(80));

    // Résumé
    const active = allCollections.filter(c => !c.lost_at).length;
    const lost = allCollections.filter(c => c.lost_at).length;

    console.log('\n📊 RÉSUMÉ:');
    console.log(`   ✅ Actifs: ${active}`);
    console.log(`   ❌ Perdus: ${lost}`);
    console.log(`   📦 Total: ${allCollections.length}`);

    // Liste des actifs
    const activeList = allCollections.filter(c => !c.lost_at);
    console.log('\n✅ COLLECTIBLES ACTIFS ACTUELLEMENT:');
    activeList.forEach((c, i) => {
      const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
      console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

showCollectionHistory();
