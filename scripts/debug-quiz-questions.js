const fs = require('fs');
const path = require('path');

const BACKUP_FILE = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');
const TEST_GUILD_ID = '297309737135898624';

function parseTable(backupContent, tableName) {
  const headerRegex = new RegExp(`COPY public\\.${tableName} \\(([^)]+)\\) FROM stdin;`);
  const headerMatch = backupContent.match(headerRegex);
  if (!headerMatch) return { columns: [], rows: [] };
  const columns = headerMatch[1].split(', ').map(c => c.trim());
  const startIndex = backupContent.indexOf(headerMatch[0]) + headerMatch[0].length;
  const endMarker = '\n\\.\n';
  const endIndex = backupContent.indexOf(endMarker, startIndex);
  if (endIndex <= startIndex) return { columns, rows: [] };
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
  console.log('🔍 DEBUG QUIZ QUESTIONS\n');

  const content = fs.readFileSync(BACKUP_FILE, 'utf-8');

  // Parse missions
  const { rows: allMissions } = parseTable(content, 'missions');
  const missions = allMissions.filter(m => m.guild_id === TEST_GUILD_ID);
  console.log(`📋 Missions test guild: ${missions.length}`);

  // Create map of old mission IDs
  const missionIds = new Set(missions.map(m => m.id));
  console.log('   Old mission IDs:', Array.from(missionIds).join(', '));

  // Parse quiz_questions
  const { columns, rows: allQuestions } = parseTable(content, 'quiz_questions');
  console.log(`\n📋 Quiz questions colonnes: ${columns.join(', ')}`);

  const questions = allQuestions.filter(q => q.guild_id === TEST_GUILD_ID);
  console.log(`\n❓ Quiz questions test guild: ${questions.length}`);

  // Group by mission_id
  const byMissionId = {};
  questions.forEach(q => {
    const mid = q.mission_id || 'NULL';
    if (!byMissionId[mid]) byMissionId[mid] = [];
    byMissionId[mid].push(q);
  });

  console.log('\n📊 Questions par mission_id:');
  for (const [mid, qs] of Object.entries(byMissionId)) {
    const inMissions = missionIds.has(mid);
    const status = inMissions ? '✅' : '❌';
    console.log(`   ${status} mission_id=${mid}: ${qs.length} questions`);
    if (!inMissions && qs.length > 0) {
      console.log(`      Exemple: "${qs[0].question_text?.substring(0, 50)}..."`);
    }
  }
}

main();
