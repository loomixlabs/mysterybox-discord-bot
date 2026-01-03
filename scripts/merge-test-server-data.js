/**
 * Script pour merger les données du serveur de test depuis le backup local
 * Sans écraser les données de production (VPS)
 */
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

const TEST_GUILD_ID = '297309737135898624';
const BACKUP_FILE = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');

async function parseTable(backupContent, tableName, filterGuildId = null) {
  const regex = new RegExp(`COPY public\\.${tableName} \\(([^)]+)\\) FROM stdin;([\\s\\S]*?)\\\\.`, 'm');
  const match = backupContent.match(regex);

  if (!match) return { columns: [], rows: [] };

  const columns = match[1].split(', ').map(c => c.trim());
  let rows = match[2].trim().split('\n').filter(l => l.length > 0);

  if (filterGuildId) {
    rows = rows.filter(r => r.includes(filterGuildId));
  }

  const parsed = rows.map(line => {
    const values = line.split('\t');
    const obj = {};
    columns.forEach((col, i) => {
      let val = values[i];
      if (val === '\\N') val = null;
      obj[col] = val;
    });
    return obj;
  });

  return { columns, rows: parsed };
}

async function main() {
  try {
    console.log('🔍 MERGE des données du serveur de test\n');
    console.log('='.repeat(80));

    const backupContent = fs.readFileSync(BACKUP_FILE, 'utf-8');

    // 1. Supprimer les données existantes du serveur de test
    console.log('\n🗑️  Suppression des anciennes données test...');
    await db.query('DELETE FROM quiz_questions WHERE guild_id = $1', [TEST_GUILD_ID]);
    await db.query('DELETE FROM mission_keywords WHERE mission_id IN (SELECT id FROM missions WHERE guild_id = $1)', [TEST_GUILD_ID]);
    await db.query('DELETE FROM mission_progress WHERE guild_id = $1', [TEST_GUILD_ID]);
    await db.query('DELETE FROM missions WHERE guild_id = $1', [TEST_GUILD_ID]);
    console.log('  ✅ Données test supprimées');

    // 2. Parser les missions du backup
    const { rows: missions } = await parseTable(backupContent, 'missions', TEST_GUILD_ID);
    console.log(`\n📋 Missions trouvées: ${missions.length}`);

    const missionIdMap = {}; // old_id -> new_id

    for (const m of missions) {
      const result = await db.queryOne(`
        INSERT INTO missions (guild_id, theme_id, name, type, timeout, reward_type, description, validation_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        m.guild_id,
        m.theme_id,
        m.name,
        m.type,
        m.timeout || 60,
        m.reward_type || 'collectible',
        m.description || '',
        m.validation_type || 'manual'
      ]);
      missionIdMap[m.id] = result.id;
      console.log(`  ✅ Mission "${m.name}" (${m.type}) -> ID ${result.id}`);
    }

    // 3. Parser les quiz_questions
    const { rows: questions } = await parseTable(backupContent, 'quiz_questions', TEST_GUILD_ID);
    console.log(`\n❓ Quiz questions trouvées: ${questions.length}`);

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
        q.theme_id,
        q.question_text,
        q.correct_answer,
        q.wrong_answers,
        q.hint,
        q.difficulty || 'medium'
      ]);
      questionsInserted++;
    }
    console.log(`  ✅ ${questionsInserted} questions insérées`);

    // 4. Parser les mission_keywords (pas de guild_id direct)
    const { rows: allKeywords } = await parseTable(backupContent, 'mission_keywords');
    const oldMissionIds = Object.keys(missionIdMap).map(id => parseInt(id));
    const keywords = allKeywords.filter(k => oldMissionIds.includes(parseInt(k.mission_id)));
    console.log(`\n🔑 Keywords trouvés: ${keywords.length}`);

    let keywordsInserted = 0;
    for (const k of keywords) {
      const newMissionId = missionIdMap[k.mission_id];
      if (!newMissionId) continue;
      await db.query(`
        INSERT INTO mission_keywords (mission_id, keyword)
        VALUES ($1, $2)
      `, [newMissionId, k.keyword]);
      keywordsInserted++;
    }
    console.log(`  ✅ ${keywordsInserted} keywords insérés`);

    // Vérification finale
    console.log('\n\n📊 VÉRIFICATION FINALE:');
    const result = await db.queryOne(`
      SELECT
        (SELECT COUNT(*) FROM missions WHERE guild_id = $1) as missions,
        (SELECT COUNT(*) FROM quiz_questions WHERE guild_id = $1) as questions,
        (SELECT COUNT(*) FROM mission_keywords WHERE mission_id IN (SELECT id FROM missions WHERE guild_id = $1)) as keywords
    `, [TEST_GUILD_ID]);
    console.log(`  - Missions: ${result.missions}`);
    console.log(`  - Questions: ${result.questions}`);
    console.log(`  - Keywords: ${result.keywords}`);

    console.log('\n✅ Merge terminé avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
