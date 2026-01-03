/**
 * Script pour vérifier l'état des missions et restaurer depuis backup si nécessaire
 */
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

const GUILD_ID = '297309737135898624'; // Test server

async function checkCurrentState() {
  console.log('🔍 ÉTAT ACTUEL DES MISSIONS\n');
  console.log('='.repeat(80));

  // Missions
  const missions = await db.queryAll(`
    SELECT m.id, m.name, m.type,
           (SELECT COUNT(*) FROM quiz_questions q WHERE q.mission_id = m.id) as questions_count,
           (SELECT COUNT(*) FROM mission_keywords k WHERE k.mission_id = m.id) as keywords_count
    FROM missions m
    WHERE m.guild_id = $1
    ORDER BY m.id
  `, [GUILD_ID]);

  console.log('\n📋 Missions actuelles:');
  console.table(missions);

  const totalQuestions = missions.reduce((sum, m) => sum + parseInt(m.questions_count || 0), 0);
  const totalKeywords = missions.reduce((sum, m) => sum + parseInt(m.keywords_count || 0), 0);

  console.log(`\n📊 Résumé:`);
  console.log(`   - ${missions.length} missions`);
  console.log(`   - ${totalQuestions} questions quiz au total`);
  console.log(`   - ${totalKeywords} keywords au total`);

  return { missions, totalQuestions, totalKeywords };
}

async function analyzeBackup() {
  console.log('\n\n🗂️  ANALYSE DU BACKUP\n');
  console.log('='.repeat(80));

  const backupPath = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');

  if (!fs.existsSync(backupPath)) {
    console.log('❌ Backup non trouvé:', backupPath);
    return null;
  }

  const backupContent = fs.readFileSync(backupPath, 'utf-8');

  // Rechercher les données de missions pour le guild
  const missionMatches = backupContent.match(/COPY public\.missions.*FROM stdin;([\s\S]*?)\\./);
  const quizMatches = backupContent.match(/COPY public\.quiz_questions.*FROM stdin;([\s\S]*?)\\./);
  const keywordMatches = backupContent.match(/COPY public\.mission_keywords.*FROM stdin;([\s\S]*?)\\./);

  console.log('\n📋 Données dans le backup:');

  if (missionMatches) {
    const lines = missionMatches[1].trim().split('\n').filter(l => l.includes(GUILD_ID));
    console.log(`   - ${lines.length} missions pour guild ${GUILD_ID}`);
  }

  if (quizMatches) {
    const lines = quizMatches[1].trim().split('\n').filter(l => l.includes(GUILD_ID));
    console.log(`   - ${lines.length} quiz_questions pour guild ${GUILD_ID}`);
  }

  if (keywordMatches) {
    const lines = keywordMatches[1].trim().split('\n');
    console.log(`   - ${lines.length} mission_keywords total`);
  }

  return { missionMatches, quizMatches, keywordMatches };
}

async function main() {
  try {
    const currentState = await checkCurrentState();
    await analyzeBackup();

    console.log('\n\n💡 RECOMMANDATION:');
    console.log('='.repeat(80));

    if (currentState.totalQuestions === 0 && currentState.totalKeywords === 0) {
      console.log('⚠️  Les missions sont vides! Il faut restaurer depuis le backup.');
      console.log('\nPour restaurer, exécuter:');
      console.log('   node scripts/restore-missions-from-backup.js');
    } else {
      console.log('✅ Les missions semblent avoir des données.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
