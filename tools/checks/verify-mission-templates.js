const db = require('./utils/database-pg');

async function verifyMissionTemplates() {
  try {
    const guildId = '297309737135898624';

    console.log('🔍 Vérification des templates de missions...\n');

    const missionTypes = [
      'mission_word_guessed',
      'mission_started',
      'mission_completed',
      'mission_failed',
      'mission_approved',
      'mission_rejected'
    ];

    for (const type of missionTypes) {
      const template = await db.getAnnouncementTemplate(type, guildId);

      if (template) {
        console.log(`✅ ${type}`);
        console.log(`   Titre: ${template.title}`);
        console.log(`   Description: ${template.description.substring(0, 50)}...`);
        console.log(`   Couleur: ${template.color}\n`);
      } else {
        console.log(`❌ ${type} - MANQUANT !\n`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifyMissionTemplates();
