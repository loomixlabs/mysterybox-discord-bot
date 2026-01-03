require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function analyzeBlancheNeigeTraps() {
  console.log('🍎 ANALYSE DES PIÈGES DU THÈME BLANCHE-NEIGE\n');
  console.log('━'.repeat(80));

  try {
    const traps = await db.query(`
      SELECT name, type, description, shame_message,
             notif_title, notif_description, notif_color
      FROM traps
      WHERE guild_id = $1
      ORDER BY id
    `, [GUILD_ID]);

    console.log(`\nTotal: ${traps.length} pièges\n`);

    traps.forEach((trap, i) => {
      console.log(`\n[${ i + 1}] ${trap.name} (${trap.type})`);
      console.log(`   📝 Description: ${trap.description}`);
      console.log(`   🏷️  Notif Title: ${trap.notif_title}`);
      console.log(`   📢 Notif Desc: ${trap.notif_description.substring(0, 150)}...`);
      console.log(`   😱 Shame: ${trap.shame_message}`);
      console.log(`   🎨 Color: ${trap.notif_color}`);
    });

    console.log('\n' + '━'.repeat(80));
    console.log('\n✅ ANALYSE TERMINÉE\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

analyzeBlancheNeigeTraps();
