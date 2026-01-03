/**
 * Script pour créer le canal récap-MysteryBox sur le serveur HP
 */
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const HP_GUILD_ID = '1182395170273099806';
const CATEGORY_ID = '1182441697683193937';
const STAFF_ROLE_ID = '1196166864959705149';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log('='.repeat(60));
  console.log('📜 CRÉATION DU CANAL RÉCAP-MYSTERYBOX');
  console.log('='.repeat(60));

  try {
    const guild = await client.guilds.fetch(HP_GUILD_ID);
    console.log(`\n✅ Serveur trouvé: ${guild.name}`);

    // Créer le canal avec les permissions
    const channel = await guild.channels.create({
      name: '📜・récap-MysteryBox',
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      topic: 'Récapitulatif automatique des événements MysteryBox (pièges, collectibles, etc.)',
      permissionOverwrites: [
        {
          // @everyone - pas d'écriture
          id: guild.id,
          deny: [PermissionFlagsBits.SendMessages],
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          // Staff - peut écrire
          id: STAFF_ROLE_ID,
          allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          // Bot - peut écrire
          id: client.user.id,
          allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles]
        }
      ]
    });

    console.log(`\n✅ Canal créé avec succès !`);
    console.log(`📍 Nom: ${channel.name}`);
    console.log(`🆔 ID: ${channel.id}`);
    console.log(`📂 Catégorie: ${channel.parent?.name || 'Aucune'}`);
    console.log(`\n📋 Permissions:`);
    console.log(`   - @everyone: lecture seule`);
    console.log(`   - Staff: lecture + écriture`);
    console.log(`   - Bot: lecture + écriture + embeds`);

    // Envoyer un message de bienvenue
    await channel.send({
      embeds: [{
        title: '📜 Canal Récapitulatif MysteryBox',
        description:
          'Ce canal affiche automatiquement les événements importants du jeu MysteryBox:\n\n' +
          '🎁 **Collectibles obtenus** (légendaires, épiques...)\n' +
          '⚠️ **Pièges déclenchés**\n' +
          '🏆 **Missions accomplies**\n' +
          '✨ **Super Bonus activés**\n\n' +
          '*Seul le staff peut écrire dans ce canal.*',
        color: 0x9b59b6,
        timestamp: new Date().toISOString()
      }]
    });

    console.log(`\n✅ Message de bienvenue envoyé !`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
