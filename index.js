require('dotenv').config({ override: true });
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./utils/database-pg'); // PostgreSQL multi-serveur
const campaignHandler = require('./handlers/campaignHandler');
const themeExpirationHandler = require('./handlers/themeExpirationHandler');
const { version } = require('./package.json');

// Créer le client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Collection pour stocker les commandes
client.commands = new Collection();

// Charger les commandes
const commandFolders = ['admin', 'player', 'superadmin'];
for (const folder of commandFolders) {
  const commandsPath = path.join(__dirname, 'commands', folder);

  if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Commande chargée: ${command.data.name}`);
      } else {
        console.warn(`⚠️  Commande ${file} manque "data" ou "execute"`);
      }
    }
  }
}

// Charger les événements
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }

    console.log(`✅ Événement chargé: ${event.name}`);
  }
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', error => {
  console.error('🔴 Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('🔴 Uncaught exception:', error);
});

// Connexion du bot
client.login(process.env.DISCORD_TOKEN)
  .then(async () => {
    console.log('🤖 Bot connecté à Discord !');
    console.log(`📦 Version: v${version}`);

    // Tester la connexion à la base de données
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      console.error('🔴 Impossible de se connecter à la base de données !');
      process.exit(1);
    }

    // Initialiser les campagnes actives (tous les serveurs)
    try {
      await campaignHandler.initActiveCampaigns(client);
    } catch (error) {
      console.error('🔴 Erreur lors de l\'initialisation des campagnes:', error);
    }

    // Initialiser le système d'expiration des thèmes
    try {
      await themeExpirationHandler.init(client);
    } catch (error) {
      console.error('🔴 Erreur lors de l\'initialisation de l\'expiration des thèmes:', error);
    }

    // Activer le mini-jeu Harry Potter (Baguette de Sureau)
    const reactionHandler = require('./events/messageReactionAdd');
    reactionHandler.setHPGameMessageId('1450268822820094012');
    console.log('🪄 Mini-jeu Harry Potter activé !');
  })
  .catch(error => {
    console.error('🔴 Erreur de connexion Discord:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Arrêt du bot...');
  themeExpirationHandler.stop();
  await db.close();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Arrêt du bot (SIGTERM)...');
  await db.close();
  client.destroy();
  process.exit(0);
});
