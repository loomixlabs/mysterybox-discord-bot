/**
 * Corriger les quiz_questions orphelines (mission_id = NULL)
 * en les assignant aux bonnes missions basé sur leur contenu
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixOrphanQuestions() {
  try {
    console.log('🔧 CORRECTION DES QUIZ QUESTIONS ORPHELINES\n');
    console.log('='.repeat(80));

    // 1. Harry Potter (theme_id = 58)
    console.log('\n📚 THEME 58 - Harry Potter:');

    // Questions sur les maisons → Quiz des Quatre Maisons (mission id 189)
    const housesUpdate = await pool.query(`
      UPDATE quiz_questions
      SET mission_id = 189
      WHERE theme_id = 58
      AND mission_id IS NULL
      AND (question_text ILIKE '%maison%' OR question_text ILIKE '%gryffondor%'
           OR question_text ILIKE '%serpentard%' OR question_text ILIKE '%serdaigle%'
           OR question_text ILIKE '%poufsouffle%')
      RETURNING id, question_text
    `);
    console.log(`   ✅ Quiz des Quatre Maisons (189): ${housesUpdate.rowCount} questions assignées`);

    // Questions sur les sorts → Quiz des Sortilèges (mission id 190)
    const spellsUpdate = await pool.query(`
      UPDATE quiz_questions
      SET mission_id = 190
      WHERE theme_id = 58
      AND mission_id IS NULL
      AND (question_text ILIKE '%sort%' OR question_text ILIKE '%sortilège%'
           OR question_text ILIKE '%lumos%' OR question_text ILIKE '%patronus%'
           OR question_text ILIKE '%désarmer%')
      RETURNING id, question_text
    `);
    console.log(`   ✅ Quiz des Sortilèges (190): ${spellsUpdate.rowCount} questions assignées`);

    // Questions sur les personnages → Quiz des Personnages (mission id 188)
    const charsUpdate = await pool.query(`
      UPDATE quiz_questions
      SET mission_id = 188
      WHERE theme_id = 58
      AND mission_id IS NULL
      AND (question_text ILIKE '%qui est%' OR question_text ILIKE '%directeur%'
           OR question_text ILIKE '%voldemort%' OR question_text ILIKE '%parrain%'
           OR question_text ILIKE '%rogue%' OR question_text ILIKE '%harry%')
      RETURNING id, question_text
    `);
    console.log(`   ✅ Quiz des Personnages (188): ${charsUpdate.rowCount} questions assignées`);

    // Questions sur le Quidditch → Quiz du Quidditch (mission id 191)
    const quidUpdate = await pool.query(`
      UPDATE quiz_questions
      SET mission_id = 191
      WHERE theme_id = 58
      AND mission_id IS NULL
      AND (question_text ILIKE '%quidditch%' OR question_text ILIKE '%vif d%'
           OR question_text ILIKE '%joueurs%' OR question_text ILIKE '%balles%')
      RETURNING id, question_text
    `);
    console.log(`   ✅ Quiz du Quidditch (191): ${quidUpdate.rowCount} questions assignées`);

    // 2. Monopoly (theme_id = 50)
    console.log('\n📚 THEME 50 - Monopoly:');

    // Trouver les missions quiz Monopoly
    const monopolyMissions = await pool.query(`
      SELECT id, name FROM missions
      WHERE theme_id = 50 AND type = 'quiz'
      ORDER BY id
    `);
    console.log('   Missions quiz:', monopolyMissions.rows.map(m => `${m.id}: ${m.name}`).join(', '));

    if (monopolyMissions.rows.length > 0) {
      // Assigner toutes les questions Monopoly orphelines à la première mission quiz
      const monopolyUpdate = await pool.query(`
        UPDATE quiz_questions
        SET mission_id = $1
        WHERE theme_id = 50
        AND mission_id IS NULL
        RETURNING id
      `, [monopolyMissions.rows[0].id]);
      console.log(`   ✅ Questions assignées à mission ${monopolyMissions.rows[0].id}: ${monopolyUpdate.rowCount}`);
    }

    // 3. Pokémon (theme_id = 59)
    console.log('\n📚 THEME 59 - Pokémon:');

    const pokemonMissions = await pool.query(`
      SELECT id, name FROM missions
      WHERE theme_id = 59 AND type = 'quiz'
      ORDER BY id
    `);
    console.log('   Missions quiz:', pokemonMissions.rows.map(m => `${m.id}: ${m.name}`).join(', '));

    if (pokemonMissions.rows.length > 0) {
      const pokemonUpdate = await pool.query(`
        UPDATE quiz_questions
        SET mission_id = $1
        WHERE theme_id = 59
        AND mission_id IS NULL
        RETURNING id
      `, [pokemonMissions.rows[0].id]);
      console.log(`   ✅ Questions assignées à mission ${pokemonMissions.rows[0].id}: ${pokemonUpdate.rowCount}`);
    }

    // 4. Vérification finale
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 VÉRIFICATION FINALE:');

    const remaining = await pool.query('SELECT COUNT(*) FROM quiz_questions WHERE mission_id IS NULL');
    console.log(`   Questions encore orphelines: ${remaining.rows[0].count}`);

    const fixed = await pool.query(`
      SELECT theme_id, mission_id, COUNT(*) as count
      FROM quiz_questions
      WHERE theme_id IN (50, 58, 59)
      GROUP BY theme_id, mission_id
      ORDER BY theme_id, mission_id
    `);
    console.log('\n   État après correction:');
    console.table(fixed.rows);

    await pool.end();
    console.log('\n✅ Correction terminée!');

  } catch (error) {
    console.error('❌ Erreur:', error);
    await pool.end();
    process.exit(1);
  }
}

fixOrphanQuestions();
