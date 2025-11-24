const db = require('./utils/database-pg');

async function check() {
  console.log('🔍 Vérification des questions quiz orphelines...\n');

  const orphanQuestions = await db.queryAll(`
    SELECT qq.id, qq.guild_id, qq.theme_id, qq.question_text, qq.mission_id,
           t.name as theme_name
    FROM quiz_questions qq
    LEFT JOIN themes t ON qq.theme_id = t.id
    WHERE qq.guild_id = $1
    ORDER BY qq.theme_id, qq.id
  `, [process.env.GUILD_ID]);

  console.table(orphanQuestions.map(q => ({
    id: q.id,
    theme: q.theme_name || 'N/A',
    question: q.question_text.substring(0, 50) + '...',
    mission_id: q.mission_id || '❌ NULL'
  })));

  const orphanCount = orphanQuestions.filter(q => !q.mission_id).length;
  console.log(`\n📊 Total questions: ${orphanQuestions.length}`);
  console.log(`❌ Questions orphelines (sans mission_id): ${orphanCount}`);
  console.log(`✅ Questions liées: ${orphanQuestions.length - orphanCount}`);

  await db.close();
  process.exit(0);
}

check().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
