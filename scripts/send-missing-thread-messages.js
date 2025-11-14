require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Les 2 threads qui n'ont pas reçu de messages d'excuse
const THREADS = [
  {
    thread_id: '1438784619234463794',
    username: 'charlottegnd',
    discord_id: '1202557237382479912',
    issue: 'Mission "baiser" complétée mais aucun collectible attribué',
    compensation: 'Déjà compensé avec Dormeur (epic)'
  },
  {
    thread_id: '1438873799436013694',
    username: '_so_fine_',
    discord_id: '1344750102979416084',
    issue: '2 missions simultanées qui ont causé des conflits et états DB inversés',
    compensation: 'Déjà compensé avec Simplet (common)'
  }
];

async function sendMissingThreadMessages() {
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
    console.log('💬 ENVOI DES MESSAGES D\'EXCUSE DANS LES THREADS MANQUANTS\n');
    console.log('━'.repeat(80));

    for (const { thread_id, username, discord_id, issue, compensation } of THREADS) {
      console.log(`\n📊 Joueur: ${username}`);
      console.log(`   🧵 Thread ID: ${thread_id}`);

      try {
        const thread = await client.channels.fetch(thread_id);

        if (!thread) {
          console.log('   ❌ Thread introuvable\n');
          continue;
        }

        console.log(`   ✅ Thread trouvé: "${thread.name}"`);

        // Envoyer le message d'excuse personnalisé
        const excuseEmbed = new EmbedBuilder()
          .setTitle('🛠️ Correction de Bug + Explication')
          .setDescription(
            `Salut <@${discord_id}> !\n\n` +
            `Nous avons découvert et corrigé plusieurs **bugs critiques** dans le système de missions.\n\n` +
            `**Ce qui s'est passé avec ta mission :**\n` +
            `❌ ${issue}\n\n` +
            `**Bugs corrigés (version 1.1.2) :**\n` +
            `🐛 Bug #1 : Paramètre manquant empêchait l'attribution des collectibles\n` +
            `🐛 Bug #2 : Messages envoyés dans les mauvais threads\n` +
            `🐛 Bug #3 : Missions multiples validées simultanément\n\n` +
            `**Compensation :**\n` +
            `✅ ${compensation}\n\n` +
            `Tous ces problèmes sont maintenant résolus ! 🎉\n` +
            `Désolé pour ce désagrément. 🙏`
          )
          .setColor('#2ecc71')
          .setFooter({ text: 'Bot Discord - Version 1.1.2' })
          .setTimestamp();

        await thread.send({ embeds: [excuseEmbed] });
        console.log('   ✅ Message d\'excuse envoyé dans le thread\n');

      } catch (error) {
        console.log(`   ❌ Erreur lors de l'envoi: ${error.message}\n`);
      }

      console.log('━'.repeat(80));
    }

    console.log('\n✅ Tous les messages ont été envoyés !\n');

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

sendMissingThreadMessages();
