require('dotenv').config();
const db = require('../utils/database-pg');

async function checkAnnouncementStructure() {
  console.log('🔍 STRUCTURE announcement_templates\n');

  try {
    const structure = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_templates'
      ORDER BY ordinal_position
    `);

    console.log('Colonnes:\n');
    structure.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Voir un exemple de template
    console.log('\n━'.repeat(80));
    console.log('\nExemple de template:\n');

    const example = await db.queryOne(`
      SELECT * FROM announcement_templates
      WHERE guild_id = '1248028543389143070'
      LIMIT 1
    `);

    if (example) {
      Object.keys(example).forEach(key => {
        console.log(`  ${key}: ${example[key]}`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await db.close();
  }
}

checkAnnouncementStructure();
