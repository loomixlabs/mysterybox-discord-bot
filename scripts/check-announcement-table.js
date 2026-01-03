const db = require('../utils/database-pg');

async function check() {
  try {
    console.log('🔍 Structure de announcement_templates:\n');

    // Structure de la table
    const structure = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_templates'
      ORDER BY ordinal_position
    `);
    console.table(structure);

    // Templates existants pour le serveur de test
    console.log('\n📋 Templates existants (serveur test):\n');
    const templates = await db.queryAll(`
      SELECT type, title, LEFT(description, 50) as description_preview
      FROM announcement_templates
      WHERE guild_id = '1377376612034695270'
      ORDER BY type
    `);
    console.table(templates);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
