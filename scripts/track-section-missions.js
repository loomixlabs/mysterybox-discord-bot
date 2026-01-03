/**
 * Track Section: MISSIONS (MissionsSection component)
 * Affiche les vrais champs des composants QuizModal et KeywordModal
 *
 * Structure: missions est un flat array avec field "type"
 *
 * QUIZ (type = 'quiz'):
 *   - mission_id: string (unique ID)
 *   - name: string
 *   - type: 'quiz'
 *   - description: string (optional)
 *   - timeout: number (default: 60 seconds)
 *   - max_attempts: number (default: 3)
 *   - reward_type: 'random-collectible' | 'specific-collectible' | 'super-bonus'
 *   - reward_collectible_id: string (if specific-collectible)
 *   - questions: [{question_text, correct_answer, wrong_answers[], difficulty}]
 *
 * KEYWORD (type = 'keyword' | 'keyword-message'):
 *   - mission_id: string (unique ID)
 *   - name: string
 *   - type: 'keyword' | 'keyword-message'
 *   - description: string (optional)
 *   - timeout: number (default: 60 seconds)
 *   - reward_type: 'random-collectible' | 'specific-collectible' | 'super-bonus'
 *   - reward_collectible_id: string (if specific-collectible)
 *   - keywords: [{keyword, difficulty}] or string[]
 */
const db = require('../utils/database-pg');

const THEME_ID = 'test tracking';

async function track() {
  console.log('═'.repeat(80));
  console.log('🎯 TRACKING SECTION: MISSIONS (Composant MissionsSection)');
  console.log('═'.repeat(80));
  console.log(`📍 Theme: "${THEME_ID}"`);
  console.log('');

  const theme = await db.queryOne(`
    SELECT id, theme_id, name, is_draft, visibility, updated_at, theme_data
    FROM themes_library
    WHERE theme_id = $1
  `, [THEME_ID]);

  if (!theme) {
    console.log('❌ Thème non trouvé!');
    process.exit(1);
  }

  // DB-First: missions est un flat array
  const missions = Array.isArray(theme.theme_data?.missions) ? theme.theme_data.missions : [];

  // Séparer par type
  const quizMissions = missions.filter(m => m.type === 'quiz');
  const keywordMissions = missions.filter(m => m.type === 'keyword' || m.type === 'keyword-message');

  // Info générale
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 🎯 SECTION: MISSIONS                                                        │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 📦 Total missions:     ${missions.length.toString().padEnd(50)}│`);
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log('│ 📊 RÉPARTITION PAR TYPE                                                     │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ ❓ Quiz:        ${quizMissions.length.toString().padEnd(5)} ${'█'.repeat(Math.min(quizMissions.length * 5, 50)).padEnd(50)}│`);
  console.log(`│ 🔤 Mot-clé:     ${keywordMissions.length.toString().padEnd(5)} ${'█'.repeat(Math.min(keywordMissions.length * 5, 50)).padEnd(50)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  // ===== QUIZ MISSIONS =====
  if (quizMissions.length > 0) {
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ ❓ MISSIONS QUIZ                                                            │');
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');

    quizMissions.forEach((quiz, i) => {
      const questionCount = quiz.questions?.length || 0;
      console.log(`│ Quiz #${i + 1}:                                                                     │`);
      console.log('│ ─────────────────────────────────────────────────────────────────────────── │');
      console.log(`│   • mission_id:          ${(quiz.mission_id || '(vide)').substring(0, 45).padEnd(45)}│`);
      console.log(`│   • name:                ${(quiz.name || '(vide)').substring(0, 45).padEnd(45)}│`);
      console.log(`│   • type:                ${(quiz.type || '(vide)').padEnd(45)}│`);
      console.log(`│   • description:         ${(quiz.description || '(vide)').substring(0, 45).padEnd(45)}│`);
      console.log(`│   • timeout:             ${((quiz.timeout || 60) + ' sec').padEnd(45)}│`);
      console.log(`│   • max_attempts:        ${((quiz.max_attempts || 3) + ' essais').padEnd(45)}│`);
      console.log(`│   • reward_type:         ${(quiz.reward_type || 'random-collectible').padEnd(45)}│`);
      if (quiz.reward_type === 'specific-collectible') {
        console.log(`│   • reward_collectible:  ${(quiz.reward_collectible_id || '(vide)').padEnd(45)}│`);
      }
      console.log(`│   • questions:           ${questionCount} question(s)                                   │`);

      // Afficher les questions
      if (quiz.questions && quiz.questions.length > 0) {
        quiz.questions.forEach((q, qIdx) => {
          console.log(`│     └─ Q${qIdx + 1}: ${(q.question_text || '(vide)').substring(0, 40).padEnd(40)}   │`);
          console.log(`│        • correct:        ${(q.correct_answer || '(vide)').substring(0, 35).padEnd(35)}│`);
          console.log(`│        • alternatives:   ${(q.wrong_answers?.length || 0)} réponse(s) alt.                     │`);
          console.log(`│        • difficulty:     ${(q.difficulty || 'easy').padEnd(35)}│`);
        });
      }

      if (i < quizMissions.length - 1) {
        console.log('│                                                                             │');
      }
    });

    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  }

  // ===== KEYWORD MISSIONS =====
  if (keywordMissions.length > 0) {
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ 🔤 MISSIONS MOT-CLÉ                                                         │');
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');

    keywordMissions.forEach((kw, i) => {
      const keywordCount = kw.keywords?.length || 0;
      console.log(`│ Mot-clé #${i + 1}:                                                                  │`);
      console.log('│ ─────────────────────────────────────────────────────────────────────────── │');
      console.log(`│   • mission_id:          ${(kw.mission_id || '(vide)').substring(0, 45).padEnd(45)}│`);
      console.log(`│   • name:                ${(kw.name || '(vide)').substring(0, 45).padEnd(45)}│`);
      console.log(`│   • type:                ${(kw.type || '(vide)').padEnd(45)}│`);
      console.log(`│   • description:         ${(kw.description || '(vide)').substring(0, 45).padEnd(45)}│`);
      console.log(`│   • timeout:             ${((kw.timeout || 60) + ' sec').padEnd(45)}│`);
      console.log(`│   • reward_type:         ${(kw.reward_type || 'random-collectible').padEnd(45)}│`);
      if (kw.reward_type === 'specific-collectible') {
        console.log(`│   • reward_collectible:  ${(kw.reward_collectible_id || '(vide)').padEnd(45)}│`);
      }
      console.log(`│   • keywords:            ${keywordCount} mot(s)-clé(s)                                  │`);

      // Afficher les mots-clés (max 5)
      if (kw.keywords && kw.keywords.length > 0) {
        const displayKw = kw.keywords.slice(0, 5);
        displayKw.forEach((k, kIdx) => {
          const keyword = typeof k === 'string' ? k : k.keyword;
          const difficulty = typeof k === 'string' ? 'easy' : (k.difficulty || 'easy');
          const emoji = { easy: '🌱', medium: '⚡', hard: '🔥' }[difficulty] || '🌱';
          console.log(`│     └─ ${emoji} "${keyword}" (${difficulty})`.padEnd(72) + '│');
        });
        if (kw.keywords.length > 5) {
          console.log(`│     └─ ... et ${kw.keywords.length - 5} autres mots-clés`.padEnd(72) + '│');
        }
      }

      if (i < keywordMissions.length - 1) {
        console.log('│                                                                             │');
      }
    });

    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  }

  if (missions.length === 0) {
    console.log('');
    console.log('⚠️  Aucune mission configurée.');
  }

  // Infos DB
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 💾 INFOS BASE DE DONNÉES                                                    │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ updated_at:    ${(theme.updated_at?.toISOString() || 'N/A').padEnd(59)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  process.exit(0);
}

track().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
