/**
 * Script FIXÉ pour merger les données du serveur de test depuis le backup local
 * Sans écraser les données de production (VPS)
 */
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

const TEST_GUILD_ID = '297309737135898624';
const BACKUP_FILE = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');

function parseTable(backupContent, tableName) {
  // Trouver l'en-tête COPY
  const headerRegex = new RegExp(`COPY public\\.${tableName} \\(([^)]+)\\) FROM stdin;`);
  const headerMatch = backupContent.match(headerRegex);

  if (!headerMatch) {
    return { columns: [], rows: [] };
  }

  const columns = headerMatch[1].split(', ').map(c => c.trim());

  // Trouver le début et la fin des données
  const startIndex = backupContent.indexOf(headerMatch[0]) + headerMatch[0].length;
  const endMarker = '\n\\.\n';
  const endIndex = backupContent.indexOf(endMarker, startIndex);

  if (endIndex <= startIndex) {
    return { columns, rows: [] };
  }

  const dataSection = backupContent.substring(startIndex, endIndex).trim();
  const lines = dataSection.split('\n').filter(l => l.length > 0);

  const rows = lines.map(line => {
    const values = line.split('\t');
    const obj = {};
    columns.forEach((col, i) => {
      let val = values[i];
      if (val === '\\N') val = null;
      obj[col] = val;
    });
    return obj;
  });

  return { columns, rows };
}

async function main() {
  try {
    console.log('🔍 MERGE des données du serveur de test\n');
    console.log('='.repeat(80));

    const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
    console.log(`📁 Backup lu: ${backupContent.length} caractères\n`);

    // 1. Parser les missions du backup pour le test guild
    const { columns: missionCols, rows: allMissions } = parseTable(backupContent, 'missions');
    const missions = allMissions.filter(m => m.guild_id === TEST_GUILD_ID);
    console.log(`📋 Missions test guild trouvées: ${missions.length}`);

    if (missions.length === 0) {
      console.log('❌ Aucune mission trouvée pour le test guild!');
      process.exit(1);
    }

    // 2. Parser les quiz_questions
    const { rows: allQuestions } = parseTable(backupContent, 'quiz_questions');
    const questions = allQuestions.filter(q => q.guild_id === TEST_GUILD_ID);
    console.log(`❓ Quiz questions test guild trouvées: ${questions.length}`);

    // 3. Parser les mission_keywords
    const { rows: allKeywords } = parseTable(backupContent, 'mission_keywords');
    const oldMissionIds = missions.map(m => m.id);
    const keywords = allKeywords.filter(k => oldMissionIds.includes(k.mission_id));
    console.log(`🔑 Keywords pour ces missions: ${keywords.length}`);

    // 4. Supprimer les données existantes du serveur de test
    console.log('\n🗑️  Suppression des anciennes données test...');
    await db.query('DELETE FROM quiz_questions WHERE guild_id = $1', [TEST_GUILD_ID]);
    await db.query('DELETE FROM mission_keywords WHERE mission_id IN (SELECT id FROM missions WHERE guild_id = $1)', [TEST_GUILD_ID]);
    await db.query('DELETE FROM mission_progress WHERE guild_id = $1', [TEST_GUILD_ID]);
    await db.query('DELETE FROM missions WHERE guild_id = $1', [TEST_GUILD_ID]);
    console.log('  ✅ Données test supprimées');

    // 5. Insérer les missions
    console.log(`\n📋 Insertion de ${missions.length} missions...`);
    const missionIdMap = {}; // old_id -> new_id

    for (const m of missions) {
      const result = await db.queryOne(`
        INSERT INTO missions (guild_id, theme_id, mission_id, name, type, description, validation_type, timeout, reward_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        m.guild_id,
        m.theme_id || null,
        m.mission_id || m.name,  // mission_id est le slug comme "message-pomme"
        m.name,
        m.type,
        m.description || '',
        m.validation_type || 'manual',
        parseInt(m.timeout) || 60,
        m.reward_type || 'random-collectible'
      ]);
      missionIdMap[m.id] = result.id;
      console.log(`  ✅ Mission "${m.name}" (${m.type}) -> ID ${result.id}`);
    }

    // 6. Insérer les quiz_questions
    console.log(`\n❓ Insertion de ${questions.length} quiz questions...`);
    let questionsInserted = 0;

    for (const q of questions) {
      const newMissionId = missionIdMap[q.mission_id];
      if (!newMissionId) {
        console.log(`  ⚠️  Skip question (mission_id ${q.mission_id} non mappée)`);
        continue;
      }
      await db.query(`
        INSERT INTO quiz_questions (mission_id, guild_id, theme_id, question_text, correct_answer, wrong_answers, hint, difficulty)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        newMissionId,
        q.guild_id,
        q.theme_id || null,
        q.question_text,
        q.correct_answer,
        q.wrong_answers,
        q.hint,
        q.difficulty || 'medium'
      ]);
      questionsInserted++;
    }
    console.log(`  ✅ ${questionsInserted} questions insérées`);

    // 7. Insérer les keywords
    console.log(`\n🔑 Insertion de ${keywords.length} keywords...`);
    let keywordsInserted = 0;

    for (const k of keywords) {
      const newMissionId = missionIdMap[k.mission_id];
      if (!newMissionId) {
        console.log(`  ⚠️  Skip keyword (mission_id ${k.mission_id} non mappée)`);
        continue;
      }
      await db.query(`
        INSERT INTO mission_keywords (mission_id, guild_id, keyword, difficulty)
        VALUES ($1, $2, $3, $4)
      `, [
        newMissionId,
        k.guild_id || TEST_GUILD_ID,
        k.keyword,
        k.difficulty || 'medium'
      ]);
      keywordsInserted++;
    }
    console.log(`  ✅ ${keywordsInserted} keywords insérés`);

    // 8. Vérification finale
    console.log('\n\n📊 VÉRIFICATION FINALE:');
    console.log('='.repeat(80));

    const result = await db.queryOne(`
      SELECT
        (SELECT COUNT(*) FROM missions WHERE guild_id = $1) as missions,
        (SELECT COUNT(*) FROM quiz_questions WHERE guild_id = $1) as questions,
        (SELECT COUNT(*) FROM mission_keywords WHERE mission_id IN (SELECT id FROM missions WHERE guild_id = $1)) as keywords
    `, [TEST_GUILD_ID]);
    console.log(`  - Missions: ${result.missions}`);
    console.log(`  - Questions: ${result.questions}`);
    console.log(`  - Keywords: ${result.keywords}`);

    // Détail par mission
    console.log('\n📋 Détail des missions:');
    const missionDetails = await db.queryAll(`
      SELECT m.id, m.name, m.type,
             (SELECT COUNT(*) FROM quiz_questions q WHERE q.mission_id = m.id) as questions,
             (SELECT COUNT(*) FROM mission_keywords k WHERE k.mission_id = m.id) as keywords
      FROM missions m
      WHERE m.guild_id = $1
      ORDER BY m.id
    `, [TEST_GUILD_ID]);

    console.table(missionDetails.map(m => ({
      ID: m.id,
      Nom: m.name.substring(0, 30),
      Type: m.type,
      Questions: m.questions,
      Keywords: m.keywords
    })));

    console.log('\n✅ Merge terminé avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
