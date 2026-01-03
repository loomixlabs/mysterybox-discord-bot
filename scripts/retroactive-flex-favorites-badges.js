/**
 * Script rétroactif pour les badges FLEX et FAVORITES
 * Attribue les badges aux joueurs qui ont déjà configuré 3 favoris
 * et initialise flex_count pour ceux qui n'ont pas de données
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function runRetroactive() {
  console.log('🏆 Attribution rétroactive des badges FLEX et FAVORITES...\n');
  console.log('='.repeat(70));

  let favoritesAwarded = 0;
  let errors = 0;

  try {
    // 1. Récupérer les joueurs avec 3+ favoris qui n'ont pas encore le badge
    console.log('\n📊 1. Recherche des joueurs avec 3+ favoris...');

    const playersWithFavorites = await db.queryAll(`
      SELECT
        pf.player_id,
        p.guild_id,
        p.username,
        COUNT(*) as fav_count
      FROM player_favorite_collectibles pf
      JOIN players p ON pf.player_id = p.id
      WHERE pf.collectible_id IS NOT NULL
      GROUP BY pf.player_id, p.guild_id, p.username
      HAVING COUNT(*) >= 3
    `);

    console.log(`   ✅ ${playersWithFavorites.length} joueurs trouvés avec 3+ favoris`);

    // 2. Récupérer le badge SOCIAL_FAVORITES
    const badge = await db.queryOne(`
      SELECT id, code, name FROM badges WHERE code = 'SOCIAL_FAVORITES'
    `);

    if (!badge) {
      console.error('❌ Badge SOCIAL_FAVORITES introuvable !');
      process.exit(1);
    }

    console.log(`   🏆 Badge trouvé: ${badge.name} (ID: ${badge.id})`);

    // 3. Attribuer le badge aux joueurs qui ne l'ont pas encore
    console.log('\n📊 2. Attribution du badge SOCIAL_FAVORITES...');

    for (const player of playersWithFavorites) {
      try {
        // Vérifier si le joueur a déjà le badge
        const existing = await db.queryOne(`
          SELECT id FROM player_badges
          WHERE guild_id = $1 AND player_id = $2 AND badge_id = $3
        `, [player.guild_id, player.player_id, badge.id]);

        if (!existing) {
          // Attribuer le badge
          await db.query(`
            INSERT INTO player_badges (guild_id, player_id, badge_id, unlocked_at, unlocked_from)
            VALUES ($1, $2, $3, NOW(), 'retroactive_favorites')
          `, [player.guild_id, player.player_id, badge.id]);

          console.log(`   ✅ Badge attribué à ${player.username} (${player.fav_count} favoris)`);
          favoritesAwarded++;
        }
      } catch (error) {
        console.error(`   ❌ Erreur pour player ${player.player_id}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSUMÉ:');
    console.log(`   ⭐ Badges SOCIAL_FAVORITES attribués: ${favoritesAwarded}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log('='.repeat(70));

    // Vérification finale
    const totalFavoritesBadges = await db.queryOne(`
      SELECT COUNT(*) as count FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      WHERE b.code = 'SOCIAL_FAVORITES'
    `);
    console.log(`\n🏆 Total badges SOCIAL_FAVORITES en DB: ${totalFavoritesBadges.count}`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

runRetroactive()
  .then(() => {
    console.log('\n✅ Script terminé !');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
