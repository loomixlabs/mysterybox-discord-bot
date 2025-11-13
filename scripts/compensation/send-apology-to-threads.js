const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('./utils/database-pg');
require('dotenv').config();

async function sendApologyToThreads() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  try {
    console.log('🤖 Connexion au bot Discord...\n');
    await client.login(process.env.DISCORD_TOKEN);

    const guildId = '1248028543389143070';
    const discordId = '692649463805640724'; // floerin

    console.log('✅ Bot connecté !\n');

    // Récupérer le joueur
    const player = await db.queryOne(`
      SELECT id, username FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, discordId]);

    console.log(`Joueur: ${player.username}\n`);

    // Récupérer les threads de missions récentes (dernières 24h)
    const recentMissions = await db.queryAll(`
      SELECT mp.id, mp.thread_id, mp.status, mp.created_at,
             m.name as mission_name, m.type
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1 AND mp.player_id = $2
        AND mp.created_at > NOW() - INTERVAL '24 hours'
        AND mp.thread_id IS NOT NULL
      ORDER BY mp.created_at DESC
    `, [guildId, player.id]);

    console.log(`📊 Threads de missions trouvés: ${recentMissions.length}\n`);

    if (recentMissions.length === 0) {
      console.log('⚠️ Aucun thread de mission récent trouvé');
      console.log('💡 Les threads ont peut-être été archivés ou supprimés\n');
      await client.destroy();
      process.exit(0);
    }

    // Récupérer les collectibles restaurés
    const restoredCollectibles = await db.queryAll(`
      SELECT col.name, col.rarity, col.image_url
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2
        AND c.lost_at IS NULL
        AND col.name IN ('Joyeux', 'Atchoum', 'Grincheux', 'Simplet')
      ORDER BY col.rarity DESC
    `, [guildId, player.id]);

    console.log(`✅ Collectibles restaurés: ${restoredCollectibles.length}\n`);

    // Envoyer un message dans chaque thread
    let successCount = 0;
    let failCount = 0;

    for (const mission of recentMissions) {
      try {
        console.log(`📝 Traitement du thread: ${mission.mission_name} (${mission.type})`);
        console.log(`   Thread ID: ${mission.thread_id}`);

        // Récupérer le thread
        const thread = await client.channels.fetch(mission.thread_id).catch(() => null);

        if (!thread) {
          console.log(`   ❌ Thread introuvable ou archivé\n`);
          failCount++;
          continue;
        }

        console.log(`   ✅ Thread récupéré: ${thread.name}`);

        // Créer l'embed d'excuse et compensation
        const embed = new EmbedBuilder()
          .setTitle('🔧 BUG CORRIGÉ - Compensation')
          .setDescription(
            `Bonjour ${player.username} ! 👋\n\n` +
            `Un bug a empêché la validation de cette mission plus tôt aujourd'hui. ` +
            `Nous nous excusons sincèrement pour ce désagrément. 🙏`
          )
          .setColor('#FFA500');

        // Ajouter les détails du bug
        embed.addFields({
          name: '🐛 Problème Rencontré',
          value:
            `Le système ne pouvait pas donner de récompense aux joueurs qui avaient ` +
            `perdu des collectibles via un piège. Cela créait une erreur qui bloquait ` +
            `toute la validation de la mission.`,
          inline: false
        });

        // Ajouter la solution
        embed.addFields({
          name: '✅ Solution Appliquée',
          value:
            `• Le bug a été corrigé dans le code\n` +
            `• Les collectibles perdus peuvent maintenant être re-collectés\n` +
            `• Le système de validation fonctionne correctement`,
          inline: false
        });

        // Ajouter la compensation
        if (restoredCollectibles.length > 0) {
          const collectiblesList = restoredCollectibles.map((c, i) => {
            const emoji = c.rarity === 'legendary' ? '⭐' : '⚪';
            return `${i + 1}. ${emoji} **${c.name}** (${c.rarity})`;
          }).join('\n');

          embed.addFields({
            name: '🎁 Compensation',
            value:
              `Nous t'avons restauré **${restoredCollectibles.length} collectibles** perdus :\n\n` +
              collectiblesList +
              `\n\nIls sont de nouveau dans ta collection !`,
            inline: false
          });

          // Utiliser le thumbnail du collectible légendaire
          const legendary = restoredCollectibles.find(c => c.rarity === 'legendary');
          if (legendary && legendary.image_url) {
            embed.setThumbnail(legendary.image_url);
          }
        }

        embed.addFields({
          name: '💡 Pour Tester',
          value:
            `Tu peux maintenant ouvrir de nouvelles mystery boxes et tester les missions. ` +
            `Tout fonctionne correctement ! 🎉`,
          inline: false
        });

        embed.setFooter({ text: 'Désolé pour ce bug - L\'équipe de développement' });
        embed.setTimestamp();

        // Envoyer le message dans le thread
        await thread.send({ embeds: [embed] });
        console.log(`   ✅ Message envoyé avec succès\n`);
        successCount++;

        // Attendre un peu entre chaque envoi
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (threadError) {
        console.log(`   ❌ Erreur: ${threadError.message}\n`);
        failCount++;
      }
    }

    // Résumé
    console.log('📊 RÉSUMÉ:');
    console.log(`   ✅ Messages envoyés: ${successCount}/${recentMissions.length}`);
    if (failCount > 0) {
      console.log(`   ❌ Échecs: ${failCount}`);
    }
    console.log('\n🎉 Messages d\'excuse envoyés avec succès !');

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    try {
      await client.destroy();
    } catch (e) {}
    process.exit(1);
  }
}

sendApologyToThreads();
