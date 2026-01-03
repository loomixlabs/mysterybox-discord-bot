const db = require('../utils/database-pg');

/**
 * Script de vérification des collectibles récents après redémarrage du bot
 * Cherche tous les collectibles après 22:04 (heure du redémarrage)
 */

const GUILD_ID = process.env.GUILD_ID || '297309737135898624';

async function checkRecentCollectibles() {
  try {
    console.log('🔍 VÉRIFICATION - Collectibles après redémarrage du bot\n');
    console.log('='.repeat(80));

    // Récupérer les collectibles après 22:04 aujourd'hui
    const collectibles = await db.query(`
      SELECT
        c.id,
        c.collected_at,
        c.source,
        col.name,
        col.rarity,
        p.username
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      JOIN players p ON c.player_id = p.id
      WHERE c.guild_id = $1
      AND c.collected_at >= '2025-11-17 22:04:00'
      ORDER BY c.collected_at DESC
    `, [GUILD_ID]);

    console.log(`\n📊 TOTAL: ${collectibles.length} collectibles depuis 22:04\n`);
    console.log('='.repeat(80));

    if (collectibles.length === 0) {
      console.log('\n❌ Aucun collectible trouvé depuis le redémarrage');
      console.log('   → Soit les collectibles n\'ont pas été ajoutés');
      console.log('   → Soit il y a un problème avec le code\n');
      console.log('='.repeat(80));
      process.exit(0);
    }

    // Grouper par source
    const bySource = {
      mystery_box: [],
      mission: [],
      give: [],
      other: []
    };

    collectibles.forEach(c => {
      if (c.source === 'mystery_box') {
        bySource.mystery_box.push(c);
      } else if (c.source === 'mission') {
        bySource.mission.push(c);
      } else if (c.source === 'give') {
        bySource.give.push(c);
      } else {
        bySource.other.push(c);
      }
    });

    // Afficher par source
    console.log('\n📦 MYSTERY BOXES:');
    console.log(`   Total: ${bySource.mystery_box.length} collectibles\n`);
    if (bySource.mystery_box.length > 0) {
      bySource.mystery_box.forEach(c => {
        console.log(`   ✅ ${c.name} (${c.rarity}) - ${c.username} - ${new Date(c.collected_at).toLocaleString()}`);
      });
    } else {
      console.log('   ⚠️  Aucun collectible de mystery box trouvé');
    }

    console.log('\n\n📋 MISSIONS:');
    console.log(`   Total: ${bySource.mission.length} collectibles\n`);
    if (bySource.mission.length > 0) {
      bySource.mission.forEach(c => {
        console.log(`   ✅ ${c.name} (${c.rarity}) - ${c.username} - ${new Date(c.collected_at).toLocaleString()}`);
      });
    } else {
      console.log('   ⚠️  Aucun collectible de mission trouvé');
    }

    console.log('\n\n🎁 GIVES MANUELS:');
    console.log(`   Total: ${bySource.give.length} collectibles\n`);
    if (bySource.give.length > 0) {
      bySource.give.forEach(c => {
        console.log(`   • ${c.name} (${c.rarity}) - ${c.username} - ${new Date(c.collected_at).toLocaleString()}`);
      });
    }

    if (bySource.other.length > 0) {
      console.log('\n\n❓ AUTRES SOURCES:');
      console.log(`   Total: ${bySource.other.length} collectibles\n`);
      bySource.other.forEach(c => {
        console.log(`   • ${c.name} (${c.rarity}) - Source: "${c.source}" - ${c.username}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🎯 RÉSULTAT FINAL:\n');

    if (bySource.mystery_box.length > 0) {
      console.log(`✅ SUCCESS! Le fix fonctionne!`);
      console.log(`   ${bySource.mystery_box.length} collectible(s) de mystery box enregistré(s) correctement\n`);
    } else {
      console.log(`❌ Le fix ne fonctionne toujours pas`);
      console.log(`   Aucun collectible avec source="mystery_box" trouvé\n`);
    }

    console.log('='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkRecentCollectibles();
