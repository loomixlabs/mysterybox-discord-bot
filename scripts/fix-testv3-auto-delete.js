/**
 * Fix: Activer auto_delete_celebration_message pour testv3
 */

const db = require('../utils/database-pg');

async function fix() {
  console.log('🔧 FIX: Activer auto_delete_celebration_message pour testv3');
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

    console.log(`\n📋 Thème: ${theme.name} (ID: ${theme.id})`);

    // 2. Mettre à jour auto_delete_celebration_message
    await db.query(`
      UPDATE theme_config
      SET auto_delete_celebration_message = true
      WHERE theme_id = $1
    `, [theme.id]);

    console.log('✅ auto_delete_celebration_message mis à true');

    // 3. Vérification
    const config = await db.queryOne(`
      SELECT auto_delete_celebration_message
      FROM theme_config
      WHERE theme_id = $1
    `, [theme.id]);

    console.log('\n' + '='.repeat(60));
    console.log(`📋 Vérification: auto_delete_celebration_message = ${config.auto_delete_celebration_message}`);

    if (config.auto_delete_celebration_message === true) {
      console.log('\n✅ FIX TERMINÉ - Redémarrez le bot pour appliquer!');
    } else {
      console.log('\n❌ Le fix n\'a pas fonctionné');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

fix();
