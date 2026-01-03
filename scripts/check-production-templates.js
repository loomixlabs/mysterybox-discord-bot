/**
 * Vérifier les templates du serveur de production
 */
const db = require('../utils/database-pg');

async function check() {
  try {
    console.log('🔍 TEMPLATES SERVEUR PRODUCTION (297309737135898624)\n');
    console.log('='.repeat(80));

    const templates = await db.queryAll(`
      SELECT type, title, description
      FROM announcement_templates
      WHERE guild_id = '297309737135898624'
      ORDER BY type
    `);

    console.log(`\n📋 ${templates.length} templates trouvés\n`);

    templates.forEach(t => {
      const titleVars = t.title.match(/\{[^}]+\}/g) || [];
      const descVars = t.description.match(/\{[^}]+\}/g) || [];
      const allVars = [...new Set([...titleVars, ...descVars])];

      console.log(`\n📌 ${t.type}:`);
      console.log(`   Titre: ${t.title}`);
      console.log(`   Variables: ${allVars.join(', ') || '(aucune)'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
