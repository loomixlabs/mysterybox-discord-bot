/**
 * Script pour poster l'annonce des gagnants du mini-jeu Harry Potter
 * Canal: 1339571870755717120 (Annonces officielles)
 */
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const HP_GUILD_ID = '1182395170273099806';
const ANNOUNCEMENT_CHANNEL_ID = '1339571870755717120';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  console.log('\n' + '='.repeat(60));
  console.log('⚡ ANNONCE DES GAGNANTS HARRY POTTER');
  console.log('='.repeat(60));

  try {
    const guild = await client.guilds.fetch(HP_GUILD_ID);
    console.log(`\n✅ Connecté au serveur: ${guild.name}`);

    const channel = await guild.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Canal des annonces introuvable');
      process.exit(1);
    }

    // Créer l'embed de l'annonce
    const announcementEmbed = new EmbedBuilder()
      .setTitle('⚡ LES SORCIERS PERSPICACES ONT TROUVÉ LA BAGUETTE DE SUREAU ! ⚡')
      .setDescription(
        'Félicitations à nos **6 nouveaux détenteurs** du rôle **« Sorcier Perspicace »** :\n\n' +
        '🧙 **Queen Ali 👑**\n' +
        '🧙 **Erin**\n' +
        '🧙 **Haubitt**\n' +
        '🧙 **Delph\'Olympe💫**\n' +
        '🧙 **Aude4462**\n' +
        '🧙 **Anaïs**\n\n' +
        'Ils ont su déchiffrer les indices et localiser la plus puissante des Reliques de la Mort !'
      )
      .setColor('#9B59B6')
      .addFields(
        {
          name: '🎁 CE QUE LE RÔLE LEUR ACCORDE',
          value: '→ Des informations complètes sur le jeu à venir\n' +
                 '→ L\'initiation à un mystère bien plus grand...',
          inline: false
        },
        {
          name: '🔮 POUR LES AUTRES : LA QUÊTE CONTINUE !',
          value: 'La Baguette de Sureau attend toujours d\'être découverte...',
          inline: false
        },
        {
          name: '💡 Nouvel Indice de Trelawney',
          value: '```\n' +
                 '« Trouver n\'est que le premier pas...\n' +
                 '  Pour éveiller ce qui sommeille,\n' +
                 '  Le sorcier doit agir, pas seulement regarder.\n' +
                 '  Un geste simple, comme saluer une vieille connaissance... »\n' +
                 '```',
          inline: false
        }
      )
      .setFooter({ text: '⚡ Que la magie guide vos pas !' })
      .setTimestamp();

    // Envoyer l'annonce avec @everyone
    const message = await channel.send({
      content: '@everyone',
      embeds: [announcementEmbed]
    });

    console.log(`\n✅ Annonce envoyée dans #${channel.name}`);
    console.log(`📝 ID du message: ${message.id}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
