const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const GUILD_ID = '1248028543389143070';

async function createRole() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once('ready', async () => {
    try {
      console.log(`🤖 Bot connecté: ${client.user.tag}\n`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🕵️ CRÉATION DU RÔLE CHASSEUR ÉNIGMATIQUE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const guild = await client.guilds.fetch(GUILD_ID);

      // Vérifier si le rôle existe déjà
      const existingRole = guild.roles.cache.find(role => role.name === '🕵️ Chasseur énigmatique');

      if (existingRole) {
        console.log('⚠️ Le rôle existe déjà !');
        console.log(`🆔 Role ID: ${existingRole.id}`);
        console.log(`🎨 Couleur: ${existingRole.hexColor}`);
        console.log(`📍 Position: ${existingRole.position}`);
        console.log('\nTu peux utiliser cet ID pour configurer le mini-jeu.');
        process.exit(0);
        return;
      }

      // Créer le rôle
      const role = await guild.roles.create({
        name: '🕵️ Chasseur énigmatique',
        color: '#9B59B6', // Violet mystérieux
        reason: 'Rôle exclusif pour les gagnants du mini-jeu de la pomme enchantée',
        hoist: true, // Afficher séparément dans la liste des membres
        mentionable: false
      });

      console.log('✅ Rôle créé avec succès !\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 INFORMATIONS DU RÔLE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🆔 Role ID: ${role.id}`);
      console.log(`👤 Nom: ${role.name}`);
      console.log(`🎨 Couleur: ${role.hexColor}`);
      console.log(`📍 Position: ${role.position}`);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📝 PROCHAINE ÉTAPE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Je vais maintenant configurer le mini-jeu pour attribuer ce rôle automatiquement.');
      console.log(`Copie cet ID: ${role.id}\n`);

      process.exit(0);

    } catch (error) {
      console.error('❌ Erreur:', error);
      process.exit(1);
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

createRole();
