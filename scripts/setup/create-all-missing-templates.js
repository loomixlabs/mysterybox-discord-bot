const announcementTemplates = require('./utils/announcementTemplates');

async function createAllMissingTemplates() {
  try {
    const guildId = '1248028543389143070';

    console.log('🎨 Création de tous les templates d\'annonces manquants...\n');

    // Créer tous les templates par défaut
    const templatesCreated = await announcementTemplates.createDefaultTemplatesForGuild(guildId);
    console.log(`✅ ${templatesCreated} template(s) créé(s)\n`);

    // Créer les settings d'annonces si nécessaire
    await announcementTemplates.createDefaultAnnouncementSettings(guildId);
    console.log('✅ Settings d\'annonces créés/vérifiés\n');

    console.log('✅ Tous les templates ont été créés avec succès ! 🎉');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createAllMissingTemplates();
