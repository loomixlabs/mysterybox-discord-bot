/**
 * Script pour synchroniser les badges Engagement avec les streaks globaux
 * Ce script analyse tous les joueurs et leur attribue les badges en fonction
 * de leur current_claim_streak (streak global)
 *
 * Note: La table player_badges stocke uniquement les badges débloqués (pas de progression)
 */

const db = require('../utils/database-pg');

// Mapping des badges Engagement
const ENGAGEMENT_BADGES = [
  { code: 'ENGAGEMENT_ACTIF', threshold: 3 },
  { code: 'ENGAGEMENT_ASSIDU', threshold: 7 },
  { code: 'ENGAGEMENT_DEVOU', threshold: 14 },
  { code: 'ENGAGEMENT_MARATHONIEN', threshold: 30 },
  { code: 'ENGAGEMENT_ETERNEL', threshold: 90 }
];

async function syncStreakBadges() {
  try {
    console.log('='.repeat(80));
    console.log('🔄 SYNCHRONISATION DES BADGES ENGAGEMENT (STREAK)');
    console.log('='.repeat(80));
    console.log('');

    // 1. Récupérer tous les badges Engagement depuis la DB
    const badges = await db.queryAll(`
      SELECT id, code, name, condition_value
      FROM badges
      WHERE category = 'engagement'
      ORDER BY condition_value ASC
    `);

    console.log('📋 Badges Engagement trouvés:');
    console.table(badges);

    if (badges.length === 0) {
      console.log('❌ Aucun badge Engagement trouvé dans la DB!');
      process.exit(1);
    }

    // 2. Récupérer tous les joueurs avec leur streak global (utiliser best_claim_streak pour ceux qui ont perdu leur streak actuel)
    const players = await db.queryAll(`
      SELECT id, guild_id, username, current_claim_streak, best_claim_streak
      FROM players
      WHERE current_claim_streak > 0 OR best_claim_streak > 0
      ORDER BY GREATEST(COALESCE(current_claim_streak, 0), COALESCE(best_claim_streak, 0)) DESC
    `);

    console.log(`\n📊 ${players.length} joueur(s) avec un streak > 0`);

    // 3. Pour chaque joueur, vérifier et attribuer les badges
    let totalBadgesAwarded = 0;
    let playersUpdated = 0;

    for (const player of players) {
      // Utiliser le meilleur streak (actuel ou historique) pour les badges
      const streak = Math.max(player.current_claim_streak || 0, player.best_claim_streak || 0);
      let badgesAwardedForPlayer = 0;

      // Parcourir les badges par ordre croissant de seuil
      for (const badge of badges) {
        if (streak >= badge.condition_value) {
          // Vérifier si le joueur a déjà ce badge
          const existingBadge = await db.queryOne(`
            SELECT id FROM player_badges
            WHERE guild_id = $1 AND player_id = $2 AND badge_id = $3
          `, [player.guild_id, player.id, badge.id]);

          if (!existingBadge) {
            // Créer l'entrée - badge débloqué
            await db.query(`
              INSERT INTO player_badges (guild_id, player_id, badge_id, unlocked_at, unlocked_from)
              VALUES ($1, $2, $3, NOW(), 'sync-streak')
              ON CONFLICT (guild_id, player_id, badge_id) DO NOTHING
            `, [player.guild_id, player.id, badge.id]);

            console.log(`  ✅ ${player.username}: Badge "${badge.code}" débloqué (meilleur streak: ${streak})`);
            badgesAwardedForPlayer++;
            totalBadgesAwarded++;
          }
        }
      }

      if (badgesAwardedForPlayer > 0) {
        playersUpdated++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(80));
    console.log(`Joueurs analysés: ${players.length}`);
    console.log(`Joueurs mis à jour: ${playersUpdated}`);
    console.log(`Badges attribués: ${totalBadgesAwarded}`);

    // 4. Afficher les top streaks
    console.log('\n📈 TOP 10 STREAKS GLOBAUX:');
    const topStreaks = await db.queryAll(`
      SELECT username, guild_id, current_claim_streak, best_claim_streak
      FROM players
      WHERE current_claim_streak > 0 OR best_claim_streak > 0
      ORDER BY GREATEST(COALESCE(current_claim_streak, 0), COALESCE(best_claim_streak, 0)) DESC
      LIMIT 10
    `);

    console.table(topStreaks.map(p => ({
      username: p.username,
      streak_actuel: p.current_claim_streak || 0,
      meilleur_streak: p.best_claim_streak || 0
    })));

    console.log('\n✅ Synchronisation terminée!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

syncStreakBadges();
