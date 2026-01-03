require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function analyzeAnnouncementSystem() {
  console.log('🔍 ANALYSE COMPLÈTE DU SYSTÈME D\'ANNONCES\n');
  console.log('━'.repeat(100));

  try {
    // 1. Structure announcement_settings
    console.log('\n📊 1. STRUCTURE DE announcement_settings\n');

    const settingsStructure = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      ORDER BY ordinal_position
    `);

    settingsStructure.forEach(col => {
      console.log(`   ${col.column_name.padEnd(35)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // 2. Valeurs actuelles
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 2. VALEURS ACTUELLES POUR CE SERVEUR\n');

    const currentSettings = await db.query(`
      SELECT *
      FROM announcement_settings
      WHERE guild_id = $1
    `, [GUILD_ID]);

    if (currentSettings.length > 0) {
      const settings = currentSettings[0];
      Object.keys(settings).forEach(key => {
        if (key.startsWith('trap_')) {
          console.log(`   ${key.padEnd(35)} = ${settings[key]}`);
        }
      });
    }

    // 3. Templates d'annonces pour les pièges
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 3. TEMPLATES D\'ANNONCES POUR LES PIÈGES\n');

    const trapTemplates = await db.query(`
      SELECT type, title
      FROM announcement_templates
      WHERE guild_id = $1 AND type LIKE 'trap_%'
      ORDER BY type
    `, [GUILD_ID]);

    console.log(`   ${trapTemplates.length} template(s) de pièges:\n`);
    trapTemplates.forEach(t => {
      console.log(`   ${t.type.padEnd(35)} ${t.title}`);
    });

    // 4. Vérifier dans le code quelle méthode récupère les settings
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 4. MÉTHODES DANS database-pg.js\n');

    console.log('   À vérifier manuellement dans database-pg.js:');
    console.log('   - getAnnouncementSettings()');
    console.log('   - setAnnouncementSetting()');
    console.log('   - toggleAnnouncementSetting()');

    console.log('\n' + '━'.repeat(100));
    console.log('\n✅ ANALYSE TERMINÉE\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

analyzeAnnouncementSystem();
