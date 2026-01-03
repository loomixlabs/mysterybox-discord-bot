require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const CHANNEL_ID = '1248176835490091110'; // Salon d'annonces
const ROLE_ID = '1248150310044831836'; // Rôle à ping

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.once('ready', async () => {
  try {
    console.log('🤖 Bot connecté:', client.user.tag);
    console.log('📢 Préparation de l\'annonce v1.5.0...\n');

    // Récupérer le salon
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Salon introuvable!');
      process.exit(1);
    }

    console.log(`✅ Salon trouvé: #${channel.name}`);

    // Créer l'embed principal
    const embed = new EmbedBuilder()
      .setTitle('🎉 MISE À JOUR v1.5.0 DISPONIBLE 🎉')
      .setColor('#FFD700') // Or
      .setDescription(
        `╔══════════════════════════════════════╗\n` +
        `║         ✨ NOUVEAUX SUPER BONUS ✨        ║\n` +
        `╚══════════════════════════════════════╝\n\n` +

        `**👁️ VISION DIVINE** • 5 charges\n` +
        `├─ Révèle le contenu AVANT d'ouvrir\n` +
        `├─ Choisis d'accepter ou de passer\n` +
        `└─ Stratégie optimale! 🎯\n\n` +

        `**💰 JACKPOT X2** • 1 utilisation\n` +
        `├─ 2 collectibles au lieu d'1!\n` +
        `├─ Progression accélérée\n` +
        `└─ Chance maximale! 🍀\n\n` +

        `**🧲 AIMANT À LÉGENDAIRES** • 3 jours\n` +
        `├─ +50% de chance sur les légendaires\n` +
        `├─ Raretés élevées accessibles\n` +
        `└─ Collection complète plus rapide! ⚡`
      )
      .addFields(
        {
          name: '\u200B',
          value:
            `╔══════════════════════════════════════╗\n` +
            `║       📱 COMMENT UTILISER VOS BONUS 📱      ║\n` +
            `╚══════════════════════════════════════╝\n\n` +
            `**Retrouvez vos bonus dans** \`/profile\` **→ "Mes Bonus"**\n\n` +
            `**⚡ BONUS AUTOMATIQUES** (ex: Aimant, Jackpot x2)\n` +
            `└─ S'activent automatiquement dès réception\n` +
            `└─ Pas besoin de bouton, c'est instantané!\n\n` +
            `**🎯 BONUS MANUELS** (ex: Vision Divine)\n` +
            `└─ Vous choisissez QUAND les activer\n` +
            `└─ Utilisez les boutons dans "Mes Bonus"\n` +
            `└─ Stratégie optimale selon votre besoin!`,
          inline: false
        },
        {
          name: '\u200B',
          value:
            `╔══════════════════════════════════════╗\n` +
            `║           💫 AMÉLIORATIONS UI 💫          ║\n` +
            `╚══════════════════════════════════════╝\n\n` +
            `📋 Interface "Mes Bonus" redesignée\n` +
            `🎁 Archivage auto des messages (fini le spam!)\n` +
            `✅ Meilleure organisation visuelle`,
          inline: false
        },
        {
          name: '\u200B',
          value:
            `╔══════════════════════════════════════╗\n` +
            `║             🐛 BUGS CORRIGÉS 🐛            ║\n` +
            `╚══════════════════════════════════════╝\n\n` +
            `🔴 **CRITIQUE**: Attribution automatique des rôles\n` +
            `   → Vous recevez enfin votre rôle automatiquement!\n\n` +
            `🔧 Missions bloquées réparées\n` +
            `🔧 Threads qui ne se fermaient pas\n` +
            `🔧 Compteurs de bonus corrigés`,
          inline: false
        }
      )
      .setFooter({ text: '💡 Ouvrez des mystery boxes pour récupérer ces super bonus et consultez /profile pour les gérer!' })
      .setTimestamp();

    // Envoyer le ping du rôle + annonce
    console.log('📤 Envoi de l\'annonce...\n');

    await channel.send({
      content: `<@&${ROLE_ID}>`,
      embeds: [embed]
    });

    console.log('✅ Annonce postée avec succès!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RÉSUMÉ:');
    console.log(`   • Salon: #${channel.name}`);
    console.log(`   • Rôle pingé: <@&${ROLE_ID}>`);
    console.log(`   • Version: v1.5.0`);
    console.log(`   • Contenu: 3 nouveaux super bonus + améliorations + corrections`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
