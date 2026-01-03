/**
 * Script pour restaurer les missions depuis le backup du 13 novembre
 */
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

const GUILD_ID = '297309737135898624'; // Test server
const BACKUP_FILE = path.join(__dirname, '..', 'backups', 'backup_before_reset_20251113_214718.sql');

async function parseBackupData() {
  console.log('🔍 ANALYSE DU BACKUP DU 13 NOVEMBRE\n');
  console.log('='.repeat(80));

  const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');

  // Parse missions
  const missionsMatch = backupContent.match(/COPY public\.missions \([^)]+\) FROM stdin;([\s\S]*?)\\\./);
  const quizMatch = backupContent.match(/COPY public\.quiz_questions \([^)]+\) FROM stdin;([\s\S]*?)\\\./);
  const keywordsMatch = backupContent.match(/COPY public\.mission_keywords \([^)]+\) FROM stdin;([\s\S]*?)\\\./);

  const results = {
    missions: [],
    quizQuestions: [],
    keywords: []
  };

  // Parse missions pour ce guild
  if (missionsMatch) {
    const lines = missionsMatch[1].trim().split('\n').filter(l => l.includes(GUILD_ID));
    console.log(`📋 Missions trouvées pour guild ${GUILD_ID}: ${lines.length}`);

    lines.forEach(line => {
      const fields = line.split('\t');
      // COPY order: id, guild_id, theme_id, name, type, timeout, reward_type, created_at
      results.missions.push({
        id: parseInt(fields[0]),
        guild_id: fields[1],
        theme_id: fields[2] === '\\N' ? null : parseInt(fields[2]),
        name: fields[3],
        type: fields[4],
        timeout: parseInt(fields[5]) || 60,
        reward_type: fields[6] || 'collectible',
        created_at: fields[7]
      });
    });
  }

  // Parse quiz_questions pour ce guild
  if (quizMatch) {
    const lines = quizMatch[1].trim().split('\n').filter(l => l.includes(GUILD_ID));
    console.log(`❓ Quiz questions trouvées pour guild ${GUILD_ID}: ${lines.length}`);

    lines.forEach(line => {
      const fields = line.split('\t');
      // COPY order: id, mission_id, guild_id, theme_id, question_text, correct_answer, wrong_answers, hint, difficulty, created_at
      results.quizQuestions.push({
        id: parseInt(fields[0]),
        mission_id: parseInt(fields[1]),
        guild_id: fields[2],
        theme_id: fields[3] === '\\N' ? null : parseInt(fields[3]),
        question_text: fields[4],
        correct_answer: fields[5],
        wrong_answers: fields[6],
        hint: fields[7] === '\\N' ? null : fields[7],
        difficulty: fields[8] || 'medium',
        created_at: fields[9]
      });
    });
  }

  // Parse mission_keywords (pas de guild_id direct, join via mission_id)
  if (keywordsMatch) {
    const allKeywords = keywordsMatch[1].trim().split('\n');
    const missionIds = results.missions.map(m => m.id);

    allKeywords.forEach(line => {
      const fields = line.split('\t');
      const missionId = parseInt(fields[1]);
      if (missionIds.includes(missionId)) {
        results.keywords.push({
          id: parseInt(fields[0]),
          mission_id: missionId,
          keyword: fields[2],
          created_at: fields[3]
        });
      }
    });
    console.log(`🔑 Keywords trouvés pour ce guild: ${results.keywords.length}`);
  }

  return results;
}

async function showCurrentState() {
  console.log('\n📊 ÉTAT ACTUEL EN DB\n');
  console.log('='.repeat(80));

  const missions = await db.queryAll(`
    SELECT m.id, m.name, m.type,
           (SELECT COUNT(*) FROM quiz_questions q WHERE q.mission_id = m.id) as questions_count,
           (SELECT COUNT(*) FROM mission_keywords k WHERE k.mission_id = m.id) as keywords_count
    FROM missions m
    WHERE m.guild_id = $1
    ORDER BY m.id
  `, [GUILD_ID]);

  console.table(missions.map(m => ({
    ID: m.id,
    Nom: m.name.substring(0, 30),
    Type: m.type,
    Questions: m.questions_count,
    Keywords: m.keywords_count
  })));

  return missions;
}

async function restoreData(backupData) {
  console.log('\n🔄 RESTAURATION DES DONNÉES\n');
  console.log('='.repeat(80));

  // 1. Supprimer les données existantes
  console.log('🗑️  Suppression des données existantes...');
  await db.query('DELETE FROM quiz_questions WHERE guild_id = $1', [GUILD_ID]);
  await db.query('DELETE FROM mission_keywords WHERE mission_id IN (SELECT id FROM missions WHERE guild_id = $1)', [GUILD_ID]);
  await db.query('DELETE FROM mission_progress WHERE guild_id = $1', [GUILD_ID]);
  await db.query('DELETE FROM missions WHERE guild_id = $1', [GUILD_ID]);

  // 2. Insérer les missions
  console.log(`\n📋 Insertion de ${backupData.missions.length} missions...`);
  const missionIdMap = {}; // old_id -> new_id

  for (const mission of backupData.missions) {
    const result = await db.queryOne(`
      INSERT INTO missions (guild_id, theme_id, name, type, timeout, reward_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      mission.guild_id,
      mission.theme_id,
      mission.name,
      mission.type,
      mission.timeout,
      mission.reward_type
    ]);
    missionIdMap[mission.id] = result.id;
    console.log(`  ✅ Mission "${mission.name}" (${mission.type}) -> ID ${result.id}`);
  }

  // 3. Insérer les quiz_questions avec les nouveaux IDs
  console.log(`\n❓ Insertion de ${backupData.quizQuestions.length} quiz questions...`);
  for (const q of backupData.quizQuestions) {
    const newMissionId = missionIdMap[q.mission_id];
    if (!newMissionId) {
      console.log(`  ⚠️  Skipping question (mission_id ${q.mission_id} not found)`);
      continue;
    }
    await db.query(`
      INSERT INTO quiz_questions (mission_id, guild_id, theme_id, question_text, correct_answer, wrong_answers, hint, difficulty)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      newMissionId,
      q.guild_id,
      q.theme_id,
      q.question_text,
      q.correct_answer,
      q.wrong_answers,
      q.hint,
      q.difficulty
    ]);
  }
  console.log(`  ✅ ${backupData.quizQuestions.length} questions insérées`);

  // 4. Insérer les keywords avec les nouveaux IDs
  console.log(`\n🔑 Insertion de ${backupData.keywords.length} keywords...`);
  for (const k of backupData.keywords) {
    const newMissionId = missionIdMap[k.mission_id];
    if (!newMissionId) {
      console.log(`  ⚠️  Skipping keyword (mission_id ${k.mission_id} not found)`);
      continue;
    }
    await db.query(`
      INSERT INTO mission_keywords (mission_id, keyword)
      VALUES ($1, $2)
    `, [newMissionId, k.keyword]);
  }
  console.log(`  ✅ ${backupData.keywords.length} keywords insérés`);

  return missionIdMap;
}

async function main() {
  try {
    // Analyser le backup
    const backupData = await parseBackupData();

    console.log('\n📊 RÉSUMÉ DU BACKUP:');
    console.log(`   - ${backupData.missions.length} missions`);
    console.log(`   - ${backupData.quizQuestions.length} questions quiz`);
    console.log(`   - ${backupData.keywords.length} keywords`);

    // Montrer l'état actuel
    await showCurrentState();

    if (backupData.missions.length === 0) {
      console.log('\n⚠️  Aucune mission dans le backup pour ce guild!');
      process.exit(1);
    }

    // Demander confirmation (auto-confirm pour ce script)
    console.log('\n🚀 RESTAURATION EN COURS...');
    await restoreData(backupData);

    // Vérifier le résultat
    console.log('\n✅ ÉTAT APRÈS RESTAURATION:');
    await showCurrentState();

    console.log('\n🎉 Restauration terminée avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
