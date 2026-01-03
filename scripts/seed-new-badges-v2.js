/**
 * ================================================================================
 * SEED NEW BADGES V2 - 35+ Nouveaux Badges
 * ================================================================================
 *
 * Catégories:
 * - rarity: Chasseur de raretés spécifiques
 * - evolution: Évolution de collectibles
 * - mystery_box_rarity: Box par rareté
 * - trap_special: Survie pièges spécifiques
 * - mission_special: Missions sans faute, speed, etc.
 * - economy: Loomix (dépenses, gains)
 * - seniority: Ancienneté sur le serveur
 * - mint: First mint, mint 100, etc.
 * - luck: Combos chanceux
 * - social: Parrainage, favoris, flex
 *
 * @since 2026-01-02
 */

const db = require('../utils/database-pg');
require('dotenv').config();

const NEW_BADGES = [
  // ============================================================
  // CATÉGORIE: RARITY (Chasseur de raretés spécifiques)
  // ============================================================
  {
    code: 'RARITY_LEGENDARY_HUNTER',
    name: 'Chasseur Légendaire',
    description: 'Collectionne 10 collectibles légendaires',
    emoji: '👑',
    color: '#f39c12',
    rarity: 'epic',
    category: 'rarity',
    condition_type: 'legendary_count',
    condition_value: 10
  },
  {
    code: 'RARITY_LEGENDARY_MASTER',
    name: 'Maître des Légendes',
    description: 'Collectionne 50 collectibles légendaires',
    emoji: '👑✨',
    color: '#e74c3c',
    rarity: 'legendary',
    category: 'rarity',
    condition_type: 'legendary_count',
    condition_value: 50
  },
  {
    code: 'RARITY_EPIC_MASTER',
    name: 'Maître Épique',
    description: 'Collectionne 25 collectibles épiques',
    emoji: '💜',
    color: '#9b59b6',
    rarity: 'rare',
    category: 'rarity',
    condition_type: 'epic_count',
    condition_value: 25
  },
  {
    code: 'RARITY_RARE_BARON',
    name: 'Baron des Rares',
    description: 'Collectionne 50 collectibles rares',
    emoji: '🔵',
    color: '#3498db',
    rarity: 'uncommon',
    category: 'rarity',
    condition_type: 'rare_count',
    condition_value: 50
  },

  // ============================================================
  // CATÉGORIE: EVOLUTION (Niveaux de collectibles)
  // ============================================================
  {
    code: 'EVOLUTION_LEVEL_2',
    name: 'Premier Niveau 2',
    description: 'Évolue un collectible au niveau 2',
    emoji: '⭐',
    color: '#95a5a6',
    rarity: 'common',
    category: 'evolution',
    condition_type: 'evolution_level',
    condition_value: 2
  },
  {
    code: 'EVOLUTION_LEVEL_3',
    name: 'Niveau 3 Atteint',
    description: 'Évolue un collectible au niveau 3',
    emoji: '⭐⭐',
    color: '#3498db',
    rarity: 'rare',
    category: 'evolution',
    condition_type: 'evolution_level',
    condition_value: 3
  },
  {
    code: 'EVOLUTION_LEVEL_4',
    name: 'Niveau 4 Atteint',
    description: 'Évolue un collectible au niveau 4 (max)',
    emoji: '⭐⭐⭐',
    color: '#9b59b6',
    rarity: 'epic',
    category: 'evolution',
    condition_type: 'evolution_level',
    condition_value: 4
  },
  {
    code: 'EVOLUTION_MASTER',
    name: 'Évolutionniste',
    description: '10 collectibles au niveau 4',
    emoji: '⭐👑',
    color: '#f39c12',
    rarity: 'legendary',
    category: 'evolution',
    condition_type: 'max_level_count',
    condition_value: 10
  },

  // ============================================================
  // CATÉGORIE: MYSTERY BOX RARITY (Box par rareté)
  // ============================================================
  {
    code: 'BOX_EPIC_COLLECTOR',
    name: 'Ouvreur Épique',
    description: 'Ouvre 10 mystery boxes épiques',
    emoji: '📦💜',
    color: '#9b59b6',
    rarity: 'rare',
    category: 'mystery_box',
    condition_type: 'epic_box_open',
    condition_value: 10
  },
  {
    code: 'BOX_LEGENDARY_COLLECTOR',
    name: 'Ouvreur Légendaire',
    description: 'Ouvre 5 mystery boxes légendaires',
    emoji: '📦👑',
    color: '#f39c12',
    rarity: 'epic',
    category: 'mystery_box',
    condition_type: 'legendary_box_open',
    condition_value: 5
  },
  {
    code: 'BOX_FULL_SET',
    name: 'Jackpot Total',
    description: 'Ouvre au moins une box de chaque rareté',
    emoji: '📦🌟',
    color: '#f39c12',
    rarity: 'legendary',
    category: 'mystery_box',
    condition_type: 'all_rarities_opened',
    condition_value: 1
  },
  {
    code: 'BOX_MARATHON',
    name: 'Marathon des Coffres',
    description: 'Ouvre 500 mystery boxes',
    emoji: '📦🏃',
    color: '#e74c3c',
    rarity: 'mythic',
    category: 'mystery_box',
    condition_type: 'mystery_box_open',
    condition_value: 500
  },

  // ============================================================
  // CATÉGORIE: TRAP SPECIAL (Survie pièges spécifiques)
  // ============================================================
  {
    code: 'TRAP_INFERNAL_SURVIVOR',
    name: 'Survivant Infernal',
    description: 'Survie au piège "Lose All" sans protection',
    emoji: '🪤🔥',
    color: '#9b59b6',
    rarity: 'epic',
    category: 'trap',
    condition_type: 'survive_lose_all',
    condition_value: 1
  },
  {
    code: 'TRAP_PERFECT_SHIELD',
    name: 'Bouclier Parfait',
    description: 'Bloque 10 pièges en 24h',
    emoji: '🛡️✨',
    color: '#f39c12',
    rarity: 'legendary',
    category: 'trap',
    condition_type: 'blocks_in_24h',
    condition_value: 10
  },
  {
    code: 'TRAP_TRIGGERED_10',
    name: 'Malchanceux',
    description: 'Déclenche 10 pièges',
    emoji: '💥',
    color: '#2ecc71',
    rarity: 'uncommon',
    category: 'trap',
    condition_type: 'trap_triggered',
    condition_value: 10
  },
  {
    code: 'TRAP_TRIGGERED_50',
    name: 'Aimant à Malheurs',
    description: 'Déclenche 50 pièges',
    emoji: '💥💥',
    color: '#3498db',
    rarity: 'rare',
    category: 'trap',
    condition_type: 'trap_triggered',
    condition_value: 50
  },

  // ============================================================
  // CATÉGORIE: MISSION SPECIAL (Missions spéciales)
  // ============================================================
  {
    code: 'MISSION_FLAWLESS',
    name: 'Sans Faute',
    description: 'Complète 10 missions sans échec',
    emoji: '✅',
    color: '#9b59b6',
    rarity: 'epic',
    category: 'mission',
    condition_type: 'flawless_missions',
    condition_value: 10
  },
  {
    code: 'MISSION_SPEED_RUNNER',
    name: 'Speed Runner',
    description: 'Complète une mission en moins de 10 secondes',
    emoji: '⚡',
    color: '#3498db',
    rarity: 'rare',
    category: 'mission',
    condition_type: 'fast_mission',
    condition_value: 1
  },
  {
    code: 'MISSION_QUIZ_PERFECT',
    name: 'Parfait au Quiz',
    description: 'Obtiens 100% à un quiz de 5+ questions',
    emoji: '🎯',
    color: '#9b59b6',
    rarity: 'epic',
    category: 'mission',
    condition_type: 'perfect_quiz',
    condition_value: 1
  },
  {
    code: 'MISSION_WORDLE_GENIUS',
    name: 'Génie Wordle',
    description: 'Trouve un mot Wordle en 1 seul essai',
    emoji: '🧩',
    color: '#e74c3c',
    rarity: 'mythic',
    category: 'mission',
    condition_type: 'wordle_first_try',
    condition_value: 1
  },
  {
    code: 'MISSION_FAIL_COMEBACK',
    name: 'Rédemption',
    description: 'Réussit une mission après 3 échecs consécutifs',
    emoji: '🔄',
    color: '#3498db',
    rarity: 'rare',
    category: 'mission',
    condition_type: 'comeback_mission',
    condition_value: 1
  },

  // ============================================================
  // CATÉGORIE: ECONOMY (Loomix)
  // ============================================================
  {
    code: 'ECONOMY_SPENDER',
    name: 'Dépensier',
    description: 'Dépense 1000 Loomix au total',
    emoji: '💸',
    color: '#2ecc71',
    rarity: 'uncommon',
    category: 'economy',
    condition_type: 'loomix_spent',
    condition_value: 1000
  },
  {
    code: 'ECONOMY_MILLIONAIRE',
    name: 'Millionnaire',
    description: 'Gagne 10000 Loomix au total',
    emoji: '🤑',
    color: '#9b59b6',
    rarity: 'epic',
    category: 'economy',
    condition_type: 'loomix_earned',
    condition_value: 10000
  },
  {
    code: 'ECONOMY_SAVER',
    name: 'Économe',
    description: 'Accumule 5000 Loomix en banque',
    emoji: '💎',
    color: '#3498db',
    rarity: 'rare',
    category: 'economy',
    condition_type: 'loomix_balance',
    condition_value: 5000
  },
  {
    code: 'ECONOMY_BILLIONAIRE',
    name: 'Magnat',
    description: 'Gagne 100000 Loomix au total',
    emoji: '💰👑',
    color: '#f39c12',
    rarity: 'legendary',
    category: 'economy',
    condition_type: 'loomix_earned',
    condition_value: 100000
  },

  // ============================================================
  // CATÉGORIE: SENIORITY (Ancienneté)
  // ============================================================
  {
    code: 'SENIORITY_WEEK',
    name: 'Nouveau Venu',
    description: '1 semaine sur le serveur',
    emoji: '🌱',
    color: '#95a5a6',
    rarity: 'common',
    category: 'seniority',
    condition_type: 'days_active',
    condition_value: 7
  },
  {
    code: 'SENIORITY_MONTH',
    name: 'Membre Établi',
    description: '1 mois sur le serveur',
    emoji: '🌳',
    color: '#2ecc71',
    rarity: 'uncommon',
    category: 'seniority',
    condition_type: 'days_active',
    condition_value: 30
  },
  {
    code: 'SENIORITY_6MONTHS',
    name: 'Ancien',
    description: '6 mois sur le serveur',
    emoji: '🏛️',
    color: '#3498db',
    rarity: 'rare',
    category: 'seniority',
    condition_type: 'days_active',
    condition_value: 180
  },
  {
    code: 'SENIORITY_YEAR',
    name: 'Légende Ancienne',
    description: '1 an sur le serveur',
    emoji: '👴',
    color: '#f39c12',
    rarity: 'legendary',
    category: 'seniority',
    condition_type: 'days_active',
    condition_value: 365
  },

  // ============================================================
  // CATÉGORIE: MINT (First mint, etc.)
  // ============================================================
  {
    code: 'MINT_TOP_10',
    name: 'First Mint',
    description: 'Obtiens un collectible avec mint #1-10',
    emoji: '#️⃣',
    color: '#9b59b6',
    rarity: 'epic',
    category: 'mint',
    condition_type: 'mint_top_10',
    condition_value: 1
  },
  {
    code: 'MINT_FIRST',
    name: 'Premier Détenteur',
    description: 'Obtiens un collectible avec mint #1',
    emoji: '🥇',
    color: '#f39c12',
    rarity: 'legendary',
    category: 'mint',
    condition_type: 'mint_first',
    condition_value: 1
  },
  {
    code: 'MINT_100',
    name: 'Cent-ième',
    description: 'Obtiens un collectible avec mint #100',
    emoji: '💯',
    color: '#3498db',
    rarity: 'rare',
    category: 'mint',
    condition_type: 'mint_100',
    condition_value: 1
  },

  // ============================================================
  // CATÉGORIE: LUCK (Combos chanceux)
  // ============================================================
  {
    code: 'LUCK_3_LEGENDARY_24H',
    name: 'Coup de Bol',
    description: 'Obtiens 3 légendaires en 24h',
    emoji: '🍀',
    color: '#f39c12',
    rarity: 'legendary',
    category: 'luck',
    condition_type: 'legendaries_in_24h',
    condition_value: 3
  },
  {
    code: 'LUCK_STREAK_7',
    name: 'Streak Parfait',
    description: '7 gains consécutifs sans piège',
    emoji: '🔥',
    color: '#9b59b6',
    rarity: 'epic',
    category: 'luck',
    condition_type: 'win_streak',
    condition_value: 7
  },
  {
    code: 'LUCK_CRAFT_COMBO',
    name: 'Combo Critique',
    description: '3 crafts critiques consécutifs',
    emoji: '💥🔨',
    color: '#f39c12',
    rarity: 'legendary',
    category: 'luck',
    condition_type: 'critical_streak',
    condition_value: 3
  },

  // ============================================================
  // CATÉGORIE: SOCIAL
  // ============================================================
  {
    code: 'SOCIAL_FAVORITES',
    name: 'Curateur',
    description: 'Configure tes 3 favoris',
    emoji: '⭐',
    color: '#95a5a6',
    rarity: 'common',
    category: 'social',
    condition_type: 'favorites_set',
    condition_value: 3
  },
  {
    code: 'SOCIAL_FLEX_10',
    name: 'Partageur',
    description: 'Utilise /flex 10 fois',
    emoji: '📤',
    color: '#2ecc71',
    rarity: 'uncommon',
    category: 'social',
    condition_type: 'flex_count',
    condition_value: 10
  },
  {
    code: 'SOCIAL_FLEX_50',
    name: 'Influenceur',
    description: 'Utilise /flex 50 fois',
    emoji: '📤✨',
    color: '#3498db',
    rarity: 'rare',
    category: 'social',
    condition_type: 'flex_count',
    condition_value: 50
  },

  // ============================================================
  // CATÉGORIE: THEME (Complétion de thème)
  // ============================================================
  {
    code: 'THEME_50_PERCENT',
    name: 'Demi-Collection',
    description: 'Collecte 50% d\'un thème',
    emoji: '📚',
    color: '#3498db',
    rarity: 'rare',
    category: 'collection',
    condition_type: 'theme_completion',
    condition_value: 50
  },
  {
    code: 'THEME_100_PERCENT',
    name: 'Collection Parfaite',
    description: 'Collecte 100% d\'un thème',
    emoji: '📚👑',
    color: '#e74c3c',
    rarity: 'mythic',
    category: 'collection',
    condition_type: 'theme_completion',
    condition_value: 100
  }
];

async function seedBadges() {
  console.log('🏆 ===== SEEDING 35+ NOUVEAUX BADGES =====\n');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const badge of NEW_BADGES) {
    try {
      // Vérifier si le badge existe déjà
      const existing = await db.queryOne(
        'SELECT id FROM badges WHERE code = $1',
        [badge.code]
      );

      if (existing) {
        console.log(`⏭️  Badge ${badge.code} existe déjà, skip`);
        skipped++;
        continue;
      }

      // Insérer le nouveau badge
      await db.query(`
        INSERT INTO badges (code, name, description, emoji, color, rarity, category, condition_type, condition_value)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        badge.code,
        badge.name,
        badge.description,
        badge.emoji,
        badge.color,
        badge.rarity,
        badge.category,
        badge.condition_type,
        badge.condition_value
      ]);

      console.log(`✅ Badge créé: ${badge.emoji} ${badge.name} (${badge.rarity})`);
      created++;
    } catch (error) {
      console.error(`❌ Erreur création ${badge.code}:`, error.message);
      errors++;
    }
  }

  console.log('\n📊 ===== RÉSUMÉ =====');
  console.log(`✅ Créés: ${created}`);
  console.log(`⏭️  Existants: ${skipped}`);
  console.log(`❌ Erreurs: ${errors}`);
  console.log(`📦 Total traité: ${NEW_BADGES.length}`);

  // Afficher le nombre total de badges
  const totalBadges = await db.queryOne('SELECT COUNT(*) as count FROM badges');
  console.log(`\n🏆 Total badges dans la DB: ${totalBadges.count}`);

  process.exit(0);
}

seedBadges().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
