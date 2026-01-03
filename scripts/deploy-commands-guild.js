/**
 * Script pour déployer les commandes slash sur un serveur spécifique
 * Usage: node scripts/deploy-commands-guild.js <GUILD_ID>
 *
 * Les commandes de guild sont disponibles IMMÉDIATEMENT (pas de délai d'1 heure)
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const GUILD_ID = process.argv[2] || process.env.GUILD_ID;

if (!GUILD_ID) {
  console.error('❌ Usage: node scripts/deploy-commands-guild.js <GUILD_ID>');
  console.error('   ou définissez GUILD_ID dans .env');
  process.exit(1);
}

console.log(`🚀 Déploiement des commandes sur le serveur ${GUILD_ID}...\n`);

const commands = [];

// Charger toutes les commandes depuis les dossiers
const commandFolders = ['admin', 'player', 'superadmin'];
const commandsPath = path.join(__dirname, '..', 'commands');

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.existsSync(folderPath)) continue;

  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(folderPath, file));
    if (command.data) {
      commands.push(command.data.toJSON());
      console.log(`✅ Commande chargée: ${command.data.name}`);
    }
  }
}

console.log(`\n📦 ${commands.length} commandes à déployer\n`);

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('⏳ Déploiement en cours...\n');

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.APPLICATION_ID, GUILD_ID),
      { body: commands }
    );

    console.log(`✅ ${data.length} commandes déployées sur le serveur ${GUILD_ID} !`);
    console.log('\n🎉 Les commandes sont disponibles IMMÉDIATEMENT sur ce serveur !\n');

  } catch (error) {
    console.error('❌ Erreur lors du déploiement:', error);
  }
})();
