require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';
const THEME_ID = 23; // Blanche-Neige

const PLAYERS = [
  { id: 310, username: 'amelie0335', discord_id: '1202557237382479912' },
  { id: 313, username: 'floerin', discord_id: '692649463805640724' },
  { id: 492, username: '_so_fine_', discord_id: '1344750102979416084' }
];

async function giveMissingRewards() {
  console.log('🎁 Attribution des récompenses manquantes...\n');

  try {
    for (const player of PLAYERS) {
      console.log('━'.repeat(60));
      console.log(`👤 Joueur: ${player.username} (ID: ${player.id})`);

      // Récupérer un collectible aléatoire du thème
      const collectible = await db.query(
        `SELECT * FROM collectibles
         WHERE guild_id = $1 AND theme_id = $2
         ORDER BY RANDOM()
         LIMIT 1`,
        [GUILD_ID, THEME_ID]
      );

      if (collectible.length === 0) {
        console.log('   ❌ Aucun collectible disponible pour ce thème');
        continue;
      }

      const item = collectible[0];
      console.log(`   🎁 Collectible sélectionné: ${item.name} (${item.rarity})`);

      // Vérifier si le joueur possède déjà ce collectible
      const hasIt = await db.query(
        `SELECT * FROM collections
         WHERE guild_id = $1 AND player_id = $2 AND collectible_id = $3 AND lost_at IS NULL`,
        [GUILD_ID, player.id, item.id]
      );

      if (hasIt.length > 0) {
        console.log(`   ⚠️  Le joueur possède déjà ${item.name}, on en choisit un autre...`);

        // Trouver un collectible qu'il n'a pas
        const notOwned = await db.query(
          `SELECT c.* FROM collectibles c
           WHERE c.guild_id = $1 AND c.theme_id = $2
           AND c.id NOT IN (
             SELECT collectible_id FROM collections
             WHERE guild_id = $1 AND player_id = $3 AND lost_at IS NULL
           )
           ORDER BY RANDOM()
           LIMIT 1`,
          [GUILD_ID, THEME_ID, player.id]
        );

        if (notOwned.length === 0) {
          console.log('   ✅ Le joueur a déjà tous les collectibles du thème !');
          console.log('   🎁 On lui donne quand même un collectible aléatoire');
          // Donner le collectible même s'il l'a déjà (il pourra l'échanger)
        } else {
          const newItem = notOwned[0];
          console.log(`   🆕 Nouveau collectible: ${newItem.name} (${newItem.rarity})`);

          // Ajouter le collectible (utiliser addCollectible qui gère ON CONFLICT)
          await db.addCollectible(GUILD_ID, player.id, newItem.id, 'mission');

          console.log(`   ✅ Collectible ${newItem.name} ajouté à la collection !`);

          // Mettre à jour la progression
          await db.incrementProgress(GUILD_ID, player.id, THEME_ID);
          console.log('   ✅ Progression mise à jour');
          continue;
        }
      }

      // Ajouter le collectible original (utiliser addCollectible qui gère ON CONFLICT)
      await db.addCollectible(GUILD_ID, player.id, item.id, 'mission');

      console.log(`   ✅ Collectible ${item.name} ajouté à la collection !`);

      // Mettre à jour la progression
      await db.incrementProgress(GUILD_ID, player.id, THEME_ID);
      console.log('   ✅ Progression mise à jour');
      console.log('');
    }

    console.log('━'.repeat(60));
    console.log('\n🎉 Toutes les récompenses manquantes ont été attribuées !');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

giveMissingRewards();
