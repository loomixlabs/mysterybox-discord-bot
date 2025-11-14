require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

// Les 3 missions compensées (olympe34370 exclu car avait déjà tous les collectibles)
const COMPENSATED_MISSIONS = [
  { mission_id: 167, discord_id: '1171565802525298749', username: 'joris0237', collectible: 'Grincheux' },
  { mission_id: 166, discord_id: '1318002036075401298', username: 'pop_corn.1203', collectible: 'Simplet' },
  { mission_id: 125, discord_id: '1096205098738253845', username: 'mimie34110', collectible: 'Timide' }
];

async function sendCompensationThreadMessages() {
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

    const guild = await client.guilds.fetch(GUILD_ID);
    console.log(`📍 Serveur: ${guild.name}\n`);

    console.log('━'.repeat(80));
    console.log('💬 ENVOI DES MESSAGES D\'EXCUSE DANS LES THREADS\n');
    console.log('━'.repeat(80));

    for (const { mission_id, discord_id, username, collectible } of COMPENSATED_MISSIONS) {
      console.log(`\n📊 Joueur: ${username} (Mission #${mission_id})`);

      // Récupérer le thread_id de la mission
      const missionInfo = await db.queryOne(`
        SELECT thread_id
        FROM mission_progress
        WHERE id = $1
      `, [mission_id]);

      if (!missionInfo || !missionInfo.thread_id) {
        console.log('   ⚠️  Pas de thread_id pour cette mission\n');
        continue;
      }

      console.log(`   🧵 Thread ID: ${missionInfo.thread_id}`);

      // Récupérer le thread
      try {
        const thread = await client.channels.fetch(missionInfo.thread_id);

        if (!thread) {
          console.log('   ❌ Thread introuvable\n');
          continue;
        }

        console.log(`   ✅ Thread trouvé: "${thread.name}"`);

        // Envoyer le message d'excuse et d'explication
        const compensationEmbed = new EmbedBuilder()
          .setTitle('🛠️ Correction de Bug + Compensation')
          .setDescription(
            `Salut <@${discord_id}> !\n\n` +
            `Nous avons découvert et corrigé un **bug critique** qui empêchait l'attribution des collectibles lors de la complétion des missions.\n\n` +
            `**Ce qui s'est passé :**\n` +
            `❌ Ta mission a été complétée avec succès mais le système n'a pas attribué de récompense\n` +
            `🐛 Problème : Paramètre manquant dans le code d'attribution des collectibles\n\n` +
            `**Compensation :**\n` +
            `🎁 Tu as reçu **${collectible}** pour compenser cette mission\n` +
            `✅ Le bug est maintenant corrigé (version 1.1.2)\n\n` +
            `Désolé pour ce désagrément ! 🙏`
          )
          .setColor('#2ecc71')
          .setFooter({ text: 'Bot Discord - Version 1.1.2' })
          .setTimestamp();

        await thread.send({ embeds: [compensationEmbed] });
        console.log('   ✅ Message de compensation envoyé dans le thread\n');

      } catch (error) {
        console.log(`   ❌ Erreur lors de l'envoi: ${error.message}\n`);
      }

      console.log('━'.repeat(80));
    }

    console.log('\n✅ Tous les messages ont été envoyés !\n');

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

sendCompensationThreadMessages();
