/**
 * Debug script to understand why backup parsing fails
 */
const fs = require('fs');
const path = require('path');

const BACKUP_FILE = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');
const TEST_GUILD_ID = '297309737135898624';

async function main() {
  console.log('🔍 DEBUG PARSING BACKUP\n');
  console.log('='.repeat(80));

  const content = fs.readFileSync(BACKUP_FILE, 'utf-8');
  console.log(`📁 Fichier lu: ${content.length} caractères\n`);

  // Chercher COPY public.missions
  const missionsCopyRegex = /COPY public\.missions \(([^)]+)\) FROM stdin;/;
  const missionsCopyMatch = content.match(missionsCopyRegex);

  if (missionsCopyMatch) {
    console.log('✅ COPY public.missions trouvé');
    console.log(`   Colonnes: ${missionsCopyMatch[1]}`);

    // Trouver l'index du début des données
    const startIndex = content.indexOf(missionsCopyMatch[0]) + missionsCopyMatch[0].length;

    // Trouver la fin (ligne avec juste "\.")
    const endMarker = '\n\\.\n';
    const endIndex = content.indexOf(endMarker, startIndex);

    if (endIndex > startIndex) {
      const dataSection = content.substring(startIndex, endIndex).trim();
      const lines = dataSection.split('\n').filter(l => l.length > 0);

      console.log(`   Total lignes de données: ${lines.length}`);

      // Filtrer par guild_id
      const testGuildLines = lines.filter(l => l.includes(TEST_GUILD_ID));
      console.log(`   Lignes pour guild ${TEST_GUILD_ID}: ${testGuildLines.length}`);

      if (testGuildLines.length > 0) {
        console.log('\n   Exemples (3 premiers):');
        testGuildLines.slice(0, 3).forEach((line, i) => {
          const cols = line.split('\t');
          console.log(`   ${i+1}. ID: ${cols[0]}, Name: ${cols[3]}, Type: ${cols[4]}`);
        });
      }
    } else {
      console.log('❌ Fin des données non trouvée');
    }
  } else {
    console.log('❌ COPY public.missions non trouvé');
  }

  // Chercher quiz_questions
  console.log('\n');
  const quizCopyRegex = /COPY public\.quiz_questions \(([^)]+)\) FROM stdin;/;
  const quizCopyMatch = content.match(quizCopyRegex);

  if (quizCopyMatch) {
    console.log('✅ COPY public.quiz_questions trouvé');
    console.log(`   Colonnes: ${quizCopyMatch[1]}`);

    const startIndex = content.indexOf(quizCopyMatch[0]) + quizCopyMatch[0].length;
    const endMarker = '\n\\.\n';
    const endIndex = content.indexOf(endMarker, startIndex);

    if (endIndex > startIndex) {
      const dataSection = content.substring(startIndex, endIndex).trim();
      const lines = dataSection.split('\n').filter(l => l.length > 0);

      console.log(`   Total lignes: ${lines.length}`);

      const testGuildLines = lines.filter(l => l.includes(TEST_GUILD_ID));
      console.log(`   Lignes pour guild ${TEST_GUILD_ID}: ${testGuildLines.length}`);
    }
  }

  // Chercher mission_keywords
  console.log('\n');
  const keywordsCopyRegex = /COPY public\.mission_keywords \(([^)]+)\) FROM stdin;/;
  const keywordsCopyMatch = content.match(keywordsCopyRegex);

  if (keywordsCopyMatch) {
    console.log('✅ COPY public.mission_keywords trouvé');
    console.log(`   Colonnes: ${keywordsCopyMatch[1]}`);

    const startIndex = content.indexOf(keywordsCopyMatch[0]) + keywordsCopyMatch[0].length;
    const endMarker = '\n\\.\n';
    const endIndex = content.indexOf(endMarker, startIndex);

    if (endIndex > startIndex) {
      const dataSection = content.substring(startIndex, endIndex).trim();
      const lines = dataSection.split('\n').filter(l => l.length > 0);

      console.log(`   Total lignes: ${lines.length}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Debug terminé');
}

main();
