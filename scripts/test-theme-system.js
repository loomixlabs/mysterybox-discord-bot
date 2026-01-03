/**
 * Script de test du système d'import/export de thèmes
 *
 * Teste:
 * 1. Validation du thème Monopoly
 * 2. Liste des thèmes disponibles
 * 3. Import en base de données (optionnel)
 */

require('dotenv').config();
const path = require('path');
const ThemeValidator = require('../utils/themeValidator');
const ThemeImporter = require('../utils/themeImporter');
const ThemeExporter = require('../utils/themeExporter');

const GUILD_ID = process.env.GUILD_ID || '1248028543389143070';

async function testThemeSystem() {
  console.log('='.repeat(80));
  console.log('🧪 TEST DU SYSTÈME DE THÈMES');
  console.log('='.repeat(80));
  console.log('');

  // Test 1: Validation du thème Monopoly
  console.log('📋 TEST 1: Validation du thème Monopoly');
  console.log('-'.repeat(40));

  const validator = new ThemeValidator();
  const monopolyPath = path.join(__dirname, '..', 'themes', 'presets', 'monopoly.theme.json');
  const validation = validator.validateFile(monopolyPath);

  if (validation.valid) {
    console.log('✅ Thème Monopoly valide !');
  } else {
    console.log('❌ Thème Monopoly invalide:');
    validation.errors.forEach(err => console.log(`   - ${err}`));
  }
  console.log('');

  // Test 2: Liste des thèmes disponibles
  console.log('📋 TEST 2: Liste des thèmes préconfigurés');
  console.log('-'.repeat(40));

  const availableThemes = ThemeValidator.listAvailableThemes();
  console.log(`📁 ${availableThemes.length} thème(s) trouvé(s) dans themes/presets/:`);

  availableThemes.forEach(theme => {
    console.log(`   📦 ${theme.name}`);
    console.log(`      - Fichier: ${theme.file}`);
    console.log(`      - Auteur: ${theme.author}`);
    console.log(`      - Collectibles: ${theme.collectibles_count}`);
    console.log(`      - Missions: ${theme.missions_count}`);
    console.log(`      - Pièges: ${theme.traps_count}`);
    console.log('');
  });

  // Test 3: Import en base de données (simulation)
  console.log('📋 TEST 3: Simulation d\'import (sans écriture DB)');
  console.log('-'.repeat(40));

  // Lire et valider le fichier
  const fs = require('fs');
  const themeContent = fs.readFileSync(monopolyPath, 'utf8');
  const themeData = JSON.parse(themeContent);

  console.log(`📦 Thème: ${themeData.metadata.name}`);
  console.log(`📝 Description: ${themeData.metadata.description.substring(0, 50)}...`);
  console.log(`🎯 Durée: ${themeData.theme.duration_days} jours`);
  console.log(`🎮 Items requis: ${themeData.theme.required_items}`);
  console.log(`🏆 Rôle final: ${themeData.theme.final_role_name}`);
  console.log('');

  console.log('📊 Contenu du thème:');
  console.log(`   - Collectibles: ${themeData.collectibles.length}`);
  const rarityCounts = {
    legendary: themeData.collectibles.filter(c => c.rarity === 'legendary').length,
    epic: themeData.collectibles.filter(c => c.rarity === 'epic').length,
    rare: themeData.collectibles.filter(c => c.rarity === 'rare').length,
    common: themeData.collectibles.filter(c => c.rarity === 'common').length
  };
  console.log(`      - Légendaires: ${rarityCounts.legendary}`);
  console.log(`      - Épiques: ${rarityCounts.epic}`);
  console.log(`      - Rares: ${rarityCounts.rare}`);
  console.log(`      - Communs: ${rarityCounts.common}`);
  console.log(`   - Pièges: ${themeData.traps.length}`);
  const keywordMissions = themeData.missions.keyword?.length || 0;
  const quizMissions = themeData.missions.quiz?.length || 0;
  console.log(`   - Missions Keyword: ${keywordMissions}`);
  console.log(`   - Missions Quiz: ${quizMissions}`);

  if (themeData.missions.keyword?.length > 0) {
    const totalKeywords = themeData.missions.keyword.reduce((acc, m) => acc + m.keywords.length, 0);
    console.log(`      - Total mots-clés: ${totalKeywords}`);
  }

  if (themeData.missions.quiz?.length > 0) {
    const totalQuestions = themeData.missions.quiz.reduce((acc, m) => acc + m.questions.length, 0);
    console.log(`      - Total questions: ${totalQuestions}`);
  }
  console.log('');

  // Test 4: Import réel (optionnel - décommentez pour tester)
  const shouldImport = process.argv.includes('--import');

  if (shouldImport) {
    console.log('📋 TEST 4: Import réel en base de données');
    console.log('-'.repeat(40));
    console.log(`🎯 Guild ID: ${GUILD_ID}`);

    const importer = new ThemeImporter(GUILD_ID);
    const importResult = await importer.importFromFile(monopolyPath, {
      autoCreateRoles: false, // Pas de création de rôle Discord dans le test
      autoInstallSuperBonuses: false, // Pas d'installation des super bonus
      activateAfterImport: false // Ne pas activer le thème
    });

    if (importResult.success) {
      console.log('✅ Import réussi !');
      console.log(`   - Theme ID (DB): ${importResult.themeId}`);
      console.log(`   - Collectibles importés: ${importResult.imported.collectibles}`);
      console.log(`   - Pièges importés: ${importResult.imported.traps}`);
      console.log(`   - Missions importées: ${importResult.imported.missions}`);
      console.log(`   - Mots-clés importés: ${importResult.imported.keywords}`);
      console.log(`   - Questions importées: ${importResult.imported.questions}`);
    } else {
      console.log('❌ Import échoué:');
      importResult.errors.forEach(err => console.log(`   - ${err}`));
    }
  } else {
    console.log('💡 Pour tester l\'import réel, lancez avec --import:');
    console.log('   node scripts/test-theme-system.js --import');
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('✅ TESTS TERMINÉS');
  console.log('='.repeat(80));

  process.exit(0);
}

testThemeSystem().catch(error => {
  console.error('❌ Erreur:', error);
  process.exit(1);
});
