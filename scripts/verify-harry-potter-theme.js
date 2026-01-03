const db = require('../utils/database-pg');

const TEST_GUILD_ID = '297309737135898624';

async function main() {
  try {
    console.log('🧙 VÉRIFICATION DU THÈME HARRY POTTER\n');
    console.log('='.repeat(80));

    // Trouver le thème Harry Potter
    const theme = await db.queryOne(`
      SELECT * FROM themes
      WHERE guild_id = $1 AND name ILIKE '%harry%potter%'
    `, [TEST_GUILD_ID]);

    if (!theme) {
      console.log('❌ Thème Harry Potter non trouvé!');

      // Lister les thèmes disponibles
      const themes = await db.queryAll(`
        SELECT id, name, is_active FROM themes WHERE guild_id = $1
      `, [TEST_GUILD_ID]);
      console.log('\n📋 Thèmes disponibles:');
      console.table(themes);
      process.exit(1);
    }

    console.log(`✅ Thème trouvé: ${theme.name} (ID: ${theme.id})`);

    // Compter les missions
    const missions = await db.queryAll(`
      SELECT m.id, m.mission_id, m.name, m.type,
             (SELECT COUNT(*) FROM quiz_questions q WHERE q.mission_id = m.id) as questions,
             (SELECT COUNT(*) FROM mission_keywords k WHERE k.mission_id = m.id) as keywords
      FROM missions m
      WHERE m.guild_id = $1 AND m.theme_id = $2
      ORDER BY m.id
    `, [TEST_GUILD_ID, theme.id]);

    console.log(`\n📋 Missions du thème Harry Potter: ${missions.length}`);
    console.table(missions.map(m => ({
      ID: m.id,
      MissionID: m.mission_id,
      Nom: m.name,
      Type: m.type,
      Questions: m.questions,
      Keywords: m.keywords
    })));

    // Vérifier les quiz questions
    const totalQuestions = missions.reduce((sum, m) => sum + parseInt(m.questions || 0), 0);
    const totalKeywords = missions.reduce((sum, m) => sum + parseInt(m.keywords || 0), 0);

    console.log(`\n📊 Résumé:`);
    console.log(`   - Missions: ${missions.length}/7`);
    console.log(`   - Quiz questions: ${totalQuestions}`);
    console.log(`   - Keywords: ${totalKeywords}`);

    if (missions.length === 7 && totalQuestions >= 16) {
      console.log('\n✅ Le thème Harry Potter est correctement restauré!');
    } else {
      console.log('\n⚠️  Des données manquent encore');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
