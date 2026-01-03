/**
 * Script de seeding pour le badge Emoji-Puzzle (1 emoji = victoire)
 *
 * Ce badge est débloqué quand un joueur résout un emoji-puzzle
 * en devinant la réponse avec seulement 1 emoji révélé.
 */

const db = require('../utils/database-pg');

const EMOJI_PUZZLE_BADGE = {
  code: 'EMOJI_PUZZLE_FIRST_TRY',
  name: 'Génie des Emojis',
  description: 'Résoudre un puzzle emoji avec un seul emoji révélé',
  emoji: '🧩✨',
  color: '#9B59B6',          // Violet = Epic
  rarity: 'epic',            // Rare feat = epic badge
  category: 'mission',
  condition_type: 'custom',  // Custom car débloqué via hook direct
  condition_target: 'emoji_puzzle_one_emoji', // Identifiant custom
  condition_value: 1,
  display_order: 100,
  is_secret: false
};

async function seedEmojiPuzzleBadge() {
  try {
    console.log('🧩 Seeding du badge Emoji-Puzzle...\n');

    // Vérifier si le badge existe déjà
    const existing = await db.queryOne(
      `SELECT * FROM badges WHERE code = $1`,
      [EMOJI_PUZZLE_BADGE.code]
    );

    if (existing) {
      console.log(`⚠️ Badge "${EMOJI_PUZZLE_BADGE.code}" existe déjà (ID: ${existing.id})`);
      console.log('   Mise à jour des données...');

      await db.query(
        `UPDATE badges SET
          name = $1,
          description = $2,
          emoji = $3,
          color = $4,
          rarity = $5,
          category = $6,
          condition_type = $7,
          condition_target = $8,
          condition_value = $9,
          display_order = $10,
          is_secret = $11
        WHERE code = $12`,
        [
          EMOJI_PUZZLE_BADGE.name,
          EMOJI_PUZZLE_BADGE.description,
          EMOJI_PUZZLE_BADGE.emoji,
          EMOJI_PUZZLE_BADGE.color,
          EMOJI_PUZZLE_BADGE.rarity,
          EMOJI_PUZZLE_BADGE.category,
          EMOJI_PUZZLE_BADGE.condition_type,
          EMOJI_PUZZLE_BADGE.condition_target,
          EMOJI_PUZZLE_BADGE.condition_value,
          EMOJI_PUZZLE_BADGE.display_order,
          EMOJI_PUZZLE_BADGE.is_secret,
          EMOJI_PUZZLE_BADGE.code
        ]
      );

      console.log('✅ Badge mis à jour avec succès!');

    } else {
      console.log(`📝 Création du badge "${EMOJI_PUZZLE_BADGE.code}"...`);

      const result = await db.query(
        `INSERT INTO badges (
          code, name, description, emoji, color, rarity, category,
          condition_type, condition_target, condition_value, display_order, is_secret
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
        [
          EMOJI_PUZZLE_BADGE.code,
          EMOJI_PUZZLE_BADGE.name,
          EMOJI_PUZZLE_BADGE.description,
          EMOJI_PUZZLE_BADGE.emoji,
          EMOJI_PUZZLE_BADGE.color,
          EMOJI_PUZZLE_BADGE.rarity,
          EMOJI_PUZZLE_BADGE.category,
          EMOJI_PUZZLE_BADGE.condition_type,
          EMOJI_PUZZLE_BADGE.condition_target,
          EMOJI_PUZZLE_BADGE.condition_value,
          EMOJI_PUZZLE_BADGE.display_order,
          EMOJI_PUZZLE_BADGE.is_secret
        ]
      );

      console.log(`✅ Badge créé avec succès! (ID: ${result.rows[0].id})`);
    }

    // Afficher le badge créé
    const badge = await db.queryOne(
      `SELECT * FROM badges WHERE code = $1`,
      [EMOJI_PUZZLE_BADGE.code]
    );

    console.log('\n📊 Badge en DB:');
    console.table([{
      ID: badge.id,
      Code: badge.code,
      Nom: badge.name,
      Emoji: badge.emoji,
      Rareté: badge.rarity,
      Catégorie: badge.category
    }]);

    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

seedEmojiPuzzleBadge();
