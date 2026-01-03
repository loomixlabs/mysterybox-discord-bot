require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function checkNewTrap() {
  console.log('🔍 VÉRIFICATION DU NOUVEAU PIÈGE\n');
  console.log('━'.repeat(80));

  try {
    // 1. Piège en DB
    const trap = await db.queryOne(`
      SELECT id, name, image_url, type, notif_title, notif_description, shame_message
      FROM traps
      WHERE guild_id = $1 AND type = $2
    `, [GUILD_ID, 'lose-all-collectibles']);

    console.log('\n📊 PIÈGE EN BASE DE DONNÉES:\n');
    console.log(`   ID: ${trap.id}`);
    console.log(`   Nom: ${trap.name}`);
    console.log(`   Type: ${trap.type}`);
    console.log(`   Image URL: ${trap.image_url}`);
    console.log(`   Notif Title: ${trap.notif_title}`);
    console.log(`   Notif Desc (100 chars): ${trap.notif_description.substring(0, 100)}...`);
    console.log(`   Shame Message: ${trap.shame_message}`);

    // 2. Template d'annonce
    console.log('\n━'.repeat(80));
    console.log('\n📊 TEMPLATE D\'ANNONCE:\n');

    const template = await db.queryOne(`
      SELECT *
      FROM announcement_templates
      WHERE guild_id = $1 AND type = $2
    `, [GUILD_ID, 'trap_lose_all_collectibles']);

    if (template) {
      console.log(`   ID: ${template.id}`);
      console.log(`   Type: ${template.type}`);
      console.log(`   Title: ${template.title}`);
      console.log(`   Description: ${template.description}`);
      console.log(`   Color: ${template.color}`);
      console.log(`   Image URL: ${template.image_url}`);
      console.log(`   Footer: ${template.footer_text}`);
      console.log(`   Enable Toggle: ${template.enable_toggle}`);
    } else {
      console.log('   ❌ Aucun template trouvé');
    }

    console.log('\n━'.repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

checkNewTrap();
