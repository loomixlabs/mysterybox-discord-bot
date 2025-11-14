require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const ANNOUNCE_CHANNEL_ID = '1248176835490091110';

async function announceV113() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    console.log('🔧 Connexion au bot...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    console.log('━'.repeat(80));
    console.log('📢 PUBLICATION DE L\'ANNONCE v1.1.3\n');
    console.log('━'.repeat(80));

    const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);

    if (!channel) {
      console.log('❌ Canal introuvable\n');
      process.exit(1);
    }

    console.log(`✅ Canal trouvé: #${channel.name}\n`);

    // Embed principal
    const mainEmbed = new EmbedBuilder()
      .setTitle('✨ Mise à Jour v1.1.3 - Nouveau Piège Catastrophique !')
      .setDescription(
        '**Le système de pièges s\'enrichit d\'un nouveau danger... le plus redoutable de tous !**\n\n' +
        '⚠️ Un nouveau piège vient d\'être ajouté au jeu, et celui-ci est **DÉVASTATEUR**.'
      )
      .setColor('#8b0000')
      .setTimestamp();

    // Embed détails du piège
    const trapEmbed = new EmbedBuilder()
      .setTitle('👑⚡ Le Sortilège Ultime de la Reine')
      .setDescription(
        '**Un piège d\'une puissance inégalée...**\n\n' +
        '🎯 **Type**: Perdre TOUS les collectibles\n' +
        '💥 **Effet**: Efface TOUTE votre collection en un instant\n' +
        '👑 **Histoire**: La Reine, folle de jalousie devant votre magnifique collection, lance son sortilège le plus sombre. Un éclair noir frappe vos trésors et tout disparaît dans l\'obscurité...\n\n' +
        '⚠️ **Attention**: Ce piège peut désormais apparaître dans les boîtes mystère !\n\n' +
        '💡 **Conseil**: Ouvrez vos boîtes avec prudence... la Reine veille ! 👁️'
      )
      .setColor('#4b0082')
      .setFooter({ text: 'Version 1.1.3' });

    // Embed technique
    const technicalEmbed = new EmbedBuilder()
      .setTitle('🔧 Détails Techniques')
      .setDescription(
        '**Ce qui a été ajouté:**\n' +
        '✅ Nouveau type de piège: `lose-all-collectibles`\n' +
        '✅ Système de soft delete (l\'historique est préservé)\n' +
        '✅ Annonces publiques personnalisées\n' +
        '✅ Intégration complète au panel admin\n\n' +
        '**Thématisation:**\n' +
        '🎭 Chaque thème peut avoir sa propre version de ce piège\n' +
        '🍎 Blanche-Neige: "Le Sortilège Ultime de la Reine"\n\n' +
        '**Statistiques:**\n' +
        '📊 6 types de pièges maintenant disponibles\n' +
        '📊 Tous les pièges sont actifs et configurables'
      )
      .setColor('#2ecc71')
      .setFooter({ text: 'Bot Discord - Version 1.1.3' });

    await channel.send({ embeds: [mainEmbed, trapEmbed, technicalEmbed] });

    console.log('✅ Annonce publiée avec succès !\n');
    console.log('━'.repeat(80));

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

announceV113();
