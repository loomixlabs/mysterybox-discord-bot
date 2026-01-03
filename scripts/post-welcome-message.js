require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CHANNEL_ID = '1451672205791334451';

const MESSAGE = `@everyone

# 🦉 VOTRE LETTRE EST ARRIVÉE...

*"Cher futur sorcier,
Nous avons le plaisir de vous informer qu'un nouveau défi vous attend...
Le jeu MysteryBox ouvrira ses portes très prochainement."*

**Bienvenue dans votre Salle Commune.** 🏰

━━━━━━━━━━━━━━━━━━

📜 **VOTRE MISSION (si vous l'acceptez)**
• Poser vos questions sur le jeu
• Échanger avec vos futurs alliés
• Être fin prêt pour la Cérémonie de lancement

⚠️ *Les bavardages MysteryBox se font uniquement dans cette salle*

━━━━━━━━━━━━━━━━━━

🤝 **L'UNION FAIT LA FORCE**
Ce salon servira aux missions **"Mot à faire deviner"**
Aidez vos camarades, ils vous le rendront ! ✨

> *"Ce sont nos choix qui montrent ce que nous sommes vraiment, bien plus que nos aptitudes."* — Dumbledore

━━━━━━━━━━━━━━━━━━

📖 Ouvre ton grimoire → \`/tutoriel\`

**La magie n'attend que vous...** ⚡🪄`;

async function postMessage() {
  try {
    await new Promise(resolve => client.once('ready', resolve));
    console.log('✅ Bot connecté');

    const channel = await client.channels.fetch(CHANNEL_ID);
    await channel.send(MESSAGE);

    console.log('✅ Message posté dans #' + channel.name);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

client.login(process.env.DISCORD_TOKEN);
postMessage();
