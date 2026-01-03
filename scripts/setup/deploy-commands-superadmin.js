/**
 * Script de déploiement des commandes Super Admin
 *
 * Ces commandes sont UNIQUEMENT déployées sur les serveurs autorisés:
 * - Serveur Test: 297309737135898624
 * - Loomix Labs: 1439293457754488905
 *
 * Usage: node scripts/setup/deploy-commands-superadmin.js
 */

require('dotenv').config({ override: true });
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ========================================
// SERVEURS AUTORISÉS POUR SUPER-ADMIN
// ========================================
const AUTHORIZED_GUILDS = [
  '297309737135898624',    // Serveur Test
  '1439293457754488905'    // Loomix Labs (serveur officiel de présentation)
];

const commands = [];

// Charger les commandes superadmin
const commandsPath = path.join(__dirname, '..', '..', 'commands', 'superadmin');

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command) {
      commands.push(command.data.toJSON());
      console.log(`✅ Commande super-admin chargée: ${command.data.name}`);
    }
  }
} else {
  console.error('🔴 Dossier commands/superadmin non trouvé');
  process.exit(1);
}

if (commands.length === 0) {
  console.log('⚠️  Aucune commande super-admin à déployer');
  process.exit(0);
}

// Créer l'instance REST
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Déployer les commandes sur chaque serveur autorisé
(async () => {
  console.log(`\n🔐 Déploiement de ${commands.length} commande(s) super-admin...`);
  console.log(`📍 Serveurs autorisés: ${AUTHORIZED_GUILDS.length}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const guildId of AUTHORIZED_GUILDS) {
    try {
      console.log(`⏳ Déploiement sur serveur ${guildId}...`);

      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.APPLICATION_ID, guildId),
        { body: commands }
      );

      console.log(`   ✅ ${data.length} commande(s) déployée(s) sur ${guildId}`);
      data.forEach(cmd => {
        console.log(`      - /${cmd.name}`);
      });
      successCount++;
    } catch (error) {
      console.error(`   🔴 Erreur sur ${guildId}: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Résultat: ${successCount}/${AUTHORIZED_GUILDS.length} serveur(s) mis à jour`);

  if (failCount > 0) {
    console.log(`⚠️  ${failCount} serveur(s) en erreur (le bot n'est peut-être pas sur ce serveur)`);
  }

  console.log('\n🎉 Déploiement super-admin terminé !\n');
  console.log('💡 Note: Ces commandes sont disponibles immédiatement (guild commands)');
})();
