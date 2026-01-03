/**
 * Vérification auto_delete_celebration_message pour testv3
 */

const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 Vérification auto_delete_celebration_message pour testv3');
  console.log('='.repeat(60));

  try {
    // 1. Chercher le thème testv3
    const theme = await db.queryOne(`
      SELECT id, theme_id, name, guild_id FROM themes WHERE theme_id = 'testv3'
    `);

    if (!theme) {
      console.log('❌ Thème testv3 non trouvé');
      process.exit(1);
    }

    console.log(`\n📋 Thème: ${theme.name} (ID: ${theme.id}, Guild: ${theme.guild_id})`);

    // 2. Vérifier theme_config
    const config = await db.queryOne(`
      SELECT auto_delete_celebration_message, mystery_box_title, mystery_box_description
      FROM theme_config
      WHERE theme_id = $1
    `, [theme.id]);

    if (config) {
      console.log('\n📋 Configuration theme_config:');
      console.log(`   - auto_delete_celebration_message: ${config.auto_delete_celebration_message}`);
      console.log(`   - mystery_box_title: ${config.mystery_box_title}`);
      console.log(`   - mystery_box_description: ${config.mystery_box_description}`);

      console.log('\n' + '='.repeat(60));
      if (config.auto_delete_celebration_message === true) {
        console.log('✅ auto_delete_celebration_message est ACTIVÉ (true)');
      } else {
        console.log('❌ auto_delete_celebration_message est DÉSACTIVÉ (false ou null)');
      }
    } else {
      console.log('❌ Aucune configuration theme_config trouvée');
    }

    // 3. Vérifier aussi dans themes_library (Theme Builder DB)
    console.log('\n' + '='.repeat(60));
    console.log('📋 Vérification dans themes_library (Theme Builder):');

    const libraryTheme = await db.queryOne(`
      SELECT theme_id, name, theme_data->>'theme_config' as theme_config_json
      FROM themes_library
      WHERE theme_id = 'testv3'
    `);

    if (libraryTheme && libraryTheme.theme_config_json) {
      const configData = JSON.parse(libraryTheme.theme_config_json);
      console.log(`   - auto_delete_celebration_message: ${configData.auto_delete_celebration_message}`);
    } else {
      console.log('   ❌ Thème non trouvé dans themes_library ou pas de theme_config');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

check();
