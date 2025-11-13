const db = require('./utils/database-pg');

async function checkTemplates() {
  try {
    console.log('📋 Vérification des templates d\'annonces...\n');

    // Récupérer tous les templates
    const templates = await db.queryAll(`
      SELECT guild_id, type, title, color
      FROM announcement_templates
      ORDER BY guild_id, type;
    `);

    console.log(`✅ ${templates.length} template(s) trouvé(s):\n`);

    const missionTemplates = templates.filter(t => t.type.startsWith('mission_'));
    console.log(`⚔️  Templates de missions: ${missionTemplates.length}`);

    console.log('\n📝 Tous les templates:');
    console.table(templates);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkTemplates();
