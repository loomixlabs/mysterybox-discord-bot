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
  console.log('🏆 SEED: Badges Trap & Survie\n');
  console.log('═'.repeat(100));

  try {
    // Badges Trap & Survie - Survivre aux pièges
    const badges = [
      {
        code: 'TRAP_SURVIVOR',
        name: 'Survivant',
        description: 'Premier piège survécu - La chance du débutant',
        emoji: '⚠️✨',
        color: '#2ecc71', // Uncommon
        rarity: 'uncommon',
        category: 'trap',
        condition_type: 'trap_survive',
        condition_target: null,
        condition_value: 1,
        display_order: 1
      },
      {
        code: 'TRAP_RESILIENT',
        name: 'Résilient',
        description: 'Résiste face au danger',
        emoji: '⚠️💪',
        color: '#3498db', // Rare
        rarity: 'rare',
        category: 'trap',
        condition_type: 'trap_survive',
        condition_target: null,
        condition_value: 10,
        display_order: 2
      },
      {
        code: 'TRAP_VETERAN',
        name: 'Vétéran du Danger',
        description: 'Expert en survie face aux pièges',
        emoji: '⚠️🛡️',
        color: '#9b59b6', // Epic
        rarity: 'epic',
        category: 'trap',
        condition_type: 'trap_survive',
        condition_target: null,
        condition_value: 50,
        display_order: 3
      },
      {
        code: 'TRAP_MASTER',
        name: 'Maître de la Survie',
        description: 'Rien ne peut t\'arrêter',
        emoji: '⚠️👑',
        color: '#9b59b6', // Epic
        rarity: 'epic',
        category: 'trap',
        condition_type: 'trap_survive',
        condition_target: null,
        condition_value: 100,
        display_order: 4
      },
      {
        code: 'TRAP_IMMORTAL',
        name: 'Immortel',
        description: 'Légende vivante - 250 pièges surmontés',
        emoji: '⚠️⚡👑',
        color: '#f39c12', // Legendary
        rarity: 'legendary',
        category: 'trap',
        condition_type: 'trap_survive',
        condition_target: null,
        condition_value: 250,
        display_order: 5
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
      WHERE category = 'trap'
      ORDER BY display_order ASC
    `);

    console.log(`✅ ${badgeResults.rows.length} badges Trap & Survie en base de données:\n`);

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
    console.log('✅ SEED TRAP & SURVIE BADGES TERMINÉ\n');

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
