/**
 * Script de seeding complet pour les badges V2
 * Ajoute tous les nouveaux badges avec leurs catégories
 *
 * Usage: node scripts/seed-badges-v2-complete.js
 */

require('dotenv').config();
const db = require('../utils/database-pg');

// Couleurs par rareté
const RARITY_COLORS = {
  common: '#95A5A6',
  uncommon: '#2ECC71',
  rare: '#3498DB',
  epic: '#9B59B6',
  legendary: '#F39C12',
  mythic: '#E74C3C'
};

const BADGES_V2 = [
  // ========== RARITY BADGES ==========
  {
    code: 'RARITY_LEGENDARY_HUNTER',
    name: 'Chasseur de Légendaires',
    description: 'Collecte 10 objets légendaires',
    emoji: '🟠🏹',
    rarity: 'epic',
    category: 'rarity',
    condition_type: 'legendary_count',
    condition_value: 10
  },
  {
    code: 'RARITY_LEGENDARY_MASTER',
    name: 'Maître des Légendaires',
    description: 'Collecte 50 objets légendaires',
    emoji: '🟠👑',
    rarity: 'legendary',
    category: 'rarity',
    condition_type: 'legendary_count',
    condition_value: 50
  },
  {
    code: 'RARITY_EPIC_MASTER',
    name: 'Maître Épique',
    description: 'Collecte 25 objets épiques',
    emoji: '🟣👑',
    rarity: 'epic',
    category: 'rarity',
    condition_type: 'epic_count',
    condition_value: 25
  },
  {
    code: 'RARITY_RARE_BARON',
    name: 'Baron des Rares',
    description: 'Collecte 50 objets rares',
    emoji: '🔵🎩',
    rarity: 'rare',
    category: 'rarity',
    condition_type: 'rare_count',
    condition_value: 50
  },

  // ========== EVOLUTION BADGES ==========
  {
    code: 'EVOLUTION_LEVEL_2',
    name: 'Évolution Niveau 2',
    description: 'Atteins le niveau 2 sur un collectible',
    emoji: '⬆️2️⃣',
    rarity: 'common',
    category: 'evolution',
    condition_type: 'evolution_level',
    condition_value: 2
  },
  {
    code: 'EVOLUTION_LEVEL_3',
    name: 'Évolution Niveau 3',
    description: 'Atteins le niveau 3 sur un collectible',
    emoji: '⬆️3️⃣',
    rarity: 'rare',
    category: 'evolution',
    condition_type: 'evolution_level',
    condition_value: 3
  },
  {
    code: 'EVOLUTION_LEVEL_4',
    name: 'Évolution Maximum',
    description: 'Atteins le niveau 4 (max) sur un collectible',
    emoji: '⬆️4️⃣',
    rarity: 'epic',
    category: 'evolution',
    condition_type: 'evolution_level',
    condition_value: 4
  },
  {
    code: 'EVOLUTION_MASTER',
    name: 'Maître Évolution',
    description: 'Possède 10 collectibles au niveau maximum',
    emoji: '📈👑',
    rarity: 'legendary',
    category: 'evolution',
    condition_type: 'max_level_count',
    condition_value: 10
  },

  // ========== MYSTERY BOX RARITY BADGES ==========
  {
    code: 'BOX_EPIC_COLLECTOR',
    name: 'Collectionneur Épique',
    description: 'Ouvre 10 mystery boxes épiques',
    emoji: '🟣📦',
    rarity: 'epic',
    category: 'mystery_box',
    condition_type: 'epic_box_open',
    condition_value: 10
  },
  {
    code: 'BOX_LEGENDARY_COLLECTOR',
    name: 'Collectionneur Légendaire',
    description: 'Ouvre 5 mystery boxes légendaires',
    emoji: '🟠📦',
    rarity: 'legendary',
    category: 'mystery_box',
    condition_type: 'legendary_box_open',
    condition_value: 5
  },
  {
    code: 'BOX_FULL_SET',
    name: 'Toutes Raretés',
    description: 'Ouvre au moins une box de chaque rareté',
    emoji: '🌈📦',
    rarity: 'rare',
    category: 'mystery_box',
    condition_type: 'all_rarities_opened',
    condition_value: 4
  },

  // ========== TRAP TRIGGERED BADGES ==========
  {
    code: 'TRAP_TRIGGERED_10',
    name: 'Malchanceux',
    description: 'Déclenche 10 pièges',
    emoji: '💀🔟',
    rarity: 'common',
    category: 'trap',
    condition_type: 'trap_triggered',
    condition_value: 10
  },
  {
    code: 'TRAP_TRIGGERED_50',
    name: 'Aimant à Pièges',
    description: 'Déclenche 50 pièges',
    emoji: '💀5️⃣0️⃣',
    rarity: 'rare',
    category: 'trap',
    condition_type: 'trap_triggered',
    condition_value: 50
  },
  {
    code: 'TRAP_INFERNAL_SURVIVOR',
    name: 'Survivant Infernal',
    description: 'Survit à un piège "Perte Totale"',
    emoji: '🔥💀',
    rarity: 'epic',
    category: 'trap',
    condition_type: 'survive_lose_all',
    condition_value: 1
  },

  // ========== ECONOMY BADGES ==========
  {
    code: 'ECONOMY_SPENDER',
    name: 'Grand Dépensier',
    description: 'Dépense 1000 Loomix au total',
    emoji: '💸',
    rarity: 'common',
    category: 'economy',
    condition_type: 'loomix_spent',
    condition_value: 1000
  },
  {
    code: 'ECONOMY_MILLIONAIRE',
    name: 'Millionnaire',
    description: 'Gagne 10 000 Loomix au total',
    emoji: '💰🎩',
    rarity: 'rare',
    category: 'economy',
    condition_type: 'loomix_earned',
    condition_value: 10000
  },
  {
    code: 'ECONOMY_BILLIONAIRE',
    name: 'Milliardaire',
    description: 'Gagne 100 000 Loomix au total',
    emoji: '💰👑',
    rarity: 'legendary',
    category: 'economy',
    condition_type: 'loomix_earned',
    condition_value: 100000
  },
  {
    code: 'ECONOMY_SAVER',
    name: 'Épargnant',
    description: 'Possède 5000 Loomix en même temps',
    emoji: '🏦',
    rarity: 'rare',
    category: 'economy',
    condition_type: 'loomix_balance',
    condition_value: 5000
  },

  // ========== SENIORITY BADGES ==========
  {
    code: 'SENIORITY_WEEK',
    name: 'Une Semaine',
    description: 'Membre depuis 7 jours',
    emoji: '📅1️⃣',
    rarity: 'common',
    category: 'seniority',
    condition_type: 'days_active',
    condition_value: 7
  },
  {
    code: 'SENIORITY_MONTH',
    name: 'Un Mois',
    description: 'Membre depuis 30 jours',
    emoji: '📅📆',
    rarity: 'rare',
    category: 'seniority',
    condition_type: 'days_active',
    condition_value: 30
  },
  {
    code: 'SENIORITY_6MONTHS',
    name: 'Vétéran',
    description: 'Membre depuis 6 mois',
    emoji: '📅⭐',
    rarity: 'epic',
    category: 'seniority',
    condition_type: 'days_active',
    condition_value: 180
  },
  {
    code: 'SENIORITY_YEAR',
    name: 'Légende Ancienne',
    description: 'Membre depuis 1 an',
    emoji: '📅👑',
    rarity: 'legendary',
    category: 'seniority',
    condition_type: 'days_active',
    condition_value: 365
  },

  // ========== SOCIAL BADGES ==========
  {
    code: 'SOCIAL_FLEX_10',
    name: 'Exhibitionniste',
    description: 'Utilise le Flex 10 fois',
    emoji: '📤🔟',
    rarity: 'common',
    category: 'social',
    condition_type: 'flex_count',
    condition_value: 10
  },
  {
    code: 'SOCIAL_FLEX_50',
    name: 'Roi du Flex',
    description: 'Utilise le Flex 50 fois',
    emoji: '📤👑',
    rarity: 'rare',
    category: 'social',
    condition_type: 'flex_count',
    condition_value: 50
  },
  {
    code: 'SOCIAL_FAVORITES',
    name: 'Collectionneur Favori',
    description: 'Configure 3 collectibles favoris',
    emoji: '⭐❤️',
    rarity: 'common',
    category: 'social',
    condition_type: 'favorites_set',
    condition_value: 3
  },

  // ========== MINT BADGES ==========
  {
    code: 'MINT_FIRST',
    name: 'Premier !',
    description: 'Obtiens le mint #1 d\'un collectible',
    emoji: '1️⃣✨',
    rarity: 'legendary',
    category: 'mint',
    condition_type: 'mint_first',
    condition_value: 1
  },
  {
    code: 'MINT_TOP_10',
    name: 'Early Adopter',
    description: 'Obtiens un mint dans le top 10',
    emoji: '🔟✨',
    rarity: 'epic',
    category: 'mint',
    condition_type: 'mint_top_10',
    condition_value: 1
  },
  {
    code: 'MINT_100',
    name: 'Centième',
    description: 'Obtiens le mint #100 d\'un collectible',
    emoji: '💯✨',
    rarity: 'rare',
    category: 'mint',
    condition_type: 'mint_100',
    condition_value: 1
  },

  // ========== LUCK BADGES ==========
  {
    code: 'LUCK_3_LEGENDARY_24H',
    name: 'Triple Légendaire',
    description: 'Obtiens 3 légendaires en 24h',
    emoji: '🍀🟠3️⃣',
    rarity: 'legendary',
    category: 'luck',
    condition_type: 'legendaries_in_24h',
    condition_value: 3
  },
  {
    code: 'LUCK_STREAK_7',
    name: 'Chanceux',
    description: '7 mystery boxes sans piège',
    emoji: '🍀7️⃣',
    rarity: 'rare',
    category: 'luck',
    condition_type: 'win_streak',
    condition_value: 7
  },

  // ========== THEME BADGES ==========
  {
    code: 'THEME_50_PERCENT',
    name: 'Mi-Chemin',
    description: 'Atteins 50% d\'un thème',
    emoji: '🎭5️⃣0️⃣',
    rarity: 'rare',
    category: 'theme',
    condition_type: 'theme_completion',
    condition_value: 50
  },
  {
    code: 'THEME_100_PERCENT',
    name: 'Thème Complet',
    description: 'Complète un thème à 100%',
    emoji: '🎭💯',
    rarity: 'legendary',
    category: 'theme',
    condition_type: 'theme_completion',
    condition_value: 100
  },

  // ========== MISSION SPECIAL BADGES ==========
  {
    code: 'MISSION_SPEED_RUNNER',
    name: 'Speed Runner',
    description: 'Complète une mission en moins de 10 secondes',
    emoji: '⚡🏃',
    rarity: 'epic',
    category: 'mission',
    condition_type: 'fast_mission',
    condition_value: 1
  },
  {
    code: 'MISSION_QUIZ_PERFECT',
    name: 'Quiz Parfait',
    description: 'Réussis un quiz avec 100% de bonnes réponses',
    emoji: '📝💯',
    rarity: 'rare',
    category: 'mission',
    condition_type: 'perfect_quiz',
    condition_value: 1
  },
  {
    code: 'MISSION_WORDLE_GENIUS',
    name: 'Wordle Génie',
    description: 'Trouve le mot au premier essai',
    emoji: '🔤🧠',
    rarity: 'epic',
    category: 'mission',
    condition_type: 'wordle_first_try',
    condition_value: 1
  },
  {
    code: 'MISSION_FLAWLESS',
    name: 'Sans Faute',
    description: 'Complète 10 missions consécutives sans échec',
    emoji: '✅🔟',
    rarity: 'legendary',
    category: 'mission',
    condition_type: 'flawless_missions',
    condition_value: 10
  }
];

async function seedBadges() {
  console.log('🏆 Seeding des badges V2...\n');
  console.log('='.repeat(60));

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const badge of BADGES_V2) {
    try {
      // Vérifier si le badge existe déjà
      const existing = await db.queryOne(
        'SELECT id FROM badges WHERE code = $1',
        [badge.code]
      );

      if (existing) {
        console.log(`⏭️  ${badge.code} existe déjà`);
        skipped++;
        continue;
      }

      // Insérer le badge avec la couleur basée sur la rareté
      const color = RARITY_COLORS[badge.rarity] || '#95A5A6';
      await db.query(`
        INSERT INTO badges (code, name, description, emoji, color, rarity, category, condition_type, condition_value)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        badge.code,
        badge.name,
        badge.description,
        badge.emoji,
        color,
        badge.rarity,
        badge.category,
        badge.condition_type,
        badge.condition_value
      ]);

      console.log(`✅ ${badge.code} → ${badge.name} (${badge.category})`);
      created++;
    } catch (error) {
      console.error(`❌ Erreur ${badge.code}:`, error.message);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Résumé:`);
  console.log(`   ✅ Créés: ${created}`);
  console.log(`   ⏭️  Ignorés: ${skipped}`);
  console.log(`   ❌ Erreurs: ${errors}`);
  console.log(`   📋 Total traités: ${BADGES_V2.length}`);

  // Afficher le total par catégorie
  console.log('\n📁 Par catégorie:');
  const categories = await db.queryAll(`
    SELECT category, COUNT(*) as count
    FROM badges
    GROUP BY category
    ORDER BY category
  `);
  for (const c of categories) {
    console.log(`   ${c.category}: ${c.count} badges`);
  }

  const total = await db.queryOne('SELECT COUNT(*) as count FROM badges');
  console.log(`\n🏆 Total badges en DB: ${total.count}`);
}

seedBadges()
  .then(() => {
    console.log('\n✅ Seeding terminé !');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
