/**
 * Script de vérification: Monopoly Theme vs Contraintes DB
 * Vérifie que le fichier monopoly.theme.json respecte toutes les contraintes CHECK
 */

const fs = require('fs');
const path = require('path');

const CONSTRAINTS = {
  theme_config: {
    check_probabilities_sum_100: (config) => {
      const sum = (config.probability_collectible || 0) +
                  (config.probability_mission || 0) +
                  (config.probability_trap || 0) +
                  (config.probability_super_bonus || 0);
      return { valid: sum === 100, actual: sum, expected: 100 };
    }
  },
  collectibles: {
    rarity_check: (collectible) => {
      const validRarities = ['common', 'rare', 'epic', 'legendary'];
      return {
        valid: validRarities.includes(collectible.rarity),
        actual: collectible.rarity,
        expected: validRarities
      };
    }
  },
  traps: {
    type_check: (trap) => {
      const validTypes = ['cooldown', 'lose-collectible', 'lose-all-collectibles', 'public-shame', 'empty-box'];
      return {
        valid: validTypes.includes(trap.type),
        actual: trap.type,
        expected: validTypes
      };
    }
  },
  missions: {
    type_check: (mission, type) => {
      const validTypes = ['keyword-message', 'reaction-message', 'quiz', 'voice-join', 'message-count', 'reaction-count', 'manual'];
      return {
        valid: validTypes.includes(type),
        actual: type,
        expected: validTypes
      };
    }
  },
  mission_keywords: {
    difficulty_check: (keyword) => {
      const validDifficulties = ['easy', 'medium', 'hard'];
      return {
        valid: validDifficulties.includes(keyword.difficulty),
        actual: keyword.difficulty,
        expected: validDifficulties
      };
    }
  }
};

function main() {
  console.log('🔍 VÉRIFICATION: Monopoly Theme vs Contraintes DB');
  console.log('='.repeat(80));

  // Charger le fichier Monopoly
  const monopolyPath = path.join(__dirname, '..', 'themes', 'presets', 'monopoly.theme.json');
  let theme;

  try {
    const content = fs.readFileSync(monopolyPath, 'utf8');
    theme = JSON.parse(content);
    console.log(`✅ Fichier chargé: ${monopolyPath}`);
  } catch (error) {
    console.error(`❌ Erreur de chargement: ${error.message}`);
    process.exit(1);
  }

  let allValid = true;
  const errors = [];

  // 1. Vérifier theme_config
  console.log('\n📋 MODULE 1: THEME_CONFIG');
  console.log('-'.repeat(40));

  if (theme.theme_config) {
    const probResult = CONSTRAINTS.theme_config.check_probabilities_sum_100(theme.theme_config);
    if (probResult.valid) {
      console.log(`✅ Probabilités: ${theme.theme_config.probability_collectible} + ${theme.theme_config.probability_mission} + ${theme.theme_config.probability_trap} + ${theme.theme_config.probability_super_bonus} = ${probResult.actual}`);
    } else {
      console.log(`❌ Probabilités ne font pas 100: ${probResult.actual}`);
      errors.push(`theme_config: probabilités = ${probResult.actual} (attendu: 100)`);
      allValid = false;
    }
  } else {
    console.log('⚠️  Pas de theme_config (valeurs par défaut seront utilisées)');
  }

  // 2. Vérifier collectibles
  console.log('\n📋 MODULE 2: COLLECTIBLES');
  console.log('-'.repeat(40));

  if (theme.collectibles && theme.collectibles.length > 0) {
    const rarityCounts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    let collectibleErrors = 0;

    for (const collectible of theme.collectibles) {
      const result = CONSTRAINTS.collectibles.rarity_check(collectible);
      if (result.valid) {
        rarityCounts[collectible.rarity]++;
      } else {
        console.log(`❌ "${collectible.name}": rarity "${result.actual}" invalide`);
        errors.push(`collectible "${collectible.name}": rarity invalide "${result.actual}"`);
        collectibleErrors++;
        allValid = false;
      }
    }

    if (collectibleErrors === 0) {
      console.log(`✅ ${theme.collectibles.length} collectibles valides`);
      console.log(`   - Legendary: ${rarityCounts.legendary}`);
      console.log(`   - Epic: ${rarityCounts.epic}`);
      console.log(`   - Rare: ${rarityCounts.rare}`);
      console.log(`   - Common: ${rarityCounts.common}`);
    }
  } else {
    console.log('⚠️  Pas de collectibles');
  }

  // 3. Vérifier traps
  console.log('\n📋 MODULE 3: TRAPS');
  console.log('-'.repeat(40));

  if (theme.traps && theme.traps.length > 0) {
    const typeCounts = {};
    let trapErrors = 0;

    for (const trap of theme.traps) {
      const result = CONSTRAINTS.traps.type_check(trap);
      if (result.valid) {
        typeCounts[trap.type] = (typeCounts[trap.type] || 0) + 1;
      } else {
        console.log(`❌ "${trap.name}": type "${result.actual}" invalide`);
        errors.push(`trap "${trap.name}": type invalide "${result.actual}"`);
        trapErrors++;
        allValid = false;
      }
    }

    if (trapErrors === 0) {
      console.log(`✅ ${theme.traps.length} pièges valides`);
      for (const [type, count] of Object.entries(typeCounts)) {
        console.log(`   - ${type}: ${count}`);
      }
    }
  } else {
    console.log('⚠️  Pas de pièges');
  }

  // 4. Vérifier missions keyword
  console.log('\n📋 MODULE 4: MISSIONS KEYWORD');
  console.log('-'.repeat(40));

  if (theme.missions && theme.missions.keyword && theme.missions.keyword.length > 0) {
    let keywordErrors = 0;
    let totalKeywords = 0;
    const difficultyCounts = { easy: 0, medium: 0, hard: 0 };

    for (const mission of theme.missions.keyword) {
      // Vérifier type de mission (keyword-message dans l'importer)

      for (const keyword of mission.keywords) {
        totalKeywords++;
        const result = CONSTRAINTS.mission_keywords.difficulty_check(keyword);
        if (result.valid) {
          difficultyCounts[keyword.difficulty]++;
        } else {
          console.log(`❌ Keyword "${keyword.keyword}": difficulty "${result.actual}" invalide`);
          errors.push(`keyword "${keyword.keyword}": difficulty invalide "${result.actual}"`);
          keywordErrors++;
          allValid = false;
        }
      }
    }

    if (keywordErrors === 0) {
      console.log(`✅ ${theme.missions.keyword.length} mission(s) keyword valide(s)`);
      console.log(`✅ ${totalKeywords} mot(s)-clé(s) valide(s)`);
      console.log(`   - Easy: ${difficultyCounts.easy}`);
      console.log(`   - Medium: ${difficultyCounts.medium}`);
      console.log(`   - Hard: ${difficultyCounts.hard}`);
    }
  } else {
    console.log('⚠️  Pas de missions keyword');
  }

  // 5. Vérifier missions quiz
  console.log('\n📋 MODULE 5: MISSIONS QUIZ');
  console.log('-'.repeat(40));

  if (theme.missions && theme.missions.quiz && theme.missions.quiz.length > 0) {
    let totalQuestions = 0;

    for (const mission of theme.missions.quiz) {
      totalQuestions += mission.questions.length;

      // Vérifier que chaque question a les champs requis
      for (const question of mission.questions) {
        if (!question.question_text || !question.correct_answer) {
          console.log(`❌ Question incomplète dans mission "${mission.name}"`);
          errors.push(`Question incomplète dans mission "${mission.name}"`);
          allValid = false;
        }
      }
    }

    console.log(`✅ ${theme.missions.quiz.length} mission(s) quiz valide(s)`);
    console.log(`✅ ${totalQuestions} question(s) valide(s)`);
  } else {
    console.log('⚠️  Pas de missions quiz');
  }

  // Résumé final
  console.log('\n' + '='.repeat(80));
  console.log('📊 RÉSUMÉ FINAL');
  console.log('='.repeat(80));

  if (allValid) {
    console.log('\n✅✅✅ THÈME MONOPOLY VALIDE - TOUTES LES CONTRAINTES RESPECTÉES ✅✅✅');
    console.log(`\n📦 Contenu validé:`);
    console.log(`   - Collectibles: ${theme.collectibles?.length || 0}`);
    console.log(`   - Pièges: ${theme.traps?.length || 0}`);
    console.log(`   - Missions Keyword: ${theme.missions?.keyword?.length || 0}`);
    console.log(`   - Missions Quiz: ${theme.missions?.quiz?.length || 0}`);
  } else {
    console.log('\n❌❌❌ ERREURS DÉTECTÉES ❌❌❌');
    console.log('\nErreurs:');
    errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
  }

  process.exit(allValid ? 0 : 1);
}

main();
