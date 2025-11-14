require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

// Les 4 missions qui n'ont pas été compensées (résultat de check-already-compensated.js)
const MISSIONS_TO_COMPENSATE = [
  { mission_id: 167, discord_id: '1171565802525298749', username: 'joris0237' },
  { mission_id: 166, discord_id: '1318002036075401298', username: 'pop_corn.1203' },
  { mission_id: 140, discord_id: '1248027211689234535', username: 'olympe34370' },
  { mission_id: 125, discord_id: '1096205098738253845', username: 'mimie34110' }
];

async function compensateMissingMissions() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers
    ]
  });

  try {
    console.log('🔧 Connexion au bot...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    const guild = await client.guilds.fetch(GUILD_ID);
    console.log(`📍 Serveur: ${guild.name}\n`);

    console.log('━'.repeat(80));
    console.log('🎁 COMPENSATION DES MISSIONS NON RÉCOMPENSÉES\n');
    console.log(`Total: ${MISSIONS_TO_COMPENSATE.length} joueurs à compenser\n`);
    console.log('━'.repeat(80));

    for (const { mission_id, discord_id, username } of MISSIONS_TO_COMPENSATE) {
      console.log(`\n📊 Joueur: ${username} (Mission #${mission_id})`);
      console.log(`   Discord ID: ${discord_id}\n`);

      // 1. Récupérer les infos de la mission
      const missionInfo = await db.query(`
        SELECT mp.*, m.name as mission_name, m.theme_id, t.name as theme_name, t.required_items
        FROM mission_progress mp
        JOIN missions m ON mp.mission_id = m.id
        JOIN themes t ON m.theme_id = t.id
        WHERE mp.id = $1
      `, [mission_id]);

      if (missionInfo.length === 0) {
        console.log('   ❌ Mission introuvable\n');
        continue;
      }

      const mission = missionInfo[0];
      console.log(`   Mission: ${mission.mission_name}`);
      console.log(`   Thème: ${mission.theme_name}`);
      console.log(`   Statut: ${mission.status}`);
      console.log(`   Complétée: ${mission.completed_at ? mission.completed_at.toLocaleString() : 'N/A'}\n`);

      // 2. Récupérer le joueur dans la DB
      const player = await db.getPlayer(GUILD_ID, mission.player_id);
      if (!player) {
        console.log('   ❌ Joueur introuvable en DB\n');
        continue;
      }

      // 3. Récupérer un collectible aléatoire du thème
      const randomCollectible = await db.getRandomCollectible(GUILD_ID, mission.theme_id);
      if (!randomCollectible) {
        console.log('   ❌ Aucun collectible disponible pour ce thème\n');
        continue;
      }

      console.log(`   🎁 Collectible à donner: ${randomCollectible.name} (${randomCollectible.rarity})`);

      // 4. Vérifier s'il l'a déjà
      const alreadyHas = await db.hasCollectible(GUILD_ID, player.id, randomCollectible.id);
      if (alreadyHas) {
        console.log(`   ⚠️  Le joueur a déjà ce collectible, recherche d'un autre...`);

        // Chercher un autre collectible qu'il n'a pas
        const allCollectibles = await db.query(`
          SELECT c.* FROM collectibles c
          WHERE c.guild_id = $1 AND c.theme_id = $2
          AND NOT EXISTS (
            SELECT 1 FROM collections col
            WHERE col.guild_id = $1
              AND col.player_id = $3
              AND col.collectible_id = c.id
              AND col.lost_at IS NULL
          )
          ORDER BY RANDOM()
          LIMIT 1
        `, [GUILD_ID, mission.theme_id, player.id]);

        if (allCollectibles.length === 0) {
          console.log(`   ⚠️  Le joueur a déjà TOUS les collectibles de ce thème!\n`);
          continue;
        }

        const newCollectible = allCollectibles[0];
        console.log(`   ✅ Nouveau collectible trouvé: ${newCollectible.name} (${newCollectible.rarity})`);

        // Donner le nouveau collectible
        await db.addCollectible(GUILD_ID, player.id, newCollectible.id, 'give');
        console.log(`   ✅ Collectible ajouté avec source='give' (compensation manuelle)`);

        // Vérifier la progression
        const playerProgress = await db.incrementProgress(GUILD_ID, player.id, mission.theme_id);
        console.log(`   📊 Progression: ${playerProgress.collected_count}/${mission.required_items || 7}`);

        // 5. Vérifier si la collection est complète
        if (playerProgress.collected_count >= mission.required_items && !playerProgress.is_completed) {
          console.log(`\n   🎊 COLLECTION COMPLÈTE ! Attribution du rôle...`);

          // Marquer la collection comme complétée
          await db.query(`
            UPDATE player_progress
            SET is_completed = TRUE, completed_at = NOW()
            WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
          `, [GUILD_ID, player.id, mission.theme_id]);

          // Récupérer le membre Discord
          try {
            const member = await guild.members.fetch(discord_id);

            // Récupérer le rôle du thème
            const themeRole = await db.queryOne(`
              SELECT role_id FROM themes WHERE id = $1
            `, [mission.theme_id]);

            if (themeRole && themeRole.role_id) {
              await member.roles.add(themeRole.role_id);
              console.log(`   ✅ Rôle du thème attribué !`);
            } else {
              console.log(`   ⚠️  Pas de role_id configuré pour ce thème`);
            }
          } catch (error) {
            console.log(`   ⚠️  Impossible d'attribuer le rôle: ${error.message}`);
          }
        }
      } else {
        // Donner le collectible original
        await db.addCollectible(GUILD_ID, player.id, randomCollectible.id, 'give');
        console.log(`   ✅ Collectible ajouté avec source='give' (compensation manuelle)`);

        // Vérifier la progression
        const playerProgress = await db.incrementProgress(GUILD_ID, player.id, mission.theme_id);
        console.log(`   📊 Progression: ${playerProgress.collected_count}/${mission.required_items || 7}`);

        // 5. Vérifier si la collection est complète
        if (playerProgress.collected_count >= mission.required_items && !playerProgress.is_completed) {
          console.log(`\n   🎊 COLLECTION COMPLÈTE ! Attribution du rôle...`);

          // Marquer la collection comme complétée
          await db.query(`
            UPDATE player_progress
            SET is_completed = TRUE, completed_at = NOW()
            WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
          `, [GUILD_ID, player.id, mission.theme_id]);

          // Récupérer le membre Discord
          try {
            const member = await guild.members.fetch(discord_id);

            // Récupérer le rôle du thème
            const themeRole = await db.queryOne(`
              SELECT role_id FROM themes WHERE id = $1
            `, [mission.theme_id]);

            if (themeRole && themeRole.role_id) {
              await member.roles.add(themeRole.role_id);
              console.log(`   ✅ Rôle du thème attribué !`);
            } else {
              console.log(`   ⚠️  Pas de role_id configuré pour ce thème`);
            }
          } catch (error) {
            console.log(`   ⚠️  Impossible d'attribuer le rôle: ${error.message}`);
          }
        }
      }

      console.log('━'.repeat(80));
    }

    console.log('\n✅ Compensation terminée !\n');

    await db.close();
    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    await db.close();
    await client.destroy();
    process.exit(1);
  }
}

compensateMissingMissions();
