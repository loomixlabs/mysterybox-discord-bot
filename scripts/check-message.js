require('dotenv').config();
const db = require('../utils/database-pg');

const MESSAGE_ID = '1438655639265087528';
const GUILD_ID = '1248028543389143070';

async function checkMessage() {
  console.log(`🔍 Recherche du message ${MESSAGE_ID}...\n`);

  try {
    // Chercher dans give_logs
    const giveLog = await db.query(
      `SELECT * FROM give_logs WHERE message_id = $1`,
      [MESSAGE_ID]
    );

    if (giveLog.length > 0) {
      console.log('📦 Boîte mystère trouvée dans give_logs:');
      console.log(JSON.stringify(giveLog[0], null, 2));
      console.log('');

      // Récupérer les détails selon le type
      if (giveLog[0].give_type === 'collectible') {
        const collectible = await db.query(
          `SELECT * FROM collectibles WHERE guild_id = $1 AND id = $2`,
          [GUILD_ID, giveLog[0].item_id]
        );
        console.log('🎁 Collectible:');
        console.log(JSON.stringify(collectible[0], null, 2));
      } else if (giveLog[0].give_type === 'mission') {
        const mission = await db.query(
          `SELECT * FROM missions WHERE guild_id = $1 AND id = $2`,
          [GUILD_ID, giveLog[0].item_id]
        );
        console.log('🎯 Mission:');
        console.log(JSON.stringify(mission[0], null, 2));
      } else if (giveLog[0].give_type === 'trap') {
        const trap = await db.query(
          `SELECT * FROM traps WHERE guild_id = $1 AND id = $2`,
          [GUILD_ID, giveLog[0].item_id]
        );
        console.log('⚠️ Piège:');
        console.log(JSON.stringify(trap[0], null, 2));
      }
    } else {
      console.log('❌ Aucune boîte mystère trouvée avec ce message_id');
      console.log('');
      console.log('💡 Causes possibles:');
      console.log('  1. Le message a été créé mais pas enregistré en DB');
      console.log('  2. Le bot a planté avant l\'enregistrement');
      console.log('  3. Erreur lors de la création de la boîte');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await db.close();
  }
}

checkMessage();
