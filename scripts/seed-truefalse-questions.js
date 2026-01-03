const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624';

// 30 questions Vrai/Faux variées avec différentes difficultés
const questions = [
  // FACILE (10 questions)
  { question: "Le soleil se lève à l'est.", answer: "vrai", difficulty: "easy", hint: "Pensez à l'orientation" },
  { question: "L'eau bout à 100°C au niveau de la mer.", answer: "vrai", difficulty: "easy", hint: "Température standard" },
  { question: "Les poissons peuvent vivre hors de l'eau indéfiniment.", answer: "faux", difficulty: "easy", hint: "Ils ont besoin de quelque chose pour respirer" },
  { question: "La Terre est plate.", answer: "faux", difficulty: "easy", hint: "Pensez aux photos satellites" },
  { question: "Paris est la capitale de la France.", answer: "vrai", difficulty: "easy", hint: "Ville lumière" },
  { question: "Les oiseaux sont des mammifères.", answer: "faux", difficulty: "easy", hint: "Ils pondent des oeufs" },
  { question: "Un triangle a 4 côtés.", answer: "faux", difficulty: "easy", hint: "Comptez les côtés" },
  { question: "Le chocolat est fabriqué à partir de cacao.", answer: "vrai", difficulty: "easy", hint: "Fèves tropicales" },
  { question: "L'hiver est plus froid que l'été.", answer: "vrai", difficulty: "easy", hint: "Saisons" },
  { question: "Les chats peuvent miauler.", answer: "vrai", difficulty: "easy", hint: "Son typique" },

  // MOYEN (12 questions)
  { question: "La Grande Muraille de Chine est visible depuis l'espace à l'œil nu.", answer: "faux", difficulty: "medium", hint: "Mythe populaire" },
  { question: "Mozart est né en Autriche.", answer: "vrai", difficulty: "medium", hint: "Salzbourg" },
  { question: "Les éléphants sont les plus grands animaux terrestres.", answer: "vrai", difficulty: "medium", hint: "Mammifères géants" },
  { question: "Le son se propage plus vite dans l'eau que dans l'air.", answer: "vrai", difficulty: "medium", hint: "Densité du milieu" },
  { question: "Napoléon était de grande taille.", answer: "faux", difficulty: "medium", hint: "Environ 1m68" },
  { question: "Les dauphins sont des poissons.", answer: "faux", difficulty: "medium", hint: "Ils allaitent leurs petits" },
  { question: "Le Brésil est le plus grand pays d'Amérique du Sud.", answer: "vrai", difficulty: "medium", hint: "Superficie" },
  { question: "Vincent Van Gogh s'est coupé l'oreille.", answer: "vrai", difficulty: "medium", hint: "Artiste tourmenté" },
  { question: "La Lune a sa propre lumière.", answer: "faux", difficulty: "medium", hint: "Elle reflète" },
  { question: "Les pandas géants mangent principalement du bambou.", answer: "vrai", difficulty: "medium", hint: "Régime alimentaire" },
  { question: "L'ADN est une protéine.", answer: "faux", difficulty: "medium", hint: "Acide nucléique" },
  { question: "Le cœur humain a 4 chambres.", answer: "vrai", difficulty: "medium", hint: "Oreillettes et ventricules" },

  // DIFFICILE (8 questions)
  { question: "La vitesse de la lumière est d'environ 300 000 km/s.", answer: "vrai", difficulty: "hard", hint: "Constante physique" },
  { question: "La Tour Eiffel a été construite pour l'Exposition universelle de 1900.", answer: "faux", difficulty: "hard", hint: "C'était 11 ans plus tôt" },
  { question: "Le plus long fleuve du monde est le Nil.", answer: "faux", difficulty: "hard", hint: "L'Amazone le dépasse légèrement" },
  { question: "Marie Curie a reçu deux prix Nobel dans des domaines différents.", answer: "vrai", difficulty: "hard", hint: "Physique et Chimie" },
  { question: "Le diamant est le minéral le plus dur sur l'échelle de Mohs.", answer: "vrai", difficulty: "hard", hint: "Échelle de 1 à 10" },
  { question: "Les Vikings portaient des casques à cornes.", answer: "faux", difficulty: "hard", hint: "Mythe hollywoodien" },
  { question: "Le Japon compte plus de 6000 îles.", answer: "vrai", difficulty: "hard", hint: "Archipel" },
  { question: "Cléopâtre était égyptienne de naissance.", answer: "faux", difficulty: "hard", hint: "Dynastie ptolémaïque, origine grecque" }
];

async function seedQuestions() {
  try {
    console.log('🔍 Vérification du thème actif...');

    const theme = await db.queryOne(
      'SELECT id, name FROM themes WHERE guild_id = $1 AND is_active = true',
      [GUILD_ID]
    );

    if (!theme) {
      console.error('❌ Aucun thème actif trouvé !');
      process.exit(1);
    }

    console.log(`✅ Thème actif: ${theme.name} (ID: ${theme.id})`);

    // Chercher une mission true-false existante
    let mission = await db.queryOne(
      "SELECT id, name FROM missions WHERE guild_id = $1 AND theme_id = $2 AND type = 'true-false'",
      [GUILD_ID, theme.id]
    );

    if (!mission) {
      console.log('📝 Création d\'une mission Vrai/Faux...');
      mission = await db.queryOne(
        `INSERT INTO missions (guild_id, theme_id, mission_id, name, type, description, validation_type, timeout, max_attempts, reward_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, name`,
        [GUILD_ID, theme.id, 'vrai-faux-test', 'Vrai ou Faux', 'true-false',
         'Réponds correctement aux affirmations Vrai ou Faux !', 'auto', 15, 3, 'random-collectible']
      );
      console.log(`✅ Mission créée: ${mission.name} (ID: ${mission.id})`);
    } else {
      console.log(`✅ Mission existante: ${mission.name} (ID: ${mission.id})`);
    }

    // Compter les questions existantes
    const existingCount = await db.queryOne(
      "SELECT COUNT(*) as count FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2",
      [GUILD_ID, mission.id]
    );

    console.log(`📊 Questions existantes: ${existingCount.count}`);

    // Ajouter les 30 questions
    console.log('\n📝 Ajout des 30 questions Vrai/Faux...\n');

    let added = 0;
    for (const q of questions) {
      try {
        await db.addQuizQuestion(
          GUILD_ID,
          theme.id,
          q.question,
          q.answer,
          [], // pas de mauvaises réponses pour V/F
          q.hint,
          q.difficulty,
          mission.id
        );
        const emoji = q.difficulty === 'easy' ? '🟢' : q.difficulty === 'medium' ? '🟡' : '🔴';
        const answerEmoji = q.answer === 'vrai' ? '✅' : '❌';
        console.log(`${emoji} ${answerEmoji} ${q.question.substring(0, 50)}...`);
        added++;
      } catch (error) {
        console.error(`❌ Erreur pour "${q.question.substring(0, 30)}...": ${error.message}`);
      }
    }

    console.log(`\n✅ ${added} questions ajoutées avec succès !`);
    console.log('\n📊 Récapitulatif:');
    console.log(`   🟢 Facile: 10 questions`);
    console.log(`   🟡 Moyen: 12 questions`);
    console.log(`   🔴 Difficile: 8 questions`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

seedQuestions();
