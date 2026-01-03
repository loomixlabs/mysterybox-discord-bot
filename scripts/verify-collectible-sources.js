const db = require('../utils/database-pg');

/**
 * Script de vérification des sources de collectibles
 * Affiche les 50 derniers collectibles par source
 */

const GUILD_ID = process.env.GUILD_ID || '297309737135898624';

async function verifyCollectibleSources() {
  try {
    console.log('🔍 VÉRIFICATION - Sources des collectibles\n');
    console.log('='.repeat(80));

    // Récupérer tous les collectibles récents avec détails
    const collectibles = await db.query(`
      SELECT
        c.id,
        c.collected_at,
        c.source,
        col.name,
        col.rarity,
        p.username,
        p.discord_id
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      JOIN players p ON c.player_id = p.id
      WHERE c.guild_id = $1
      ORDER BY c.collected_at DESC
      LIMIT 50
    `, [GUILD_ID]);

    console.log(`\n📊 TOTAL: ${collectibles.length} collectibles récents\n`);
    console.log('='.repeat(80));

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
      bySource.mystery_box.slice(0, 10).forEach(c => {
        console.log(`   • ${c.name} (${c.rarity}) - ${c.username} - ${new Date(c.collected_at).toLocaleString()}`);
      });
      if (bySource.mystery_box.length > 10) {
        console.log(`   ... et ${bySource.mystery_box.length - 10} autres`);
      }
    } else {
      console.log('   ⚠️  Aucun collectible de mystery box trouvé');
    }

    console.log('\n\n📋 MISSIONS:');
    console.log(`   Total: ${bySource.mission.length} collectibles\n`);
    if (bySource.mission.length > 0) {
      bySource.mission.slice(0, 10).forEach(c => {
        console.log(`   • ${c.name} (${c.rarity}) - ${c.username} - ${new Date(c.collected_at).toLocaleString()}`);
      });
      if (bySource.mission.length > 10) {
        console.log(`   ... et ${bySource.mission.length - 10} autres`);
      }
    } else {
      console.log('   ⚠️  Aucun collectible de mission trouvé');
    }

    console.log('\n\n🎁 GIVES MANUELS:');
    console.log(`   Total: ${bySource.give.length} collectibles\n`);
    if (bySource.give.length > 0) {
      bySource.give.slice(0, 10).forEach(c => {
        console.log(`   • ${c.name} (${c.rarity}) - ${c.username} - ${new Date(c.collected_at).toLocaleString()}`);
      });
      if (bySource.give.length > 10) {
        console.log(`   ... et ${bySource.give.length - 10} autres`);
      }
    } else {
      console.log('   ℹ️  Aucun collectible de give manuel trouvé');
    }

    if (bySource.other.length > 0) {
      console.log('\n\n❓ AUTRES SOURCES:');
      console.log(`   Total: ${bySource.other.length} collectibles\n`);
      bySource.other.slice(0, 10).forEach(c => {
        console.log(`   • ${c.name} (${c.rarity}) - Source: "${c.source}" - ${c.username}`);
      });
    }

    console.log('\n' + '='.repeat(80));

    // Vérifier le fix
    console.log('\n🔬 ANALYSE DU FIX:\n');

    if (bySource.mystery_box.length > 0) {
      console.log('✅ Des collectibles de mystery box sont enregistrés correctement');
      console.log(`   → ${bySource.mystery_box.length} collectibles avec source="mystery_box"`);
    } else {
      console.log('❌ Aucun collectible de mystery box trouvé');
      console.log('   → Soit aucune boîte n\'a été ouverte depuis le fix');
      console.log('   → Soit le fix ne fonctionne pas encore (bot pas redémarré ?)');
    }

    if (bySource.mission.length > 0) {
      console.log('\n✅ Des collectibles de mission sont enregistrés correctement');
      console.log(`   → ${bySource.mission.length} collectibles avec source="mission"`);
    } else {
      console.log('\n⚠️  Aucun collectible de mission trouvé');
      console.log('   → Soit aucune mission n\'a été complétée depuis le fix');
      console.log('   → Soit le fix ne fonctionne pas encore (bot pas redémarré ?)');
    }

    console.log('\n💡 PROCHAINES ÉTAPES:');
    console.log('   1. Redémarre le bot: node index.js');
    console.log('   2. Ouvre quelques mystery boxes');
    console.log('   3. Complete une mission');
    console.log('   4. Re-lance ce script pour vérifier\n');

    console.log('='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifyCollectibleSources();
