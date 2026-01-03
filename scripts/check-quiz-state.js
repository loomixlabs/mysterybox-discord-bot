/**
 * Vérification de l'état des missions et quiz_questions
 */

const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 État des missions et quiz_questions\n');

  const guildId = '297309737135898624';

  try {
    // Missions
    const missions = await db.queryAll(
      `SELECT id, name, type, mission_id
       FROM missions
       WHERE guild_id = $1
       ORDER BY id`,
      [guildId]
    );

    console.log('📋 Missions trouvées:', missions.length);
    if (missions.length > 0) {
      console.table(missions);
    }

    // Quiz questions
    const questions = await db.queryAll(
      `SELECT qq.id, qq.mission_id, qq.question_text, m.name as mission_name
       FROM quiz_questions qq
       LEFT JOIN missions m ON qq.mission_id = m.id
       WHERE qq.guild_id = $1
       ORDER BY qq.id`,
      [guildId]
    );

    console.log('\n📋 Quiz questions:', questions.length);
    if (questions.length > 0) {
      console.table(questions.map(q => ({
        id: q.id,
        mission_id: q.mission_id,
        mission_name: q.mission_name || '❌ ORPHELINE',
        question: (q.question_text || '').substring(0, 40) + '...'
      })));
    }

    // Questions orphelines (sans mission valide)
    const orphans = questions.filter(q => !q.mission_name);
    if (orphans.length > 0) {
      console.log('\n⚠️  Questions ORPHELINES (mission_id invalide):', orphans.length);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

check();
