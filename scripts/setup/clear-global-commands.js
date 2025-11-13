require('dotenv').config({ override: true });
const { REST, Routes } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.APPLICATION_ID;

if (!token || !clientId) {
  console.error('❌ DISCORD_TOKEN ou APPLICATION_ID manquant dans .env');
  process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log('🗑️  Suppression des commandes globales...\n');

    // Récupérer toutes les commandes globales
    const commands = await rest.get(
      Routes.applicationCommands(clientId)
    );

    if (commands.length === 0) {
      console.log('✅ Aucune commande globale à supprimer.');
      return;
    }

    console.log(`📋 ${commands.length} commande(s) globale(s) trouvée(s):\n`);
    commands.forEach(cmd => {
      console.log(`   - /${cmd.name}`);
    });

    // Supprimer toutes les commandes globales
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: [] }
    );

    console.log('\n✅ Toutes les commandes globales ont été supprimées !');
    console.log('⏱️  Les changements prendront effet dans ~1 heure.');
    console.log('\n💡 Utilisez npm run deploy-guild pour déployer instantanément sur votre serveur.');

  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
  }
})();
