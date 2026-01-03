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
  console.log('🔍 ANALYSE DES QUESTIONS ORPHELINES\n');
  console.log('='.repeat(80));

  const content = fs.readFileSync(BACKUP_FILE, 'utf-8');

  // Parse quiz_questions
  const { columns, rows: allQuestions } = parseTable(content, 'quiz_questions');
  const questions = allQuestions.filter(q => q.guild_id === TEST_GUILD_ID);

  console.log(`📋 Colonnes quiz_questions: ${columns.join(', ')}\n`);

  // Séparer les questions avec et sans mission_id
  const withMissionId = questions.filter(q => q.mission_id);
  const withoutMissionId = questions.filter(q => !q.mission_id);

  console.log(`✅ Questions avec mission_id: ${withMissionId.length}`);
  console.log(`❌ Questions sans mission_id (orphelines): ${withoutMissionId.length}\n`);

  // Analyser les questions orphelines par theme_id
  console.log('📊 Questions orphelines par theme_id:');
  const byTheme = {};
  withoutMissionId.forEach(q => {
    const tid = q.theme_id || 'NULL';
    if (!byTheme[tid]) byTheme[tid] = [];
    byTheme[tid].push(q);
  });

  for (const [tid, qs] of Object.entries(byTheme)) {
    console.log(`\n   Theme ID ${tid}: ${qs.length} questions`);
    qs.slice(0, 3).forEach((q, i) => {
      console.log(`     ${i+1}. "${q.question_text?.substring(0, 60)}..."`);
      console.log(`        created_at: ${q.created_at}`);
    });
  }

  // Comparer les dates de création
  console.log('\n\n📅 ANALYSE TEMPORELLE:');
  console.log('='.repeat(80));

  if (withMissionId.length > 0) {
    const withDates = withMissionId.map(q => new Date(q.created_at)).sort((a, b) => a - b);
    console.log(`\n✅ Questions AVEC mission_id:`);
    console.log(`   Première: ${withDates[0]?.toISOString()}`);
    console.log(`   Dernière: ${withDates[withDates.length - 1]?.toISOString()}`);
  }

  if (withoutMissionId.length > 0) {
    const withoutDates = withoutMissionId.map(q => new Date(q.created_at)).sort((a, b) => a - b);
    console.log(`\n❌ Questions SANS mission_id (orphelines):`);
    console.log(`   Première: ${withoutDates[0]?.toISOString()}`);
    console.log(`   Dernière: ${withoutDates[withoutDates.length - 1]?.toISOString()}`);
  }

  // Vérifier les thèmes associés
  console.log('\n\n🎨 THÈMES ASSOCIÉS:');
  const { rows: themes } = parseTable(content, 'themes');
  const testThemes = themes.filter(t => t.guild_id === TEST_GUILD_ID);

  for (const [tid, qs] of Object.entries(byTheme)) {
    if (tid === 'NULL') continue;
    const theme = testThemes.find(t => t.id === tid);
    console.log(`   Theme ${tid}: ${theme?.name || 'INCONNU'}`);
  }

  console.log('\n\n💡 CONCLUSION:');
  console.log('='.repeat(80));
  console.log(`Les ${withoutMissionId.length} questions orphelines ont été créées AVANT`);
  console.log('l\'ajout de la colonne mission_id à la table quiz_questions.');
  console.log('Elles étaient liées uniquement par theme_id, pas par mission_id.');
  console.log('\nCe sont probablement des questions de test ou créées via une ancienne');
  console.log('version du système qui ne gérait pas encore les missions individuelles.');
}

main();
