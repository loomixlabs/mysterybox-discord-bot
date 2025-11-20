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
  console.log('🏆 SEED: Badges Super Bonus\n');
  console.log('═'.repeat(100));

  try {
    // Seed les badges Super Bonus
    const badges = [
      // Vision Divine - Tier 1 à 3
      {
        code: 'VOYANT_DIVIN_APPRENTI',
        name: 'Voyant Divin',
        description: 'As-tu vu l\'avenir ?',
        emoji: '👁️✨',
        color: '#9b59b6',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'vision_divine',
        condition_value: 10,
        display_order: 1
      },
      {
        code: 'VOYANT_DIVIN_EXPERT',
        name: 'Expert Vision',
        description: 'Tu commences à maîtriser la voyance',
        emoji: '👁️🔮',
        color: '#9b59b6',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'vision_divine',
        condition_value: 50,
        display_order: 2
      },
      {
        code: 'VOYANT_DIVIN_MAITRE',
        name: 'Maître Vision',
        description: 'Tu vois TOUT',
        emoji: '👁️👑',
        color: '#9b59b6',
        rarity: 'legendary',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'vision_divine',
        condition_value: 100,
        display_order: 3
      },

      // Bouclier Anti-Piège - Tier 1 à 3
      {
        code: 'BOUCLIER_NOVICE',
        name: 'Gardien Novice',
        description: 'Premier piège bloqué !',
        emoji: '🛡️✨',
        color: '#3498db',
        rarity: 'rare',
        category: 'super_bonus',
        condition_type: 'trap_block',
        condition_target: null,
        condition_value: 1,
        display_order: 10
      },
      {
        code: 'BOUCLIER_EXPERT',
        name: 'Défenseur Aguerri',
        description: 'Les pièges ne te font plus peur',
        emoji: '🛡️⚡',
        color: '#3498db',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'trap_block',
        condition_target: null,
        condition_value: 25,
        display_order: 11
      },
      {
        code: 'BOUCLIER_LEGENDE',
        name: 'Indestructible',
        description: 'Rien ne peut t\'arrêter',
        emoji: '🛡️👑',
        color: '#3498db',
        rarity: 'legendary',
        category: 'super_bonus',
        condition_type: 'trap_block',
        condition_target: null,
        condition_value: 50,
        display_order: 12
      },

      // Jackpot x2 - Tier 1 à 3
      {
        code: 'JACKPOT_CHANCEUX',
        name: 'Coup de Chance',
        description: 'Ton premier jackpot !',
        emoji: '💰✨',
        color: '#f1c40f',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'jackpot_x2',
        condition_value: 10,
        display_order: 20
      },
      {
        code: 'JACKPOT_FORTUNE',
        name: 'Machine à Gains',
        description: 'Tu attires l\'or !',
        emoji: '💰🎰',
        color: '#f1c40f',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'jackpot_x2',
        condition_value: 30,
        display_order: 21
      },
      {
        code: 'JACKPOT_ROI',
        name: 'Roi du Jackpot',
        description: 'Tu transformes tout en or',
        emoji: '💰👑',
        color: '#f1c40f',
        rarity: 'legendary',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'jackpot_x2',
        condition_value: 50,
        display_order: 22
      },

      // Aimant à Légendaires - Tier 1 à 3
      {
        code: 'AIMANT_DEBUTANT',
        name: 'Attraction Magique',
        description: 'Les légendaires t\'aiment bien',
        emoji: '🧲✨',
        color: '#e74c3c',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'legendary_magnet',
        condition_value: 5,
        display_order: 30
      },
      {
        code: 'AIMANT_COLLECTIONNEUR',
        name: 'Collectionneur Légendaire',
        description: 'Tu es une véritable attraction',
        emoji: '🧲💎',
        color: '#e74c3c',
        rarity: 'legendary',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'legendary_magnet',
        condition_value: 15,
        display_order: 31
      },
      {
        code: 'AIMANT_MAITRE',
        name: 'Maître de l\'Aimant',
        description: 'Tous les légendaires te trouvent',
        emoji: '🧲👑',
        color: '#e74c3c',
        rarity: 'mythic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'legendary_magnet',
        condition_value: 30,
        display_order: 32
      },

      // Badge spécial: Collectionneur
      {
        code: 'SUPER_BONUS_COLLECTIONNEUR',
        name: 'Collectionneur de Super Bonus',
        description: 'Tu as utilisé tous les types de Super Bonus !',
        emoji: '🌟🏆',
        color: '#9b59b6',
        rarity: 'legendary',
        category: 'super_bonus',
        condition_type: 'custom',
        condition_target: 'all_super_bonus_types',
        condition_value: 11,
        display_order: 100
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
        updated++;
        console.log(`   ⏭️  ${badge.emoji} ${badge.name} déjà existant`);
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
      WHERE category = 'super_bonus'
      ORDER BY display_order ASC, rarity DESC
    `);

    console.log(`✅ ${badgeResults.rows.length} badges Super Bonus en base de données:\n`);

    // Grouper par rareté
    const byRarity = {
      mythic: [],
      legendary: [],
      epic: [],
      rare: []
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
    console.log('✅ SEED SUPER BONUS BADGES TERMINÉ\n');

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
