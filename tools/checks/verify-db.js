const db = require('./utils/database-pg');

async function verifyDatabase() {
  try {
    console.log('🔍 VÉRIFICATION COMPLÈTE DE LA BASE DE DONNÉES\n');
    console.log('='.repeat(80));

    // 1. Vérifier la connexion
    console.log('\n📡 CONNEXION:');
    const connectionTest = await db.queryOne('SELECT NOW() as current_time');
    console.log(`✅ Connecté à PostgreSQL`);
    console.log(`   Timestamp: ${connectionTest.current_time}`);

    // 2. Lister toutes les tables
    console.log('\n📋 TABLES:');
    const tables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log(`✅ ${tables.length} table(s) trouvée(s):`);
    tables.forEach(t => console.log(`   - ${t.table_name}`));

    // 3. Vérifier announcement_settings
    console.log('\n🔔 ANNOUNCEMENT_SETTINGS:');
    const announcementColumns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name='announcement_settings'
      ORDER BY ordinal_position;
    `);
    console.table(announcementColumns);

    // 4. Vérifier les données announcement_settings
    const announcementData = await db.queryAll(`
      SELECT * FROM announcement_settings LIMIT 5;
    `);
    console.log(`✅ ${announcementData.length} ligne(s) de données`);

    // 5. Vérifier announcement_templates
    console.log('\n📝 ANNOUNCEMENT_TEMPLATES:');
    const templates = await db.queryAll(`
      SELECT type, title, LEFT(description, 50) as description_preview
      FROM announcement_templates
      ORDER BY type;
    `);
    console.table(templates);

    // 6. Vérifier les colonnes missions spécifiquement
    console.log('\n⚔️ COLONNES MISSIONS:');
    const missionColumns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name='announcement_settings'
      AND column_name LIKE '%mission%'
      ORDER BY column_name;
    `);
    console.table(missionColumns);

    // 7. Résumé
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ VÉRIFICATION TERMINÉE!');
    console.log(`📊 Total tables: ${tables.length}`);
    console.log(`🔔 Colonnes announcement_settings: ${announcementColumns.length}`);
    console.log(`📝 Templates d'annonces: ${templates.length}`);
    console.log(`⚔️ Colonnes missions: ${missionColumns.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    process.exit(1);
  }
}

verifyDatabase();
