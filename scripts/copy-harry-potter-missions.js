/**
 * Script: Copier les missions Harry Potter du thème 65 vers le thème 63
 *
 * Source: Theme 65 (prod server 1182395170273099806) - 7 missions complètes
 * Destination: Theme 63 (test server 297309737135898624) - actuellement 1 mission
 */
const db = require('../utils/database-pg');

const SOURCE_THEME_ID = 65;
const SOURCE_GUILD_ID = '1182395170273099806';
const TARGET_THEME_ID = 63;
const TARGET_GUILD_ID = '297309737135898624';

async function main() {
  try {
    console.log('🔄 Copie des missions Harry Potter...\n');
    console.log(`📦 Source: Theme ${SOURCE_THEME_ID} (guild ${SOURCE_GUILD_ID})`);
    console.log(`📦 Destination: Theme ${TARGET_THEME_ID} (guild ${TARGET_GUILD_ID})\n`);

    // 1. Récupérer les missions sources
    const sourceMissions = await db.queryAll(`
      SELECT * FROM missions
      WHERE theme_id = $1 AND guild_id = $2
      ORDER BY id
    `, [SOURCE_THEME_ID, SOURCE_GUILD_ID]);

    console.log(`✅ ${sourceMissions.length} missions trouvées dans le thème source\n`);

    // 2. Supprimer les missions existantes du thème cible
    await db.query(`
      DELETE FROM missions
      WHERE theme_id = $1 AND guild_id = $2
    `, [TARGET_THEME_ID, TARGET_GUILD_ID]);

    console.log(`🗑️  Missions existantes supprimées du thème cible\n`);

    // 3. Copier chaque mission
    let copiedCount = 0;
    const missionIdMapping = {}; // old_id -> new_id

    for (const mission of sourceMissions) {
      const result = await db.queryOne(`
        INSERT INTO missions (
          guild_id, theme_id, mission_id, name, type, description,
          validation_type, timeout, image_url, reward_type, max_attempts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        TARGET_GUILD_ID,
        TARGET_THEME_ID,
        mission.mission_id,
        mission.name,
        mission.type,
        mission.description,
        mission.validation_type,
        mission.timeout,
        mission.image_url,
        mission.reward_type,
        mission.max_attempts
      ]);

      const newMissionId = result.id;
      missionIdMapping[mission.id] = newMissionId;
      console.log(`  ✅ Mission "${mission.name}" copiée (${mission.id} -> ${newMissionId})`);
      copiedCount++;
    }

    console.log(`\n✅ ${copiedCount} missions copiées avec succès!\n`);

    // 4. Copier les questions de quiz associées
    console.log('📝 Copie des questions de quiz...');
    let quizCopied = 0;

    for (const [oldId, newId] of Object.entries(missionIdMapping)) {
      const questions = await db.queryAll(`
        SELECT * FROM quiz_questions
        WHERE mission_id = $1
      `, [parseInt(oldId)]);

      for (const q of questions) {
        await db.query(`
          INSERT INTO quiz_questions (mission_id, question, correct_answer, wrong_answers, image_url)
          VALUES ($1, $2, $3, $4, $5)
        `, [newId, q.question, q.correct_answer, q.wrong_answers, q.image_url]);
        quizCopied++;
      }
    }

    console.log(`  ✅ ${quizCopied} questions de quiz copiées\n`);

    // 5. Copier les keywords associés
    console.log('🔑 Copie des keywords...');
    let keywordsCopied = 0;

    for (const [oldId, newId] of Object.entries(missionIdMapping)) {
      const keywords = await db.queryAll(`
        SELECT * FROM mission_keywords
        WHERE mission_id = $1
      `, [parseInt(oldId)]);

      for (const kw of keywords) {
        await db.query(`
          INSERT INTO mission_keywords (mission_id, keyword, hint)
          VALUES ($1, $2, $3)
        `, [newId, kw.keyword, kw.hint]);
        keywordsCopied++;
      }
    }

    console.log(`  ✅ ${keywordsCopied} keywords copiés\n`);

    // 6. Vérification finale
    const finalCheck = await db.queryAll(`
      SELECT id, name, type, mission_id FROM missions
      WHERE theme_id = $1 AND guild_id = $2
      ORDER BY id
    `, [TARGET_THEME_ID, TARGET_GUILD_ID]);

    console.log('📊 RÉSULTAT FINAL:');
    console.log('='.repeat(60));
    console.table(finalCheck);
    console.log(`\n✅ Le thème Harry Potter (${TARGET_THEME_ID}) a maintenant ${finalCheck.length} missions!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
