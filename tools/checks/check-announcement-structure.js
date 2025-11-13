const db = require('./utils/database-pg');

async function checkStructure() {
  try {
    console.log('🔍 Vérification de la structure announcement_templates...\n');

    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_templates'
      ORDER BY ordinal_position
    `);

    console.table(columns);

    console.log('\n📊 Exemples de données existantes:');
    const samples = await db.queryAll(`
      SELECT * FROM announcement_templates LIMIT 5
    `);

    if (samples.length > 0) {
      console.table(samples);
    } else {
      console.log('⚠️  Aucune donnée dans la table');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkStructure();
