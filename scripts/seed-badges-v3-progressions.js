/**
 * Script de seeding pour les progressions de badges V3
 * Ajoute des niveaux intermédiaires pour étendre la durée de vie des badges
 *
 * Objectif: Chaque type de badge doit avoir 3-5 niveaux de progression
 * avec des raretés croissantes selon la difficulté
 *
 * Usage: node scripts/seed-badges-v3-progressions.js
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

const NEW_BADGES_V3 = [
  // ========================================
  // RARITY BADGES - Legendary Count (5 niveaux)
  // ========================================
  {
    code: 'RARITY_LEGENDARY_NOVICE',
    name: 'Apprenti Légendaire',
    description: 'Collecte ton premier objet légendaire',
    emoji: '🟠🔰',
    rarity: 'common',
    category: 'rarity',
    condition_type: 'legendary_count',
    condition_value: 1
  },
  {
    code: 'RARITY_LEGENDARY_SEEKER',
    name: 'Chercheur de Légendaires',
    description: 'Collecte 5 objets légendaires',
    emoji: '🟠🔍',
    rarity: 'uncommon',
    category: 'rarity',
    condition_type: 'legendary_count',
    condition_value: 5
  },
  // Note: RARITY_LEGENDARY_HUNTER (10) existe déjà
  {
    code: 'RARITY_LEGENDARY_COLLECTOR',
    name: 'Collectionneur Légendaire',
    description: 'Collecte 25 objets légendaires',
    emoji: '🟠💎',
    rarity: 'rare',
    category: 'rarity',
    condition_type: 'legendary_count',
    condition_value: 25
  },
  // Note: RARITY_LEGENDARY_MASTER (50) existe déjà
  {
    code: 'RARITY_LEGENDARY_EMPEROR',
    name: 'Empereur des Légendaires',
    description: 'Collecte 100 objets légendaires',
    emoji: '🟠👑✨',
    rarity: 'mythic',
    category: 'rarity',
    condition_type: 'legendary_count',
    condition_value: 100
  },

  // ========================================
  // RARITY BADGES - Epic Count (5 niveaux)
  // ========================================
  {
    code: 'RARITY_EPIC_NOVICE',
    name: 'Apprenti Épique',
    description: 'Collecte 5 objets épiques',
    emoji: '🟣🔰',
    rarity: 'common',
    category: 'rarity',
    condition_type: 'epic_count',
    condition_value: 5
  },
  {
    code: 'RARITY_EPIC_SEEKER',
    name: 'Chercheur Épique',
    description: 'Collecte 10 objets épiques',
    emoji: '🟣🔍',
    rarity: 'uncommon',
    category: 'rarity',
    condition_type: 'epic_count',
    condition_value: 10
  },
  // Note: RARITY_EPIC_MASTER (25) existe déjà
  {
    code: 'RARITY_EPIC_COLLECTOR',
    name: 'Collectionneur Épique',
    description: 'Collecte 50 objets épiques',
    emoji: '🟣💎',
    rarity: 'legendary',
    category: 'rarity',
    condition_type: 'epic_count',
    condition_value: 50
  },
  {
    code: 'RARITY_EPIC_EMPEROR',
    name: 'Empereur Épique',
    description: 'Collecte 100 objets épiques',
    emoji: '🟣👑✨',
    rarity: 'mythic',
    category: 'rarity',
    condition_type: 'epic_count',
    condition_value: 100
  },

  // ========================================
  // RARITY BADGES - Rare Count (5 niveaux)
  // ========================================
  {
    code: 'RARITY_RARE_NOVICE',
    name: 'Apprenti des Rares',
    description: 'Collecte 10 objets rares',
    emoji: '🔵🔰',
    rarity: 'common',
    category: 'rarity',
    condition_type: 'rare_count',
    condition_value: 10
  },
  {
    code: 'RARITY_RARE_SEEKER',
    name: 'Chercheur de Rares',
    description: 'Collecte 25 objets rares',
    emoji: '🔵🔍',
    rarity: 'uncommon',
    category: 'rarity',
    condition_type: 'rare_count',
    condition_value: 25
  },
  // Note: RARITY_RARE_BARON (50) existe déjà
  {
    code: 'RARITY_RARE_COLLECTOR',
    name: 'Collectionneur de Rares',
    description: 'Collecte 100 objets rares',
    emoji: '🔵💎',
    rarity: 'epic',
    category: 'rarity',
    condition_type: 'rare_count',
    condition_value: 100
  },
  {
    code: 'RARITY_RARE_EMPEROR',
    name: 'Empereur des Rares',
    description: 'Collecte 200 objets rares',
    emoji: '🔵👑✨',
    rarity: 'legendary',
    category: 'rarity',
    condition_type: 'rare_count',
    condition_value: 200
  },

  // ========================================
  // MYSTERY BOX RARITY BADGES (5 niveaux par type)
  // ========================================
  // Epic Box - 5 niveaux
  {
    code: 'BOX_EPIC_NOVICE',
    name: 'Chasseur Épique Débutant',
    description: 'Ouvre 1 mystery box épique',
    emoji: '🟣📦🔰',
    rarity: 'common',
    category: 'mystery_box',
    condition_type: 'epic_box_open',
    condition_value: 1
  },
  {
    code: 'BOX_EPIC_SEEKER',
    name: 'Chasseur Épique',
    description: 'Ouvre 5 mystery boxes épiques',
    emoji: '🟣📦🔍',
    rarity: 'uncommon',
    category: 'mystery_box',
    condition_type: 'epic_box_open',
    condition_value: 5
  },
  // Note: BOX_EPIC_COLLECTOR (10) existe déjà
  {
    code: 'BOX_EPIC_MASTER',
    name: 'Maître des Box Épiques',
    description: 'Ouvre 25 mystery boxes épiques',
    emoji: '🟣📦👑',
    rarity: 'legendary',
    category: 'mystery_box',
    condition_type: 'epic_box_open',
    condition_value: 25
  },
  {
    code: 'BOX_EPIC_EMPEROR',
    name: 'Empereur des Box Épiques',
    description: 'Ouvre 50 mystery boxes épiques',
    emoji: '🟣📦✨',
    rarity: 'mythic',
    category: 'mystery_box',
    condition_type: 'epic_box_open',
    condition_value: 50
  },

  // Legendary Box - 5 niveaux
  {
    code: 'BOX_LEGENDARY_NOVICE',
    name: 'Chasseur Légendaire Débutant',
    description: 'Ouvre 1 mystery box légendaire',
    emoji: '🟠📦🔰',
    rarity: 'uncommon',
    category: 'mystery_box',
    condition_type: 'legendary_box_open',
    condition_value: 1
  },
  {
    code: 'BOX_LEGENDARY_SEEKER',
    name: 'Chasseur Légendaire',
    description: 'Ouvre 3 mystery boxes légendaires',
    emoji: '🟠📦🔍',
    rarity: 'rare',
    category: 'mystery_box',
    condition_type: 'legendary_box_open',
    condition_value: 3
  },
  // Note: BOX_LEGENDARY_COLLECTOR (5) existe déjà
  {
    code: 'BOX_LEGENDARY_MASTER',
    name: 'Maître des Box Légendaires',
    description: 'Ouvre 10 mystery boxes légendaires',
    emoji: '🟠📦👑',
    rarity: 'mythic',
    category: 'mystery_box',
    condition_type: 'legendary_box_open',
    condition_value: 10
  },
  {
    code: 'BOX_LEGENDARY_EMPEROR',
    name: 'Empereur des Box Légendaires',
    description: 'Ouvre 25 mystery boxes légendaires',
    emoji: '🟠📦✨👑',
    rarity: 'mythic',
    category: 'mystery_box',
    condition_type: 'legendary_box_open',
    condition_value: 25
  },

  // ========================================
  // TRAP BADGES (5 niveaux)
  // ========================================
  {
    code: 'TRAP_TRIGGERED_1',
    name: 'Premier Piège',
    description: 'Déclenche ton premier piège',
    emoji: '💀1️⃣',
    rarity: 'common',
    category: 'trap',
    condition_type: 'trap_triggered',
    condition_value: 1
  },
  {
    code: 'TRAP_TRIGGERED_5',
    name: 'Piège Habitué',
    description: 'Déclenche 5 pièges',
    emoji: '💀5️⃣',
    rarity: 'common',
    category: 'trap',
    condition_type: 'trap_triggered',
    condition_value: 5
  },
  // Note: TRAP_TRIGGERED_10 (10) existe déjà
  {
    code: 'TRAP_TRIGGERED_25',
    name: 'Victime Régulière',
    description: 'Déclenche 25 pièges',
    emoji: '💀2️⃣5️⃣',
    rarity: 'uncommon',
    category: 'trap',
    condition_type: 'trap_triggered',
    condition_value: 25
  },
  // Note: TRAP_TRIGGERED_50 (50) existe déjà
  {
    code: 'TRAP_TRIGGERED_100',
    name: 'Roi des Pièges',
    description: 'Déclenche 100 pièges',
    emoji: '💀💯👑',
    rarity: 'epic',
    category: 'trap',
    condition_type: 'trap_triggered',
    condition_value: 100
  },

  // ========================================
  // ECONOMY BADGES - Loomix Spent (5 niveaux)
  // ========================================
  {
    code: 'ECONOMY_FIRST_SPEND',
    name: 'Première Dépense',
    description: 'Dépense 100 Loomix au total',
    emoji: '💸🔰',
    rarity: 'common',
    category: 'economy',
    condition_type: 'loomix_spent',
    condition_value: 100
  },
  {
    code: 'ECONOMY_REGULAR_SPENDER',
    name: 'Dépensier Régulier',
    description: 'Dépense 500 Loomix au total',
    emoji: '💸📊',
    rarity: 'common',
    category: 'economy',
    condition_type: 'loomix_spent',
    condition_value: 500
  },
  // Note: ECONOMY_SPENDER (1000) existe déjà
  {
    code: 'ECONOMY_BIG_SPENDER',
    name: 'Gros Dépensier',
    description: 'Dépense 5000 Loomix au total',
    emoji: '💸💎',
    rarity: 'rare',
    category: 'economy',
    condition_type: 'loomix_spent',
    condition_value: 5000
  },
  {
    code: 'ECONOMY_MEGA_SPENDER',
    name: 'Méga Dépensier',
    description: 'Dépense 10000 Loomix au total',
    emoji: '💸👑',
    rarity: 'epic',
    category: 'economy',
    condition_type: 'loomix_spent',
    condition_value: 10000
  },

  // ========================================
  // ECONOMY BADGES - Loomix Earned (5 niveaux)
  // ========================================
  {
    code: 'ECONOMY_FIRST_EARNINGS',
    name: 'Premiers Gains',
    description: 'Gagne 1000 Loomix au total',
    emoji: '💰🔰',
    rarity: 'common',
    category: 'economy',
    condition_type: 'loomix_earned',
    condition_value: 1000
  },
  {
    code: 'ECONOMY_REGULAR_EARNER',
    name: 'Gagnant Régulier',
    description: 'Gagne 5000 Loomix au total',
    emoji: '💰📊',
    rarity: 'uncommon',
    category: 'economy',
    condition_type: 'loomix_earned',
    condition_value: 5000
  },
  // Note: ECONOMY_MILLIONAIRE (10000) existe déjà
  {
    code: 'ECONOMY_WEALTHY',
    name: 'Fortuné',
    description: 'Gagne 50000 Loomix au total',
    emoji: '💰💎',
    rarity: 'epic',
    category: 'economy',
    condition_type: 'loomix_earned',
    condition_value: 50000
  },
  // Note: ECONOMY_BILLIONAIRE (100000) existe déjà

  // ========================================
  // ECONOMY BADGES - Loomix Balance (5 niveaux)
  // ========================================
  {
    code: 'ECONOMY_FIRST_SAVINGS',
    name: 'Premières Économies',
    description: 'Possède 1000 Loomix en même temps',
    emoji: '🏦🔰',
    rarity: 'common',
    category: 'economy',
    condition_type: 'loomix_balance',
    condition_value: 1000
  },
  {
    code: 'ECONOMY_GOOD_SAVER',
    name: 'Bon Épargnant',
    description: 'Possède 2500 Loomix en même temps',
    emoji: '🏦📊',
    rarity: 'uncommon',
    category: 'economy',
    condition_type: 'loomix_balance',
    condition_value: 2500
  },
  // Note: ECONOMY_SAVER (5000) existe déjà
  {
    code: 'ECONOMY_RICH',
    name: 'Riche',
    description: 'Possède 10000 Loomix en même temps',
    emoji: '🏦💎',
    rarity: 'epic',
    category: 'economy',
    condition_type: 'loomix_balance',
    condition_value: 10000
  },
  {
    code: 'ECONOMY_ULTRA_RICH',
    name: 'Ultra Riche',
    description: 'Possède 25000 Loomix en même temps',
    emoji: '🏦👑',
    rarity: 'legendary',
    category: 'economy',
    condition_type: 'loomix_balance',
    condition_value: 25000
  },

  // ========================================
  // SOCIAL BADGES - Flex Count (5 niveaux)
  // ========================================
  {
    code: 'SOCIAL_FIRST_FLEX',
    name: 'Premier Flex',
    description: 'Utilise le Flex pour la première fois',
    emoji: '📤1️⃣',
    rarity: 'common',
    category: 'social',
    condition_type: 'flex_count',
    condition_value: 1
  },
  {
    code: 'SOCIAL_FLEX_5',
    name: 'Flexeur Débutant',
    description: 'Utilise le Flex 5 fois',
    emoji: '📤5️⃣',
    rarity: 'common',
    category: 'social',
    condition_type: 'flex_count',
    condition_value: 5
  },
  // Note: SOCIAL_FLEX_10 (10) existe déjà
  {
    code: 'SOCIAL_FLEX_25',
    name: 'Flexeur Assidu',
    description: 'Utilise le Flex 25 fois',
    emoji: '📤💪',
    rarity: 'uncommon',
    category: 'social',
    condition_type: 'flex_count',
    condition_value: 25
  },
  // Note: SOCIAL_FLEX_50 (50) existe déjà
  {
    code: 'SOCIAL_FLEX_100',
    name: 'Flexeur Légendaire',
    description: 'Utilise le Flex 100 fois',
    emoji: '📤👑✨',
    rarity: 'epic',
    category: 'social',
    condition_type: 'flex_count',
    condition_value: 100
  },

  // ========================================
  // MINT BADGES - Progressions (5 niveaux par type)
  // ========================================
  // Mint First (#1)
  // Note: MINT_FIRST (1) existe déjà
  {
    code: 'MINT_FIRST_5',
    name: 'Collectionneur de #1',
    description: 'Obtiens 5 fois le mint #1',
    emoji: '1️⃣⭐',
    rarity: 'legendary',
    category: 'mint',
    condition_type: 'mint_first',
    condition_value: 5
  },
  {
    code: 'MINT_FIRST_10',
    name: 'Maître des Premiers',
    description: 'Obtiens 10 fois le mint #1',
    emoji: '1️⃣👑',
    rarity: 'mythic',
    category: 'mint',
    condition_type: 'mint_first',
    condition_value: 10
  },

  // Mint Top 10
  // Note: MINT_TOP_10 (1) existe déjà
  {
    code: 'MINT_TOP_10_5',
    name: 'Early Adopter Régulier',
    description: 'Obtiens 5 fois un mint dans le top 10',
    emoji: '🔟⭐',
    rarity: 'epic',
    category: 'mint',
    condition_type: 'mint_top_10',
    condition_value: 5
  },
  {
    code: 'MINT_TOP_10_10',
    name: 'Maître Early Adopter',
    description: 'Obtiens 10 fois un mint dans le top 10',
    emoji: '🔟👑',
    rarity: 'legendary',
    category: 'mint',
    condition_type: 'mint_top_10',
    condition_value: 10
  },
  {
    code: 'MINT_TOP_10_25',
    name: 'Légende Early Adopter',
    description: 'Obtiens 25 fois un mint dans le top 10',
    emoji: '🔟✨👑',
    rarity: 'mythic',
    category: 'mint',
    condition_type: 'mint_top_10',
    condition_value: 25
  },

  // Mint #100
  // Note: MINT_100 (1) existe déjà
  {
    code: 'MINT_100_5',
    name: 'Collectionneur de Centièmes',
    description: 'Obtiens 5 fois le mint #100',
    emoji: '💯⭐',
    rarity: 'epic',
    category: 'mint',
    condition_type: 'mint_100',
    condition_value: 5
  },
  {
    code: 'MINT_100_10',
    name: 'Maître des Centièmes',
    description: 'Obtiens 10 fois le mint #100',
    emoji: '💯👑',
    rarity: 'legendary',
    category: 'mint',
    condition_type: 'mint_100',
    condition_value: 10
  },

  // ========================================
  // LUCK BADGES - Progressions (5 niveaux)
  // ========================================
  {
    code: 'LUCK_LEGENDARY_24H',
    name: 'Jour de Chance',
    description: 'Obtiens 1 légendaire en 24h',
    emoji: '🍀🟠1️⃣',
    rarity: 'rare',
    category: 'luck',
    condition_type: 'legendaries_in_24h',
    condition_value: 1
  },
  {
    code: 'LUCK_2_LEGENDARY_24H',
    name: 'Double Chance',
    description: 'Obtiens 2 légendaires en 24h',
    emoji: '🍀🟠2️⃣',
    rarity: 'epic',
    category: 'luck',
    condition_type: 'legendaries_in_24h',
    condition_value: 2
  },
  // Note: LUCK_3_LEGENDARY_24H (3) existe déjà
  {
    code: 'LUCK_5_LEGENDARY_24H',
    name: 'Jackpot Légendaire',
    description: 'Obtiens 5 légendaires en 24h',
    emoji: '🍀🟠5️⃣✨',
    rarity: 'mythic',
    category: 'luck',
    condition_type: 'legendaries_in_24h',
    condition_value: 5
  },

  // Win Streak (sans piège)
  {
    code: 'LUCK_STREAK_3',
    name: 'Début de Série',
    description: '3 mystery boxes sans piège',
    emoji: '🍀3️⃣',
    rarity: 'common',
    category: 'luck',
    condition_type: 'win_streak',
    condition_value: 3
  },
  {
    code: 'LUCK_STREAK_5',
    name: 'Série Prometteuse',
    description: '5 mystery boxes sans piège',
    emoji: '🍀5️⃣',
    rarity: 'uncommon',
    category: 'luck',
    condition_type: 'win_streak',
    condition_value: 5
  },
  // Note: LUCK_STREAK_7 (7) existe déjà
  {
    code: 'LUCK_STREAK_10',
    name: 'Série en Or',
    description: '10 mystery boxes sans piège',
    emoji: '🍀🔟',
    rarity: 'epic',
    category: 'luck',
    condition_type: 'win_streak',
    condition_value: 10
  },
  {
    code: 'LUCK_STREAK_15',
    name: 'Série Légendaire',
    description: '15 mystery boxes sans piège',
    emoji: '🍀1️⃣5️⃣👑',
    rarity: 'legendary',
    category: 'luck',
    condition_type: 'win_streak',
    condition_value: 15
  },

  // ========================================
  // THEME BADGES - Progressions (5 niveaux)
  // ========================================
  {
    code: 'THEME_25_PERCENT',
    name: 'Bon Début',
    description: 'Atteins 25% d\'un thème',
    emoji: '🎭2️⃣5️⃣',
    rarity: 'common',
    category: 'theme',
    condition_type: 'theme_completion',
    condition_value: 25
  },
  // Note: THEME_50_PERCENT (50) existe déjà
  {
    code: 'THEME_75_PERCENT',
    name: 'Presque Là',
    description: 'Atteins 75% d\'un thème',
    emoji: '🎭7️⃣5️⃣',
    rarity: 'epic',
    category: 'theme',
    condition_type: 'theme_completion',
    condition_value: 75
  },
  // Note: THEME_100_PERCENT (100) existe déjà

  // Thèmes complétés
  {
    code: 'THEME_COMPLETER_1',
    name: 'Premier Thème Complété',
    description: 'Complète 1 thème à 100%',
    emoji: '🎭✅1️⃣',
    rarity: 'rare',
    category: 'theme',
    condition_type: 'themes_completed',
    condition_value: 1
  },
  {
    code: 'THEME_COMPLETER_3',
    name: 'Collectionneur de Thèmes',
    description: 'Complète 3 thèmes à 100%',
    emoji: '🎭✅3️⃣',
    rarity: 'epic',
    category: 'theme',
    condition_type: 'themes_completed',
    condition_value: 3
  },
  {
    code: 'THEME_COMPLETER_5',
    name: 'Maître des Thèmes',
    description: 'Complète 5 thèmes à 100%',
    emoji: '🎭✅5️⃣',
    rarity: 'legendary',
    category: 'theme',
    condition_type: 'themes_completed',
    condition_value: 5
  },
  {
    code: 'THEME_COMPLETER_10',
    name: 'Légende des Thèmes',
    description: 'Complète 10 thèmes à 100%',
    emoji: '🎭✅👑',
    rarity: 'mythic',
    category: 'theme',
    condition_type: 'themes_completed',
    condition_value: 10
  },

  // ========================================
  // MISSION BADGES - Count Progressions (5 niveaux)
  // ========================================
  {
    code: 'MISSION_FIRST',
    name: 'Première Mission',
    description: 'Complète ta première mission',
    emoji: '📋1️⃣',
    rarity: 'common',
    category: 'mission',
    condition_type: 'mission_complete',
    condition_value: 1
  },
  {
    code: 'MISSION_REGULAR',
    name: 'Missionnaire Régulier',
    description: 'Complète 10 missions',
    emoji: '📋🔟',
    rarity: 'uncommon',
    category: 'mission',
    condition_type: 'mission_complete',
    condition_value: 10
  },
  {
    code: 'MISSION_VETERAN',
    name: 'Vétéran des Missions',
    description: 'Complète 25 missions',
    emoji: '📋⭐',
    rarity: 'rare',
    category: 'mission',
    condition_type: 'mission_complete',
    condition_value: 25
  },
  {
    code: 'MISSION_EXPERT',
    name: 'Expert des Missions',
    description: 'Complète 50 missions',
    emoji: '📋💎',
    rarity: 'epic',
    category: 'mission',
    condition_type: 'mission_complete',
    condition_value: 50
  },
  {
    code: 'MISSION_MASTER',
    name: 'Maître des Missions',
    description: 'Complète 100 missions',
    emoji: '📋👑',
    rarity: 'legendary',
    category: 'mission',
    condition_type: 'mission_complete',
    condition_value: 100
  },

  // ========================================
  // MYSTERY BOX BADGES - Total Opened (5 niveaux)
  // ========================================
  {
    code: 'BOX_OPENER_FIRST',
    name: 'Première Box',
    description: 'Ouvre ta première mystery box',
    emoji: '📦1️⃣',
    rarity: 'common',
    category: 'mystery_box',
    condition_type: 'mystery_box_open',
    condition_value: 1
  },
  {
    code: 'BOX_OPENER_10',
    name: 'Déballeur Débutant',
    description: 'Ouvre 10 mystery boxes',
    emoji: '📦🔟',
    rarity: 'common',
    category: 'mystery_box',
    condition_type: 'mystery_box_open',
    condition_value: 10
  },
  {
    code: 'BOX_OPENER_50',
    name: 'Déballeur Régulier',
    description: 'Ouvre 50 mystery boxes',
    emoji: '📦5️⃣0️⃣',
    rarity: 'uncommon',
    category: 'mystery_box',
    condition_type: 'mystery_box_open',
    condition_value: 50
  },
  {
    code: 'BOX_OPENER_100',
    name: 'Déballeur Expert',
    description: 'Ouvre 100 mystery boxes',
    emoji: '📦💯',
    rarity: 'rare',
    category: 'mystery_box',
    condition_type: 'mystery_box_open',
    condition_value: 100
  },
  {
    code: 'BOX_OPENER_500',
    name: 'Maître Déballeur',
    description: 'Ouvre 500 mystery boxes',
    emoji: '📦👑',
    rarity: 'epic',
    category: 'mystery_box',
    condition_type: 'mystery_box_open',
    condition_value: 500
  },
  {
    code: 'BOX_OPENER_1000',
    name: 'Légende des Mystery Box',
    description: 'Ouvre 1000 mystery boxes',
    emoji: '📦✨👑',
    rarity: 'legendary',
    category: 'mystery_box',
    condition_type: 'mystery_box_open',
    condition_value: 1000
  }
];

async function seedBadges() {
  console.log('🏆 Seeding des badges V3 - Progressions étendues...\n');
  console.log('='.repeat(70));

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const badge of NEW_BADGES_V3) {
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

      console.log(`✅ ${badge.code} → ${badge.name} (${badge.category}, ${badge.rarity})`);
      created++;
    } catch (error) {
      console.error(`❌ Erreur ${badge.code}:`, error.message);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📊 Résumé:`);
  console.log(`   ✅ Créés: ${created}`);
  console.log(`   ⏭️  Ignorés: ${skipped}`);
  console.log(`   ❌ Erreurs: ${errors}`);
  console.log(`   📋 Total traités: ${NEW_BADGES_V3.length}`);

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

  // Statistiques par type de condition
  console.log('\n📊 Par condition_type:');
  const conditionTypes = await db.queryAll(`
    SELECT condition_type, COUNT(*) as count,
           MIN(condition_value) as min_val,
           MAX(condition_value) as max_val
    FROM badges
    WHERE condition_type IS NOT NULL
    GROUP BY condition_type
    ORDER BY condition_type
  `);
  for (const ct of conditionTypes) {
    console.log(`   ${ct.condition_type}: ${ct.count} badges (${ct.min_val} → ${ct.max_val})`);
  }
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
