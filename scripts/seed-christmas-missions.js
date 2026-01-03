/**
 * Script de seeding pour les missions de Noël
 * - Mission Emoji-Puzzle (25 puzzles)
 * - Mission Vrai/Faux (30 questions)
 *
 * Serveur: 1248028543389143070
 * Thème: CALENDRIER DE NOËL (ID: 47)
 */

const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';
const THEME_ID = 47;

// ============================================
// MISSION EMOJI-PUZZLE
// ============================================
const EMOJI_PUZZLE_MISSION = {
  name: 'Énigmes de Noël 🎄',
  description: 'Devine les mots et expressions de Noël cachés derrière les emojis !',
  type: 'emoji-puzzle',
  timeout: 30,
  max_attempts: 3,
  reward_type: 'random-collectible'
};

const EMOJI_PUZZLES = [
  // EASY (8)
  { emojis: '🛷🎁🎅🏻', answer: 'Père Noël', alternatives: ['Santa', 'Papa Noël', 'Saint Nicolas', 'Pere Noel'], difficulty: 'easy', hint: 'Il distribue les cadeaux' },
  { emojis: '✨⭐🎄', answer: 'Sapin de Noël', alternatives: ['Sapin', 'Arbre de Noël', 'Sapin de Noel'], difficulty: 'easy', hint: 'Il trône dans le salon' },
  { emojis: '❤️🎀🎁', answer: 'Cadeau', alternatives: ['Cadeaux', 'Present', 'Présent'], difficulty: 'easy', hint: 'On l\'ouvre le 25' },
  { emojis: '❄️🥕⛄', answer: 'Bonhomme de neige', alternatives: ['Bonhomme neige', 'Snowman'], difficulty: 'easy', hint: 'Nez en carotte' },
  { emojis: '🦌👃🔴', answer: 'Rudolph', alternatives: ['Rodolphe', 'Rudolf', 'Renne au nez rouge', 'Renne'], difficulty: 'easy', hint: 'Le renne au nez rouge' },
  { emojis: '🎅🥛🍪', answer: 'Lait et biscuits', alternatives: ['Biscuits et lait', 'Cookies', 'Lait biscuits', 'Cookies et lait'], difficulty: 'easy', hint: 'Pour le Père Noël' },
  { emojis: '❄️🦌🛷', answer: 'Traîneau', alternatives: ['Traineau', 'Luge'], difficulty: 'easy', hint: 'Véhicule volant' },
  { emojis: '🔥🎁🧦', answer: 'Chaussette de Noël', alternatives: ['Chaussette', 'Chaussette Noel', 'Bas de Noël'], difficulty: 'easy', hint: 'On y met les cadeaux' },

  // MEDIUM (9)
  { emojis: '🎄🎵🔔', answer: 'Jingle Bells', alternatives: ['Vive le vent', 'Clochettes'], difficulty: 'medium', hint: 'Chanson célèbre' },
  { emojis: '❄️☕🍫', answer: 'Chocolat chaud', alternatives: ['Cacao', 'Chocolat', 'Boisson chaude'], difficulty: 'medium', hint: 'Boisson réconfortante' },
  { emojis: '😋🔥🌰', answer: 'Marrons chauds', alternatives: ['Marrons', 'Châtaignes', 'Chataignes'], difficulty: 'medium', hint: 'On les grille' },
  { emojis: '🍫🎄🪵', answer: 'Bûche de Noël', alternatives: ['Buche', 'Bûche', 'Buche de Noel'], difficulty: 'medium', hint: 'Dessert traditionnel' },
  { emojis: '👨‍👩‍👧‍👦🍽️🦃', answer: 'Dinde de Noël', alternatives: ['Dinde', 'Repas de Noël', 'Dinde Noel'], difficulty: 'medium', hint: 'Plat principal en famille' },
  { emojis: '1️⃣➡️2️⃣4️⃣🍫📅', answer: 'Calendrier de l\'Avent', alternatives: ['Calendrier', 'Avent', 'Calendrier Avent'], difficulty: 'medium', hint: 'Compte à rebours sucré' },
  { emojis: '🎄🌟👼', answer: 'Ange du sapin', alternatives: ['Ange', 'Ange de Noël', 'Decoration sapin'], difficulty: 'medium', hint: 'Décoration au sommet' },
  { emojis: '❄️💋🌿', answer: 'Gui', alternatives: ['Le gui', 'Branche de gui'], difficulty: 'medium', hint: 'On s\'embrasse dessous' },
  { emojis: '🚪👧👦🎵', answer: 'Chants de Noël', alternatives: ['Chansons de Noël', 'Carols', 'Cantiques', 'Chants Noel'], difficulty: 'medium', hint: 'De porte en porte' },

  // HARD (8)
  { emojis: '❄️🏔️🏠', answer: 'Chalet', alternatives: ['Chalet de montagne', 'Maison montagne'], difficulty: 'hard', hint: 'Vacances d\'hiver' },
  { emojis: '🎆🥂🍾', answer: 'Réveillon', alternatives: ['Reveillon', 'Nouvel An', 'Saint Sylvestre', 'Fête'], difficulty: 'hard', hint: 'Fête du 31' },
  { emojis: '🎅😴✨🌙', answer: 'Nuit de Noël', alternatives: ['Douce nuit', 'Nuit Noel', 'Veille de Noël'], difficulty: 'hard', hint: '"Douce nuit..."' },
  { emojis: '🦌❄️🎅🇫🇮', answer: 'Laponie', alternatives: ['Finlande', 'Pays Pere Noel'], difficulty: 'hard', hint: 'Pays du Père Noël' },
  { emojis: '🐪👑👑👑⭐', answer: 'Rois Mages', alternatives: ['Trois Rois Mages', 'Mages', '3 rois', 'Les rois mages'], difficulty: 'hard', hint: 'Ils suivent l\'étoile' },
  { emojis: '🌿🕯️🕯️🕯️🕯️', answer: 'Couronne de l\'Avent', alternatives: ['Couronne', 'Avent', 'Couronne Avent'], difficulty: 'hard', hint: '4 dimanches avant Noël' },
  { emojis: '👨‍👩‍👧🪓🌲', answer: 'Couper le sapin', alternatives: ['Chercher le sapin', 'Sapin', 'Couper sapin'], difficulty: 'hard', hint: 'Tradition familiale' },
  { emojis: '❤️👨‍👩‍👧‍👦✨🎄', answer: 'Magie de Noël', alternatives: ['Esprit de Noël', 'Noël', 'Magie Noel'], difficulty: 'hard', hint: 'L\'esprit des fêtes' }
];

// ============================================
// MISSION VRAI/FAUX
// ============================================
const TRUE_FALSE_MISSION = {
  name: 'Vrai ou Faux de Noël ✅❌',
  description: 'Teste tes connaissances sur les traditions et secrets de Noël !',
  type: 'true-false',
  timeout: 20,
  max_attempts: 3,
  reward_type: 'random-collectible'
};

const TRUE_FALSE_QUESTIONS = [
  // EASY (10)
  { question: 'Le Père Noël porte traditionnellement un costume rouge.', answer: 'vrai', difficulty: 'easy', hint: 'Couleur iconique' },
  { question: 'Noël se fête le 24 décembre.', answer: 'faux', difficulty: 'easy', hint: 'C\'est le 25 !' },
  { question: 'Rudolph est le renne au nez rouge.', answer: 'vrai', difficulty: 'easy', hint: 'Le plus célèbre' },
  { question: 'Le Père Noël habite au Pôle Sud avec les pingouins.', answer: 'faux', difficulty: 'easy', hint: 'Mauvais pôle !' },
  { question: 'La bûche de Noël est un dessert traditionnel français.', answer: 'vrai', difficulty: 'easy', hint: 'Tradition culinaire' },
  { question: 'Les rennes peuvent vraiment voler dans la nature.', answer: 'faux', difficulty: 'easy', hint: 'Seulement dans la magie' },
  { question: 'On décore le sapin avec des guirlandes et des boules.', answer: 'vrai', difficulty: 'easy', hint: 'Décorations classiques' },
  { question: 'Le calendrier de l\'Avent compte 25 cases.', answer: 'faux', difficulty: 'easy', hint: '24 cases !' },
  { question: 'Les lutins aident le Père Noël à fabriquer les jouets.', answer: 'vrai', difficulty: 'easy', hint: 'Selon la légende' },
  { question: '"Joyeux Noël" se dit "Merry Christmas" en anglais.', answer: 'vrai', difficulty: 'easy', hint: 'Traduction exacte' },

  // MEDIUM (12)
  { question: 'La chanson "Jingle Bells" a été écrite pour Thanksgiving, pas pour Noël.', answer: 'vrai', difficulty: 'medium', hint: 'Surprise historique' },
  { question: 'Le Père Noël a exactement 8 rennes.', answer: 'faux', difficulty: 'medium', hint: '9 avec Rudolph !' },
  { question: 'Saint Nicolas, qui a inspiré le Père Noël, était un évêque turc.', answer: 'vrai', difficulty: 'medium', hint: 'Histoire vraie' },
  { question: 'La tradition du calendrier de l\'Avent vient de France.', answer: 'faux', difficulty: 'medium', hint: 'Allemagne !' },
  { question: 'Au Japon, la tradition est de manger du KFC à Noël.', answer: 'vrai', difficulty: 'medium', hint: 'Incroyable mais vrai' },
  { question: 'Le mot "Noël" vient du latin "natalis" (naissance).', answer: 'vrai', difficulty: 'medium', hint: 'Étymologie' },
  { question: 'Les premiers sapins de Noël étaient décorés avec des pommes.', answer: 'vrai', difficulty: 'medium', hint: 'Avant les boules' },
  { question: 'Le Père Noël descend par la fenêtre.', answer: 'faux', difficulty: 'medium', hint: 'Par la cheminée !' },
  { question: 'Le houx est une plante typique de Noël.', answer: 'vrai', difficulty: 'medium', hint: 'Décoration traditionnelle' },
  { question: 'La tradition de s\'embrasser sous le gui est d\'origine romaine.', answer: 'faux', difficulty: 'medium', hint: 'Origine nordique/celte' },
  { question: 'Le Boxing Day (26 décembre) tire son nom de la boxe.', answer: 'faux', difficulty: 'medium', hint: 'Des boîtes de cadeaux' },
  { question: 'La couronne de l\'Avent a 4 bougies.', answer: 'vrai', difficulty: 'medium', hint: '4 dimanches' },

  // HARD (8)
  { question: 'La chanson "Douce Nuit" (Stille Nacht) a été composée en Autriche en 1818.', answer: 'vrai', difficulty: 'hard', hint: 'Chef-d\'œuvre autrichien' },
  { question: 'Le Père Noël finlandais s\'appelle Joulupukki, ce qui signifie "chèvre de Noël".', answer: 'vrai', difficulty: 'hard', hint: 'Étrange mais vrai !' },
  { question: 'Le poinsettia (Étoile de Noël) est une plante toxique pour les animaux.', answer: 'vrai', difficulty: 'hard', hint: 'Attention aux chats !' },
  { question: 'En Islande, il y a 13 Pères Noël appelés les "Yule Lads".', answer: 'vrai', difficulty: 'hard', hint: 'Tradition unique' },
  { question: 'Coca-Cola a inventé le Père Noël rouge en 1931.', answer: 'faux', difficulty: 'hard', hint: 'Il existait déjà rouge avant' },
  { question: 'Le premier sapin de Noël à la Maison Blanche date de 1889.', answer: 'faux', difficulty: 'hard', hint: '1856 par Franklin Pierce' },
  { question: 'Les premières cartes de Noël ont été créées à Londres en 1843.', answer: 'vrai', difficulty: 'hard', hint: 'Par Henry Cole' },
  { question: 'La crèche de Noël a été inventée par Saint François d\'Assise en 1223.', answer: 'vrai', difficulty: 'hard', hint: 'Tradition italienne' }
];

async function seedChristmasMissions() {
  try {
    console.log('🎄 SEEDING DES MISSIONS DE NOËL\n');
    console.log('='.repeat(60));
    console.log(`📍 Serveur: ${GUILD_ID}`);
    console.log(`🎨 Thème ID: ${THEME_ID}`);
    console.log('='.repeat(60) + '\n');

    // ============================================
    // 1. MISSION EMOJI-PUZZLE
    // ============================================
    console.log('🧩 MISSION EMOJI-PUZZLE\n');

    // Vérifier si la mission existe déjà
    let emojiMission = await db.queryOne(
      `SELECT id, name FROM missions WHERE guild_id = $1 AND theme_id = $2 AND type = 'emoji-puzzle'`,
      [GUILD_ID, THEME_ID]
    );

    if (emojiMission) {
      console.log(`⚠️ Mission emoji-puzzle existe déjà (ID: ${emojiMission.id})`);
    } else {
      // Créer la mission
      await db.query(
        `INSERT INTO missions (guild_id, theme_id, mission_id, name, type, description, validation_type, timeout, max_attempts, reward_type)
         VALUES ($1, $2, $3, $4, $5, $6, 'auto', $7, $8, $9)`,
        [GUILD_ID, THEME_ID, 'noel-emoji-puzzle', EMOJI_PUZZLE_MISSION.name, EMOJI_PUZZLE_MISSION.type,
         EMOJI_PUZZLE_MISSION.description, EMOJI_PUZZLE_MISSION.timeout,
         EMOJI_PUZZLE_MISSION.max_attempts, EMOJI_PUZZLE_MISSION.reward_type]
      );
      // Récupérer l'ID créé
      emojiMission = await db.queryOne(
        `SELECT id FROM missions WHERE guild_id = $1 AND theme_id = $2 AND mission_id = $3`,
        [GUILD_ID, THEME_ID, 'noel-emoji-puzzle']
      );
      console.log(`✅ Mission créée: ${EMOJI_PUZZLE_MISSION.name} (ID: ${emojiMission.id})`);
    }

    // Ajouter les puzzles
    console.log('\n📝 Ajout des puzzles emoji...');
    let emojiAdded = 0;
    for (const puzzle of EMOJI_PUZZLES) {
      try {
        // Vérifier si le puzzle existe déjà
        const existing = await db.queryOne(
          `SELECT id FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2 AND question_text = $3`,
          [GUILD_ID, emojiMission.id, puzzle.emojis]
        );

        if (!existing) {
          await db.query(
            `INSERT INTO quiz_questions (guild_id, theme_id, mission_id, question_text, correct_answer, wrong_answers, hint, difficulty)
             VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8)`,
            [GUILD_ID, THEME_ID, emojiMission.id, puzzle.emojis, puzzle.answer,
             puzzle.alternatives || [], puzzle.hint, puzzle.difficulty]
          );
          emojiAdded++;
          const emoji = puzzle.difficulty === 'easy' ? '🟢' : puzzle.difficulty === 'medium' ? '🟡' : '🔴';
          console.log(`   ${emoji} ${puzzle.emojis} → ${puzzle.answer}`);
        }
      } catch (err) {
        console.error(`   ❌ Erreur: ${err.message}`);
      }
    }
    console.log(`\n✅ ${emojiAdded} puzzles ajoutés`);

    // ============================================
    // 2. MISSION VRAI/FAUX
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('✅❌ MISSION VRAI/FAUX\n');

    // Vérifier si la mission existe déjà
    let tfMission = await db.queryOne(
      `SELECT id, name FROM missions WHERE guild_id = $1 AND theme_id = $2 AND type = 'true-false'`,
      [GUILD_ID, THEME_ID]
    );

    if (tfMission) {
      console.log(`⚠️ Mission true-false existe déjà (ID: ${tfMission.id})`);
    } else {
      // Créer la mission
      await db.query(
        `INSERT INTO missions (guild_id, theme_id, mission_id, name, type, description, validation_type, timeout, max_attempts, reward_type)
         VALUES ($1, $2, $3, $4, $5, $6, 'auto', $7, $8, $9)`,
        [GUILD_ID, THEME_ID, 'noel-vrai-faux', TRUE_FALSE_MISSION.name, TRUE_FALSE_MISSION.type,
         TRUE_FALSE_MISSION.description, TRUE_FALSE_MISSION.timeout,
         TRUE_FALSE_MISSION.max_attempts, TRUE_FALSE_MISSION.reward_type]
      );
      // Récupérer l'ID créé
      tfMission = await db.queryOne(
        `SELECT id FROM missions WHERE guild_id = $1 AND theme_id = $2 AND mission_id = $3`,
        [GUILD_ID, THEME_ID, 'noel-vrai-faux']
      );
      console.log(`✅ Mission créée: ${TRUE_FALSE_MISSION.name} (ID: ${tfMission.id})`);
    }

    // Ajouter les questions
    console.log('\n📝 Ajout des questions Vrai/Faux...');
    let tfAdded = 0;
    for (const q of TRUE_FALSE_QUESTIONS) {
      try {
        // Vérifier si la question existe déjà
        const existing = await db.queryOne(
          `SELECT id FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2 AND question_text = $3`,
          [GUILD_ID, tfMission.id, q.question]
        );

        if (!existing) {
          await db.query(
            `INSERT INTO quiz_questions (guild_id, theme_id, mission_id, question_text, correct_answer, wrong_answers, hint, difficulty)
             VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8)`,
            [GUILD_ID, THEME_ID, tfMission.id, q.question, q.answer,
             [], q.hint, q.difficulty]
          );
          tfAdded++;
          const emoji = q.difficulty === 'easy' ? '🟢' : q.difficulty === 'medium' ? '🟡' : '🔴';
          const answerEmoji = q.answer === 'vrai' ? '✅' : '❌';
          console.log(`   ${emoji} ${answerEmoji} ${q.question.substring(0, 50)}...`);
        }
      } catch (err) {
        console.error(`   ❌ Erreur: ${err.message}`);
      }
    }
    console.log(`\n✅ ${tfAdded} questions ajoutées`);

    // ============================================
    // RÉSUMÉ
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DU SEEDING\n');
    console.log(`🧩 Mission Emoji-Puzzle: ${emojiAdded} puzzles`);
    console.log(`   🟢 Facile: 8 | 🟡 Moyen: 9 | 🔴 Difficile: 8`);
    console.log(`\n✅❌ Mission Vrai/Faux: ${tfAdded} questions`);
    console.log(`   🟢 Facile: 10 | 🟡 Moyen: 12 | 🔴 Difficile: 8`);
    console.log('\n🎄 Seeding terminé avec succès !');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 Erreur:', error);
    process.exit(1);
  }
}

seedChristmasMissions();
