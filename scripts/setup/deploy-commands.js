require('dotenv').config({ override: true });
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];

// Charger toutes les commandes (SAUF superadmin qui est déployé séparément)
// superadmin est déployé via deploy-commands-superadmin.js
const commandFolders = ['admin', 'player'];

for (const folder of commandFolders) {
  // Remonter de 2 niveaux: scripts/setup → scripts → racine
  const commandsPath = path.join(__dirname, '..', '..', 'commands', folder);

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

// Déployer les commandes
(async () => {
  try {
    console.log(`\n🚀 Déploiement de ${commands.length} commandes slash globalement...\n`);
    console.log(`⏳ Les commandes seront disponibles dans ~1 heure sur tous les serveurs.\n`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.APPLICATION_ID),
      { body: commands }
    );

    console.log(`\n✅ ${data.length} commandes globales déployées avec succès !\n`);

    // Afficher la liste
    data.forEach(cmd => {
      console.log(`   /${cmd.name} - ${cmd.description}`);
    });

    console.log('\n🎉 Déploiement terminé !\n');

  } catch (error) {
    console.error('🔴 Erreur lors du déploiement:', error);
  }
})();
