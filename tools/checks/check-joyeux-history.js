const db = require('./utils/database-pg');
require('dotenv').config();

async function checkHistory() {
  try {
    const playerId = 109;
    const guildId = '1248028543389143070';
    const collectibleId = 49; // Joyeux

    console.log('🔍 Historique complet du collectible "Joyeux" pour player 109...\n');

    // Récupérer TOUTES les entrées pour ce collectible (même s'il y en a plusieurs)
    const history = await db.queryAll(`
      SELECT
        c.id as collection_id,
        c.player_id,
        c.collectible_id,
        col.name as collectible_name,
        c.collected_at,
        c.lost_at,
        c.source,
        EXTRACT(EPOCH FROM (c.lost_at - c.collected_at)) as seconds_possessed
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1
        AND c.guild_id = $2
        AND c.collectible_id = $3
      ORDER BY c.collected_at
    `, [playerId, guildId, collectibleId]);

    console.log(`📊 Nombre d'entrées trouvées: ${history.length}\n`);

    if (history.length === 0) {
      console.log('❌ PROBLÈME MAJEUR: Aucune entrée trouvée pour ce collectible!');
      console.log('   Cela signifie que le joueur n\'a JAMAIS collecté "Joyeux"');
      console.log('   mais le système l\'a quand même marqué comme perdu!');
    } else {
      history.forEach((entry, i) => {
        console.log(`\n📦 Entrée ${i + 1}:`);
        console.log(`   Collection ID: ${entry.collection_id}`);
        console.log(`   Collectible: ${entry.collectible_name} (ID: ${entry.collectible_id})`);
        console.log(`   Source: ${entry.source}`);
        console.log(`   Collecté le: ${entry.collected_at}`);

        if (entry.lost_at) {
          console.log(`   ❌ Perdu le: ${entry.lost_at}`);
          if (entry.seconds_possessed !== null) {
            const minutes = Math.floor(entry.seconds_possessed / 60);
            const seconds = Math.floor(entry.seconds_possessed % 60);
            console.log(`   ⏱️ Possédé pendant: ${minutes}m ${seconds}s`);
          }
        } else {
          console.log(`   ✅ Toujours possédé`);
        }
      });
    }

    // Vérifier s'il existe une entrée où lost_at est rempli SANS collected_at
    const orphanLosses = history.filter(h => h.lost_at && !h.collected_at);
    if (orphanLosses.length > 0) {
      console.log('\n\n⚠️ ANOMALIE DÉTECTÉE:');
      console.log(`   ${orphanLosses.length} entrée(s) avec lost_at mais SANS collected_at!`);
    }

    // Vérifier l'ordre temporel
    console.log('\n\n🔍 ANALYSE TEMPORELLE:');
    history.forEach((entry, i) => {
      const collectedTime = new Date(entry.collected_at).getTime();
      const lostTime = entry.lost_at ? new Date(entry.lost_at).getTime() : null;

      if (lostTime && lostTime < collectedTime) {
        console.log(`   ❌ ERREUR: L'entrée ${i + 1} a un lost_at AVANT collected_at!`);
      } else if (entry.lost_at) {
        console.log(`   ✅ Entrée ${i + 1}: Ordre temporel correct`);
      } else {
        console.log(`   ✅ Entrée ${i + 1}: Toujours possédé`);
      }
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkHistory();
