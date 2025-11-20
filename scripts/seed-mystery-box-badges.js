const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

async function createBadge(badgeData) {
  const {
    code, name, description, emoji, color, rarity, category,
    condition_type, condition_target, condition_value,
    display_order = 0, is_secret = false
  } = badgeData;

  const result = await pool.query(`
    INSERT INTO badges (
      code, name, description, emoji, color, rarity, category,
      condition_type, condition_target, condition_value,
      display_order, is_secret
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      emoji = EXCLUDED.emoji
    RETURNING *
  `, [
    code, name, description, emoji, color, rarity, category,
    condition_type, condition_target, condition_value,
    display_order, is_secret
  ]);

  return result.rows[0];
}

async function seedBadges() {
  console.log('🏆 SEED: Badges Mystery Box\n');
  console.log('═'.repeat(100));

  try {
    // Badges Mystery Box - Ouverture de coffres mystère
    const badges = [
      {
        code: 'MYSTERY_CHANCEUX',
        name: 'Chanceux',
        description: 'Le hasard te sourit - 10 mystery boxes ouvertes',
        emoji: '🎁✨',
        color: '#3498db', // Rare
        rarity: 'rare',
        category: 'mystery_box',
        condition_type: 'mystery_box_open',
        condition_target: null,
        condition_value: 10,
        display_order: 1
      },
      {
        code: 'MYSTERY_CHASSEUR',
        name: 'Chasseur de Trésors',
        description: 'Explorateur passionné des mystères',
        emoji: '🎁🗝️',
        color: '#9b59b6', // Epic
        rarity: 'epic',
        category: 'mystery_box',
        condition_type: 'mystery_box_open',
        condition_target: null,
        condition_value: 50,
        display_order: 2
      },
      {
        code: 'MYSTERY_MAITRE',
        name: 'Maître des Mystères',
        description: 'Expert en déverrouillage de secrets',
        emoji: '🎁🔮',
        color: '#9b59b6', // Epic
        rarity: 'epic',
        category: 'mystery_box',
        condition_type: 'mystery_box_open',
        condition_target: null,
        condition_value: 100,
        display_order: 3
      },
      {
        code: 'MYSTERY_LEGENDE',
        name: 'Légende des Coffres',
        description: 'Respect absolu - 250 coffres mystère ouverts',
        emoji: '🎁👑',
        color: '#f39c12', // Legendary
        rarity: 'legendary',
        category: 'mystery_box',
        condition_type: 'mystery_box_open',
        condition_target: null,
        condition_value: 250,
        display_order: 4
      }
    ];

    let created = 0;
    let updated = 0;

    for (const badge of badges) {
      try {
        const result = await createBadge(badge);

        if (result) {
          created++;
          console.log(`   ✅ ${badge.emoji} ${badge.name} (${badge.rarity})`);
        }
      } catch (error) {
        console.error(`   🔴 ERREUR ${badge.name}:`, error.message);
        updated++;
      }
    }

    const result = { created, updated, total: badges.length };

    console.log('\n' + '═'.repeat(100));
    console.log('✅ SEEDING TERMINÉ\n');
    console.log('📊 Résumé:');
    console.log(`   • Badges créés: ${result.created}`);
    console.log(`   • Badges mis à jour: ${result.updated}`);
    console.log(`   • Total: ${result.total}\n`);

    // Vérifier les badges créés
    console.log('🔍 Vérification des badges créés:\n');
    console.log('─'.repeat(100));

    const badgeResults = await pool.query(`
      SELECT * FROM badges
      WHERE category = 'mystery_box'
      ORDER BY display_order ASC
    `);

    console.log(`✅ ${badgeResults.rows.length} badges Mystery Box en base de données:\n`);

    // Grouper par rareté
    const byRarity = {
      legendary: [],
      epic: [],
      rare: [],
      uncommon: [],
      common: []
    };

    badgeResults.rows.forEach(badge => {
      if (byRarity[badge.rarity]) {
        byRarity[badge.rarity].push(badge);
      }
    });

    // Afficher par rareté
    for (const [rarity, badgeList] of Object.entries(byRarity)) {
      if (badgeList.length > 0) {
        console.log(`\n🔹 ${rarity.toUpperCase()} (${badgeList.length}):`);
        badgeList.forEach(badge => {
          console.log(`   ${badge.emoji} ${badge.name} - ${badge.description}`);
          console.log(`      Condition: ${badge.condition_type} (${badge.condition_target || 'N/A'}) = ${badge.condition_value}`);
        });
      }
    }

    console.log('\n' + '═'.repeat(100));
    console.log('✅ SEED MYSTERY BOX BADGES TERMINÉ\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors du seeding:', error.message);
    console.error('\n📋 Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedBadges();
