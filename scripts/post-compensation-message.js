require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const CHANNEL_ID = '1264703299584786484';

const PLAYERS = [
  { discord_id: '1202557237382479912', collectible: 'Dormeur (epic)' },
  { discord_id: '692649463805640724', collectible: 'Simplet (common)' },
  { discord_id: '1344750102979416084', collectible: 'Simplet (common)' }
];

const message = `🔧 **Correction appliquée - Missions complétées**

Un bug a été identifié : les missions "Mot Deviné" complétées ne donnaient pas automatiquement les collectibles.

✅ **Compensation effectuée pour :**
<@1202557237382479912> → **Dormeur** (epic) ⭐
<@692649463805640724> → **Simplet** (common)
<@1344750102979416084> → **Simplet** (common)

🎁 Les collectibles ont été ajoutés à vos collections et vos progressions ont été mises à jour.

Le bug est maintenant corrigé ! 🎯`;

async function postCompensationMessage() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  try {
    console.log('🔧 Connexion au bot...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Canal introuvable');
      process.exit(1);
    }

    console.log(`📍 Canal: ${channel.name}`);
    console.log('📤 Envoi du message...\n');

    await channel.send(message);
    console.log('✅ Message de compensation posté !');

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

postCompensationMessage();
