const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const ANNOUNCEMENT_CHANNEL = '1248176835490091110';

const ANNOUNCEMENT_MESSAGE = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌲 L'arbre attend...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Le bon arbre a été trouvé par certains d'entre vous.
Mais le regarder ne révèle rien.

*Les mots ne sont pas toujours la réponse.*
*Parfois, un simple geste suffit.*

Blanche-Neige n'a pas hésité à agir.
Et toi ?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

// Calculer le temps d'attente jusqu'à 23h59
function getTimeUntilScheduled() {
  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(23, 59, 0, 0);

  // Si on est déjà passé 23h59 aujourd'hui, programmer pour demain
  if (now > scheduled) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  return scheduled - now;
}

async function scheduleAnnouncement() {
  const waitTime = getTimeUntilScheduled();
  const scheduledTime = new Date(Date.now() + waitTime);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⏰ PROGRAMMATION DE L\'ANNONCE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📅 Heure actuelle: ${new Date().toLocaleString('fr-FR')}`);
  console.log(`🎯 Heure programmée: ${scheduledTime.toLocaleString('fr-FR')}`);
  console.log(`⏳ Temps d'attente: ${Math.floor(waitTime / 1000 / 60)} minutes`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Le bot restera actif en arrière-plan...\n');

  setTimeout(async () => {
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });

    client.once('ready', async () => {
      try {
        console.log(`\n🤖 Bot connecté: ${client.user.tag}`);
        console.log('📤 Envoi de l\'annonce programmée...\n');

        const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL);
        if (channel) {
          await channel.send({ content: ANNOUNCEMENT_MESSAGE });
          console.log(`✅ Message d'annonce posté dans: ${channel.name}`);
          console.log(`🕐 Heure d'envoi: ${new Date().toLocaleString('fr-FR')}\n`);
        }

        process.exit(0);
      } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
      }
    });

    client.login(process.env.DISCORD_TOKEN);
  }, waitTime);
}

scheduleAnnouncement();
