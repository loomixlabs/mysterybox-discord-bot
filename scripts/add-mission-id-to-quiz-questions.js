/**
 * Migration: Ajouter mission_id à quiz_questions pour quiz indépendants
 *
 * Problème: Actuellement les questions sont liées au thème, pas à la mission
 * Solution: Ajouter mission_id pour que chaque quiz ait ses propres questions
 */

const db = require('../utils/database-pg');

async function migrate() {
  console.log('🔄 Migration: Ajout de mission_id à quiz_questions\n');
  console.log('='.repeat(60));

  try {
    // Étape 1: Vérifier si la colonne existe déjà
    const checkColumn = await db.queryAll(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'quiz_questions' AND column_name = 'mission_id'
    `);

    if (checkColumn.length > 0) {
      console.log('⏭️  La colonne mission_id existe déjà');
    } else {
      // Ajouter la colonne mission_id
      await db.query(`
        ALTER TABLE quiz_questions
        ADD COLUMN mission_id INTEGER REFERENCES missions(id) ON DELETE CASCADE
      `);
      console.log('✅ Colonne mission_id ajoutée à quiz_questions');
    }

    // Étape 2: Migrer les questions existantes vers la mission Quiz (id 13)
    // Seulement pour le serveur de test 1248028543389143070
    const testGuildId = '1248028543389143070';

    // Vérifier les questions sans mission_id
    const orphanQuestions = await db.queryAll(`
      SELECT id, question_text
      FROM quiz_questions
      WHERE guild_id = $1 AND mission_id IS NULL
    `, [testGuildId]);

    if (orphanQuestions.length > 0) {
      console.log(`\n📋 ${orphanQuestions.length} questions sans mission_id trouvées`);

      // Trouver la mission Quiz existante (id 13)
      const quizMission = await db.queryOne(`
        SELECT id, name FROM missions
        WHERE guild_id = $1 AND type = 'quiz' AND name = 'Quiz'
        LIMIT 1
      `, [testGuildId]);

      if (quizMission) {
        // Migrer vers la mission existante
        await db.query(`
          UPDATE quiz_questions
          SET mission_id = $1
          WHERE guild_id = $2 AND mission_id IS NULL
        `, [quizMission.id, testGuildId]);

        console.log(`✅ ${orphanQuestions.length} questions migrées vers mission "${quizMission.name}" (id: ${quizMission.id})`);
      } else {
        console.log('⚠️  Aucune mission Quiz trouvée - questions laissées sans mission_id');
      }
    } else {
      console.log('\n✅ Aucune question orpheline à migrer');
    }

    // Étape 3: Vérification finale
    console.log('\n📊 État final de quiz_questions:');
    const stats = await db.queryAll(`
      SELECT
        mission_id,
        m.name as mission_name,
        COUNT(*) as question_count
      FROM quiz_questions qq
      LEFT JOIN missions m ON qq.mission_id = m.id
      WHERE qq.guild_id = $1
      GROUP BY mission_id, m.name
      ORDER BY mission_id
    `, [testGuildId]);

    console.table(stats);

    // Afficher la structure mise à jour
    console.log('\n📋 Structure de quiz_questions:');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'quiz_questions'
      ORDER BY ordinal_position
    `);
    console.table(columns);

    console.log('\n✅ Migration terminée avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

migrate();
