const db = require('./utils/database-pg');

async function checkAnnouncementTemplates() {
  try {
    console.log('🔍 ANALYSE DE LA TABLE ANNOUNCEMENT_TEMPLATES\n');
    console.log('='.repeat(80));

    // 1. Structure de la table
    console.log('\n📋 Structure de announcement_templates:');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name='announcement_templates'
      ORDER BY ordinal_position;
    `);

    console.table(columns);

    // 2. Templates existants (limité)
    console.log('\n📊 Templates existants:');
    const templates = await db.queryAll(`
      SELECT id, guild_id, title, description, color
      FROM announcement_templates
      LIMIT 10;
    `);

    if (templates && templates.length > 0) {
      console.table(templates);
    } else {
      console.log('⚠️ Aucun template trouvé.');
    }

    // 3. Compter les templates
    console.log('\n📈 Statistiques:');
    const stats = await db.queryAll(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT guild_id) as guilds_with_templates
      FROM announcement_templates;
    `);
    console.table(stats);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkAnnouncementTemplates();
