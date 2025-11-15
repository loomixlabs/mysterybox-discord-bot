require('dotenv').config({ override: true });
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];

// Charger toutes les commandes
const commandFolders = ['admin', 'player', 'superadmin'];

for (const folder of commandFolders) {
  const commandsPath = path.join(__dirname, '../../commands', folder);

  if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);

      if ('data' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ Commande chargée: ${command.data.name}`);
      }
    }
  }
}

// Créer l'instance REST
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Déployer les commandes sur le serveur spécifique (GUILD)
(async () => {
  try {
    console.log(`\n🚀 Déploiement INSTANTANÉ de ${commands.length} commandes sur le serveur (GUILD_ID: ${process.env.GUILD_ID})...\n`);
    console.log(`⚡ Les commandes seront disponibles IMMÉDIATEMENT (quelques secondes).\n`);

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.APPLICATION_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log(`\n✅ ${data.length} commandes déployées avec succès sur le serveur !\n`);

    // Afficher la liste
    data.forEach(cmd => {
      console.log(`   /${cmd.name} - ${cmd.description}`);
    });

    console.log('\n🎉 Déploiement instantané terminé !\n');

  } catch (error) {
    console.error('🔴 Erreur lors du déploiement:', error);
  }
})();
