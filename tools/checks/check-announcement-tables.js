const db = require('./utils/database-pg');
require('dotenv').config();

async function checkAnnouncementTables() {
  try {
    const guildId = '1248028543389143070';

    console.log('🔍 Vérification des tables d\'annonces...\n');

    // 1. Vérifier announcement_templates
    console.log('1️⃣ Structure de announcement_templates:');
    const templateColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'announcement_templates'
      ORDER BY ordinal_position
    `);

    if (templateColumns.length === 0) {
      console.log('   ⚠️ Table announcement_templates n\'existe pas');
    } else {
      templateColumns.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });

      // Exemples de templates
      const templates = await db.queryAll(`
        SELECT * FROM announcement_templates
        WHERE guild_id = $1
        LIMIT 3
      `, [guildId]);

      console.log(`\n   📊 Nombre de templates: ${templates.length}`);
      if (templates.length > 0) {
        console.log(`   Exemple: ${JSON.stringify(templates[0], null, 2)}`);
      }
    }

    // 2. Vérifier announcement_settings
    console.log('\n2️⃣ Structure de announcement_settings:');
    const settingsColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      ORDER BY ordinal_position
    `);

    if (settingsColumns.length === 0) {
      console.log('   ⚠️ Table announcement_settings n\'existe pas');
    } else {
      settingsColumns.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });

      // Settings actuels
      const settings = await db.queryOne(`
        SELECT * FROM announcement_settings
        WHERE guild_id = $1
      `, [guildId]);

      if (settings) {
        console.log(`\n   📊 Settings actuels:`);
        Object.keys(settings).forEach(key => {
          console.log(`   - ${key}: ${settings[key]}`);
        });
      } else {
        console.log(`\n   ⚠️ Aucun settings pour ce serveur`);
      }
    }

    // 3. Vérifier les autres tables liées
    console.log('\n3️⃣ Autres tables d\'annonces:');
    const allTables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE '%announce%'
      ORDER BY table_name
    `);

    allTables.forEach(t => {
      console.log(`   - ${t.table_name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkAnnouncementTables();
