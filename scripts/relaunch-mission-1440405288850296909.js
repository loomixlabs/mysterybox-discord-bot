require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database-pg');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function relaunchMission() {
  try {
    await client.login(process.env.DISCORD_TOKEN);

    const threadId = '1440405288850296909';
    const guildId = '1248028543389143070'; // Monopoly Friends (prod)

    console.log('🔍 Vérification du thread et de la mission\n');
    console.log('='.repeat(80));

    // 1. Vérifier le thread existe
    const thread = await client.channels.fetch(threadId);
    if (!thread) {
      console.error('❌ Thread introuvable sur Discord');
      await client.destroy();
      return process.exit(1);
    }

    console.log(`✅ Thread trouvé: "${thread.name}"`);
    console.log(`   Archivé: ${thread.archived}`);
    console.log(`   Parent: ${thread.parent?.name || 'N/A'}\n`);

    // 2. Vérifier si mission_progress existe
    const mp = await db.queryOne(
      `SELECT mp.*, p.username, p.discord_id, m.id as mission_id, m.name as mission_name
       FROM mission_progress mp
       JOIN players p ON mp.player_id = p.id
       JOIN missions m ON mp.mission_id = m.id
       WHERE mp.thread_id = $1`,
      [threadId]
    );

    if (mp) {
      console.log('✅ Mission progress existe déjà:');
      console.table({
        id: mp.id,
        player: mp.username,
        mission: mp.mission_name,
        status: mp.status,
        created: new Date(mp.created_at).toLocaleString('fr-FR')
      });

      // Créer un nouveau bouton si mission en cours
      if (mp.status === 'in_progress') {
        console.log('\n🔄 Envoi d\'un nouveau bouton dans le thread...\n');

        const branding = await db.getGuildBranding(guildId);

        const button = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_start_${mp.mission_id}_${mp.discord_id}`)
            .setLabel('🎯 Lancer la mission')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📋')
        );

        const embed = new EmbedBuilder()
          .setTitle('🎯 MISSION SECRÈTE !')
          .setDescription(
            `Une mission mystérieuse t'attend, **${mp.username}** !\n\n` +
            `📝 Complète-la pour gagner un collectible aléatoire !\n\n` +
            `⏰ Tu as du temps pour l'accomplir.`
          )
          .setColor(branding.secondary_color || '#3498db')
          .setFooter({ text: 'Loomix • Bot de Giveaway Gamifié', iconURL: 'https://i.imgur.com/AfFp7pu.png' });

        await thread.send({
          content: `<@${mp.discord_id}>`,
          embeds: [embed],
          components: [button]
        });

        console.log('✅ Nouveau bouton envoyé dans le thread!');
      } else {
        console.log(`\n⚠️  Mission déjà ${mp.status}, pas de bouton à envoyer`);
      }
    } else {
      console.log('❌ Aucun mission_progress trouvé en base de données');
      console.log('\n🔍 Lecture du message original pour extraire les infos...\n');

      // Lire les messages du thread pour trouver le bouton original
      const messages = await thread.messages.fetch({ limit: 10 });
      let missionId = null;
      let userId = null;

      for (const msg of messages.values()) {
        if (msg.components.length > 0) {
          const button = msg.components[0]?.components[0];
          if (button && button.customId && button.customId.startsWith('mission_start_')) {
            const parts = button.customId.split('_');
            missionId = parseInt(parts[2]);
            userId = parts[3];

            console.log('✅ Informations extraites du bouton:');
            console.log(`   Mission ID: ${missionId}`);
            console.log(`   User ID: ${userId}\n`);
            break;
          }
        }
      }

      if (missionId && userId) {
        // Récupérer le joueur
        const player = await db.queryOne(
          'SELECT * FROM players WHERE guild_id = $1 AND discord_id = $2',
          [guildId, userId]
        );

        if (!player) {
          console.error('❌ Joueur introuvable en base de données');
          await client.destroy();
          return process.exit(1);
        }

        console.log(`✅ Joueur trouvé: ${player.username}\n`);

        // Créer le mission_progress manquant
        console.log('🔄 Création du mission_progress manquant...\n');

        const newMp = await db.createMissionProgress(guildId, player.id, missionId, threadId);

        console.log('✅ Mission progress créé:');
        console.table({
          id: newMp.id,
          player_id: newMp.player_id,
          mission_id: newMp.mission_id,
          thread_id: newMp.thread_id,
          status: newMp.status
        });

        console.log('\n✅ La mission est maintenant opérationnelle!');
        console.log('   Le joueur peut cliquer sur le bouton existant dans le thread.');
      } else {
        console.error('❌ Impossible d\'extraire les informations du bouton');
      }
    }

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await client.destroy();
    process.exit(1);
  }
}

relaunchMission();
