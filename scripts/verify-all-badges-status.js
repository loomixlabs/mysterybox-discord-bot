const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

/**
 * Script de vérification complète du système de badges
 * - Compte total de badges par catégorie
 * - Vérifie l'intégrité des données
 * - Affiche un résumé complet
 */

async function verifyBadgeSystem() {
  console.log('\n🏆 VÉRIFICATION SYSTÈME DE BADGES - ÉTAT COMPLET\n');
  console.log('═'.repeat(100));

  try {
    // 1. Total badges
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM badges');
    const totalBadges = parseInt(totalResult.rows[0].count);

    console.log('\n📊 STATISTIQUES GLOBALES:\n');
    console.log(`   Total badges en base: ${totalBadges}`);

    // 2. Breakdown par catégorie
    const categoryResult = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM badges
      GROUP BY category
      ORDER BY category
    `);

    console.log('\n📋 BADGES PAR CATÉGORIE:\n');
    categoryResult.rows.forEach(row => {
      console.log(`   ${row.category.padEnd(20)} : ${row.count} badge(s)`);
    });

    // 3. Breakdown par rareté
    const rarityResult = await pool.query(`
      SELECT rarity, COUNT(*) as count
      FROM badges
      GROUP BY rarity
      ORDER BY
        CASE rarity
          WHEN 'mythic' THEN 1
          WHEN 'legendary' THEN 2
          WHEN 'epic' THEN 3
          WHEN 'rare' THEN 4
          WHEN 'uncommon' THEN 5
          WHEN 'common' THEN 6
        END
    `);

    console.log('\n🎨 BADGES PAR RARETÉ:\n');
    rarityResult.rows.forEach(row => {
      const emoji = {
        mythic: '👑',
        legendary: '🌟',
        epic: '💎',
        rare: '💙',
        uncommon: '💚',
        common: '⚪'
      }[row.rarity] || '❓';
      console.log(`   ${emoji} ${row.rarity.toUpperCase().padEnd(15)} : ${row.count} badge(s)`);
    });

    // 4. Badges par condition_type
    const conditionResult = await pool.query(`
      SELECT condition_type, COUNT(*) as count
      FROM badges
      GROUP BY condition_type
      ORDER BY condition_type
    `);

    console.log('\n🎯 BADGES PAR TYPE DE CONDITION:\n');
    conditionResult.rows.forEach(row => {
      console.log(`   ${row.condition_type.padEnd(25)} : ${row.count} badge(s)`);
    });

    // 5. Vérifications d'intégrité
    console.log('\n🔍 VÉRIFICATIONS D\'INTÉGRITÉ:\n');

    // Vérifier que tous les badges ont un emoji
    const noEmojiResult = await pool.query(`
      SELECT COUNT(*) as count FROM badges WHERE emoji IS NULL OR emoji = ''
    `);
    const noEmoji = parseInt(noEmojiResult.rows[0].count);
    console.log(`   ${noEmoji === 0 ? '✅' : '❌'} Badges sans emoji: ${noEmoji}`);

    // Vérifier que tous les badges ont une couleur
    const noColorResult = await pool.query(`
      SELECT COUNT(*) as count FROM badges WHERE color IS NULL OR color = ''
    `);
    const noColor = parseInt(noColorResult.rows[0].count);
    console.log(`   ${noColor === 0 ? '✅' : '❌'} Badges sans couleur: ${noColor}`);

    // Vérifier doublons de code
    const duplicateResult = await pool.query(`
      SELECT code, COUNT(*) as count
      FROM badges
      GROUP BY code
      HAVING COUNT(*) > 1
    `);
    console.log(`   ${duplicateResult.rows.length === 0 ? '✅' : '❌'} Codes dupliqués: ${duplicateResult.rows.length}`);

    // 6. Détails par catégorie
    console.log('\n📖 DÉTAILS PAR CATÉGORIE:\n');
    console.log('─'.repeat(100));

    const categories = ['super_bonus', 'collection', 'mission', 'mystery_box', 'trap', 'engagement'];

    for (const category of categories) {
      const badges = await pool.query(`
        SELECT code, name, rarity, condition_type, condition_value
        FROM badges
        WHERE category = $1
        ORDER BY display_order, condition_value
      `, [category]);

      if (badges.rows.length > 0) {
        console.log(`\n🔹 ${category.toUpperCase()} (${badges.rows.length} badges):`);
        badges.rows.forEach(badge => {
          const rarityEmoji = {
            mythic: '👑',
            legendary: '🌟',
            epic: '💎',
            rare: '💙',
            uncommon: '💚',
            common: '⚪'
          }[badge.rarity] || '❓';
          console.log(`   ${rarityEmoji} ${badge.name.padEnd(30)} | ${badge.rarity.padEnd(10)} | ${badge.condition_type} (${badge.condition_value})`);
        });
      }
    }

    // 7. Résumé attendu vs réel
    console.log('\n' + '═'.repeat(100));
    console.log('\n✅ RÉSUMÉ FINAL:\n');

    const expected = {
      super_bonus: 13,
      collection: 6,
      mission: 4,
      mystery_box: 4,
      trap: 5,
      engagement: 5
    };

    const total_expected = Object.values(expected).reduce((a, b) => a + b, 0);

    console.log(`   Badges attendus: ${total_expected}`);
    console.log(`   Badges en base:  ${totalBadges}`);
    console.log(`   Status: ${totalBadges === total_expected ? '✅ COMPLET' : '❌ INCOMPLET'}\n`);

    if (totalBadges === total_expected) {
      console.log('🎉 SYSTÈME DE BADGES 100% OPÉRATIONNEL !\n');
    } else {
      console.log('⚠️  Certains badges manquent ou sont en trop.\n');

      // Afficher les différences
      for (const [cat, expectedCount] of Object.entries(expected)) {
        const actualResult = await pool.query(
          'SELECT COUNT(*) as count FROM badges WHERE category = $1',
          [cat]
        );
        const actualCount = parseInt(actualResult.rows[0].count);

        if (actualCount !== expectedCount) {
          console.log(`   ❌ ${cat}: attendu ${expectedCount}, trouvé ${actualCount}`);
        }
      }
    }

    console.log('═'.repeat(100));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyBadgeSystem();
