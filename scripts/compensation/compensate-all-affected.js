const db = require('./utils/database-pg');
require('dotenv').config();

async function compensateAllAffected() {
  try {
    const guildId = '1248028543389143070';

    const affectedPlayers = [
      {
        discord_id: '1202557237382479912',
        username: 'amelie0335',
        restore_lost: 1,
        give_mission_rewards: 6
      },
      {
        discord_id: '1176956283518201917',
        username: 'sophiedg0739',
        restore_lost: 1,
        give_mission_rewards: 4
      },
      {
        discord_id: '297307186307006464',
        username: 'xmicordix',
        restore_lost: 3,
        give_mission_rewards: 2
      }
    ];

    console.log('🎁 COMPENSATION AUTOMATIQUE DES JOUEURS AFFECTÉS\n');
    console.log('═'.repeat(80));

    for (const playerInfo of affectedPlayers) {
      console.log(`\n\n👤 ${playerInfo.username.toUpperCase()}`);
      console.log('═'.repeat(80));

      // 1. Récupérer le joueur
      const player = await db.queryOne(`
        SELECT id, username FROM players
        WHERE guild_id = $1 AND discord_id = $2
      `, [guildId, playerInfo.discord_id]);

      console.log(`   Player ID: ${player.id}\n`);

      // 2. Restaurer les collectibles perdus
      if (playerInfo.restore_lost > 0) {
        console.log(`🔧 RESTAURATION DES COLLECTIBLES PERDUS (${playerInfo.restore_lost}):\n`);

        const lostCollectibles = await db.queryAll(`
          SELECT c.id, col.name, col.rarity
          FROM collections c
          JOIN collectibles col ON c.collectible_id = col.id
          WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NOT NULL
          ORDER BY c.lost_at DESC
        `, [guildId, player.id]);

        for (const lost of lostCollectibles) {
          await db.query(`
            UPDATE collections
            SET lost_at = NULL
            WHERE id = $1
          `, [lost.id]);

          const emoji = lost.rarity === 'legendary' ? '⭐' : lost.rarity === 'epic' ? '💎' : lost.rarity === 'rare' ? '🔷' : '⚪';
          console.log(`   ✅ ${emoji} ${lost.name} (${lost.rarity})`);
        }
      }

      // 3. Donner les récompenses de missions manquantes
      if (playerInfo.give_mission_rewards > 0) {
        console.log(`\n🎁 RÉCOMPENSES DE MISSIONS (${playerInfo.give_mission_rewards}):\n`);

        const theme = await db.queryOne(`
          SELECT id FROM themes WHERE guild_id = $1 AND name LIKE '%Blanche%'
        `, [guildId]);

        let givenCount = 0;
        let attempts = 0;
        const maxAttempts = 200; // Limite pour éviter boucles infinies

        while (givenCount < playerInfo.give_mission_rewards && attempts < maxAttempts) {
          attempts++;

          // Obtenir un collectible aléatoire
          const randomCollectible = await db.getRandomCollectible(guildId, theme.id);

          if (!randomCollectible) {
            console.log(`   ⚠️  Plus de collectibles disponibles`);
            break;
          }

          // Vérifier si le joueur l'a déjà
          const alreadyHas = await db.hasCollectible(guildId, player.id, randomCollectible.id);

          if (alreadyHas) {
            continue; // Retenter avec un autre
          }

          // Ajouter le collectible avec source "mission"
          await db.addCollectible(guildId, player.id, randomCollectible.id, 'mission');

          givenCount++;
          const emoji = randomCollectible.rarity === 'legendary' ? '⭐' :
                        randomCollectible.rarity === 'epic' ? '💎' :
                        randomCollectible.rarity === 'rare' ? '🔷' : '⚪';

          console.log(`   ${givenCount}. ✅ ${emoji} ${randomCollectible.name} (${randomCollectible.rarity})`);
        }

        if (givenCount < playerInfo.give_mission_rewards) {
          console.log(`\n   ⚠️  Attention: Seulement ${givenCount}/${playerInfo.give_mission_rewards} collectibles donnés`);
          console.log(`   Le joueur a probablement déjà la plupart des collectibles du thème`);
        }
      }

      // 4. Mettre à jour le compteur de progression
      console.log('\n📊 MISE À JOUR DE LA PROGRESSION:\n');

      const theme = await db.queryOne(`
        SELECT id, required_items FROM themes WHERE guild_id = $1 AND name LIKE '%Blanche%'
      `, [guildId]);

      const newCount = await db.queryOne(`
        SELECT COUNT(*) as total FROM collections
        WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL
      `, [guildId, player.id]);

      await db.query(`
        UPDATE player_progress
        SET collected_count = $1
        WHERE guild_id = $2 AND player_id = $3 AND theme_id = $4
      `, [parseInt(newCount.total), guildId, player.id, theme.id]);

      console.log(`   Progression: ${newCount.total}/${theme.required_items}`);

      // Vérifier si le thème est complété
      if (parseInt(newCount.total) >= theme.required_items) {
        console.log(`   🎉 THÈME COMPLÉTÉ ! Le joueur peut obtenir son rôle final !`);
      }

      console.log('\n   ✅ Compensation terminée pour ce joueur');
      console.log('\n' + '─'.repeat(80));
    }

    console.log('\n\n═'.repeat(80));
    console.log('🎉 COMPENSATION GLOBALE TERMINÉE\n');
    console.log(`✅ ${affectedPlayers.length} joueurs ont été compensés`);
    console.log('\n💡 Actions suivantes:');
    console.log('   1. Envoyer un message privé aux joueurs pour les informer');
    console.log('   2. Poster une annonce sur le serveur expliquant le bug et la compensation');
    console.log('═'.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

compensateAllAffected();
