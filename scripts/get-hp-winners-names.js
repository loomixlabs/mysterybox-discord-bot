/**
 * Script pour récupérer les noms des gagnants du mini-jeu HP via l'API Discord
 */
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const HP_GUILD_ID = '1182395170273099806';

// IDs des gagnants
const WINNER_IDS = [
  '297307186307006464',
  '680580079612592227',
  '692649463805640724',
  '397172909333807104',
  '1248027211689234535',
  '287627991691821076',
  '918254330107265064'
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🪄 GAGNANTS DU MINI-JEU HARRY POTTER');
  console.log('='.repeat(60) + '\n');

  try {
    const guild = await client.guilds.fetch(HP_GUILD_ID);
    console.log(`Serveur: ${guild.name}\n`);

    console.log('# | Username | Display Name | ID');
    console.log('-'.repeat(60));

    for (let i = 0; i < WINNER_IDS.length; i++) {
      const userId = WINNER_IDS[i];
      try {
        const user = await client.users.fetch(userId);
        const member = await guild.members.fetch(userId).catch(() => null);
        const displayName = member ? member.displayName : user.globalName || user.username;

        console.log(`${i + 1} | ${user.username} | ${displayName} | ${userId}`);
      } catch (error) {
        console.log(`${i + 1} | ❌ Erreur | - | ${userId}`);
      }
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
