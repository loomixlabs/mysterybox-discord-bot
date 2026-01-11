/**
 * Seed: Créer les badges liés au piège "Shame Nickname"
 *
 * Catégories de badges:
 * 1. Badges de victime (nombre de fois piégé)
 * 2. Badges de résistance (tentatives de fuite)
 * 3. Badges de survie (durée totale piégé)
 */

require('dotenv').config();
const db = require('../utils/database-pg');

const SHAME_NICKNAME_BADGES = [
  // === BADGES VICTIME (nombre de fois piégé) ===
  {
    code: 'SHAME_FIRST_VICTIM',
    name: 'Première Honte',
    description: 'Tu as subi ton premier piège Pseudo Honteux ! Bienvenue au club !',
    emoji: '🎭',
    category: 'trap',
    rarity: 'common',
    color: '#E91E63',
    condition_type: 'shame_nickname_count',
    condition_value: 1,
    is_hidden: false,
    is_active: true,
    points: 10
  },
  {
    code: 'SHAME_REGULAR_VICTIM',
    name: 'Victime Régulière',
    description: 'Tu as été piégé 5 fois. Les pseudos honteux te suivent !',
    emoji: '🎭🔄',
    category: 'trap',
    rarity: 'rare',
    color: '#9C27B0',
    condition_type: 'shame_nickname_count',
    condition_value: 5,
    is_hidden: false,
    is_active: true,
    points: 25
  },
  {
    code: 'SHAME_SERIAL_VICTIM',
    name: 'Victime en Série',
    description: 'Tu as été piégé 15 fois. Tu es une légende... de la malchance !',
    emoji: '🎭👑',
    category: 'trap',
    rarity: 'epic',
    color: '#673AB7',
    condition_type: 'shame_nickname_count',
    condition_value: 15,
    is_hidden: false,
    is_active: true,
    points: 50
  },
  {
    code: 'SHAME_ETERNAL_VICTIM',
    name: 'Victime Éternelle',
    description: 'Tu as été piégé 50 fois. Le serveur te connaît par tous tes pseudos honteux !',
    emoji: '🎭💀',
    category: 'trap',
    rarity: 'legendary',
    color: '#F44336',
    condition_type: 'shame_nickname_count',
    condition_value: 50,
    is_hidden: false,
    is_active: true,
    points: 100
  },

  // === BADGES RÉSISTANCE (tentatives de fuite) ===
  {
    code: 'SHAME_FIRST_ESCAPE_ATTEMPT',
    name: 'Première Tentative',
    description: 'Tu as essayé de changer ton pseudo honteux... en vain !',
    emoji: '🏃',
    category: 'trap',
    rarity: 'common',
    color: '#FF9800',
    condition_type: 'shame_escape_attempts',
    condition_value: 1,
    is_hidden: false,
    is_active: true,
    points: 5
  },
  {
    code: 'SHAME_PERSISTENT_ESCAPEE',
    name: 'Fuyard Persistant',
    description: 'Tu as tenté 10 fois de t\'échapper. Le sortilège est plus fort !',
    emoji: '🏃💨',
    category: 'trap',
    rarity: 'rare',
    color: '#FF5722',
    condition_type: 'shame_escape_attempts',
    condition_value: 10,
    is_hidden: false,
    is_active: true,
    points: 20
  },
  {
    code: 'SHAME_DESPERATE_ESCAPEE',
    name: 'Fuyard Désespéré',
    description: 'Tu as tenté 50 fois de t\'échapper. Tu n\'abandonnes jamais !',
    emoji: '🏃🔥',
    category: 'trap',
    rarity: 'epic',
    color: '#E64A19',
    condition_type: 'shame_escape_attempts',
    condition_value: 50,
    is_hidden: false,
    is_active: true,
    points: 40
  },
  {
    code: 'SHAME_ESCAPE_LEGEND',
    name: 'Légende de la Fuite',
    description: 'Tu as tenté 200 fois de t\'échapper. Ta détermination est légendaire... mais inutile !',
    emoji: '🏃👑',
    category: 'trap',
    rarity: 'legendary',
    color: '#BF360C',
    condition_type: 'shame_escape_attempts',
    condition_value: 200,
    is_hidden: true, // Caché car très rare
    is_active: true,
    points: 100
  },

  // === BADGES SURVIE (durée totale) ===
  {
    code: 'SHAME_HOUR_SURVIVOR',
    name: 'Survivant d\'une Heure',
    description: 'Tu as survécu à 1 heure cumulée de pseudo honteux !',
    emoji: '⏰',
    category: 'trap',
    rarity: 'common',
    color: '#00BCD4',
    condition_type: 'shame_total_minutes',
    condition_value: 60, // 1 heure
    is_hidden: false,
    is_active: true,
    points: 15
  },
  {
    code: 'SHAME_DAY_SURVIVOR',
    name: 'Survivant d\'un Jour',
    description: 'Tu as survécu à 24 heures cumulées de pseudo honteux !',
    emoji: '⏰🌙',
    category: 'trap',
    rarity: 'rare',
    color: '#0097A7',
    condition_type: 'shame_total_minutes',
    condition_value: 1440, // 24 heures
    is_hidden: false,
    is_active: true,
    points: 35
  },
  {
    code: 'SHAME_WEEK_SURVIVOR',
    name: 'Survivant d\'une Semaine',
    description: 'Tu as survécu à 1 semaine cumulée de pseudo honteux ! Impressionnant... ou inquiétant ?',
    emoji: '⏰📅',
    category: 'trap',
    rarity: 'epic',
    color: '#00796B',
    condition_type: 'shame_total_minutes',
    condition_value: 10080, // 7 jours
    is_hidden: false,
    is_active: true,
    points: 75
  },
  {
    code: 'SHAME_MONTH_SURVIVOR',
    name: 'Martyr du Mois',
    description: 'Tu as survécu à 30 jours cumulés de pseudo honteux ! Tu mérites un monument !',
    emoji: '⏰🏆',
    category: 'trap',
    rarity: 'legendary',
    color: '#004D40',
    condition_type: 'shame_total_minutes',
    condition_value: 43200, // 30 jours
    is_hidden: true, // Caché car extrêmement rare
    is_active: true,
    points: 150
  },

  // === BADGE SPÉCIAL ===
  {
    code: 'SHAME_CLOWN_KING',
    name: 'Roi des Clowns',
    description: 'Tu as porté le pseudo "Clown" plus de 10 fois. 🤡 Tu es le roi incontesté !',
    emoji: '🤡👑',
    category: 'trap',
    rarity: 'epic',
    color: '#FF1744',
    condition_type: 'shame_clown_count',
    condition_value: 10,
    is_hidden: true,
    is_active: true,
    points: 50
  }
];

async function seedShameNicknameBadges() {
  console.log('🎭 Seed: Création des badges Shame Nickname\n');
  console.log('='.repeat(60));

  try {
    let totalCreated = 0;
    let totalSkipped = 0;

    // Badges globaux (pas de guild_id dans cette table)
    for (const badge of SHAME_NICKNAME_BADGES) {
      // Vérifier si le badge existe déjà
      const existing = await db.queryOne(`
        SELECT id FROM badges
        WHERE code = $1
      `, [badge.code]);

      if (existing) {
        console.log(`⏭️  ${badge.name} existe déjà`);
        totalSkipped++;
        continue;
      }

      // Créer le badge (structure adaptée au VPS)
      await db.query(`
        INSERT INTO badges (
          code, name, description, emoji, category, rarity,
          color, condition_type, condition_value, is_secret
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        badge.code,
        badge.name,
        badge.description,
        badge.emoji,
        badge.category,
        badge.rarity,
        badge.color,
        badge.condition_type,
        badge.condition_value,
        badge.is_hidden || false
      ]);

      console.log(`✅ ${badge.emoji} ${badge.name} (${badge.rarity})`);
      totalCreated++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ SEED TERMINÉ: ${totalCreated} badges créés, ${totalSkipped} ignorés`);
    console.log('='.repeat(60));

    console.log('\n📝 Types de conditions créés:');
    console.log('   - shame_nickname_count: Nombre de fois piégé');
    console.log('   - shame_escape_attempts: Tentatives de fuite cumulées');
    console.log('   - shame_total_minutes: Durée totale piégé (minutes)');
    console.log('   - shame_clown_count: Nombre de fois avec pseudo "Clown"');

    console.log('\n📌 Prochaines étapes:');
    console.log('   1. Ajouter le hook badgeHandler.onShameNicknameTriggered()');
    console.log('   2. Ajouter le hook badgeHandler.onShameNicknameEscapeAttempt()');
    console.log('   3. Ajouter le hook badgeHandler.onShameNicknameExpired()');

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 ERREUR:', error);
    process.exit(1);
  }
}

seedShameNicknameBadges();
