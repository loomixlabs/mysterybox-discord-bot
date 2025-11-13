/**
 * Script de diagnostic du routing des interactions Discord
 * Vérifie que toutes les interactions Give Unique sont correctement routées
 */

const fs = require('fs');
const path = require('path');

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

async function checkFileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function analyzeHandlerFile() {
  section('1. ANALYSE DU FICHIER GIVEUNIQUE HANDLER');

  const handlerPath = path.join(__dirname, 'handlers', 'giveUniqueHandler.js');

  const exists = await checkFileExists(handlerPath);

  if (!exists) {
    log(`❌ Fichier introuvable: ${handlerPath}`, 'red');
    return null;
  }

  log(`✅ Fichier trouvé: ${handlerPath}`, 'green');

  const content = await fs.promises.readFile(handlerPath, 'utf8');

  // Statistiques du fichier
  const lines = content.split('\n');
  const size = (content.length / 1024).toFixed(2);

  log(`\n📊 Statistiques du fichier:`, 'blue');
  console.log(`   Lignes: ${lines.length}`);
  console.log(`   Taille: ${size} KB`);

  return content;
}

async function findAllHandlers(content) {
  section('2. IDENTIFICATION DES HANDLERS');

  // Rechercher tous les handlers (méthodes async handle...)
  const handlerRegex = /async\s+(handle\w+)\s*\(/g;
  const handlers = [];
  let match;

  while ((match = handlerRegex.exec(content)) !== null) {
    handlers.push(match[1]);
  }

  log(`📋 ${handlers.length} handler(s) trouvé(s):`, 'blue');
  handlers.forEach((handler, index) => {
    console.log(`   ${index + 1}. ${handler}`);
  });

  return handlers;
}

async function checkDeferCalls(content, handlers) {
  section('3. VÉRIFICATION DES APPELS deferUpdate() / deferReply()');

  const results = [];

  for (const handlerName of handlers) {
    // Extraire le code du handler
    const handlerRegex = new RegExp(`async\\s+${handlerName}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?=\\n\\s*async\\s+\\w+|\\n\\s*\\/\\*|$)`, 'g');
    const handlerMatch = handlerRegex.exec(content);

    if (!handlerMatch) {
      log(`⚠️  ${handlerName}: Code introuvable`, 'yellow');
      results.push({ name: handlerName, hasDefer: false, type: 'unknown', found: false });
      continue;
    }

    const handlerCode = handlerMatch[1];

    // Vérifier la présence de deferUpdate ou deferReply
    const hasDeferUpdate = /await\s+interaction\.deferUpdate\(\)/.test(handlerCode);
    const hasDeferReply = /await\s+interaction\.deferReply\(/.test(handlerCode);
    const hasShowModal = /await\s+interaction\.showModal\(/.test(handlerCode);

    let status = '❌';
    let color = 'red';
    let type = 'none';

    if (hasDeferUpdate) {
      status = '✅';
      color = 'green';
      type = 'deferUpdate';
    } else if (hasDeferReply) {
      status = '✅';
      color = 'green';
      type = 'deferReply';
    } else if (hasShowModal) {
      status = '⚪';
      color = 'blue';
      type = 'showModal (pas de defer nécessaire)';
    }

    log(`${status} ${handlerName}: ${type}`, color);

    results.push({
      name: handlerName,
      hasDefer: hasDeferUpdate || hasDeferReply,
      type,
      found: true,
      hasShowModal
    });
  }

  const handlersWithDefer = results.filter(r => r.hasDefer).length;
  const handlersWithModal = results.filter(r => r.hasShowModal).length;
  const handlersWithoutDefer = results.filter(r => r.found && !r.hasDefer && !r.hasShowModal).length;

  log(`\n📊 Résumé:`, 'magenta');
  console.log(`   ✅ Handlers avec defer: ${handlersWithDefer}`);
  console.log(`   ⚪ Handlers avec modal: ${handlersWithModal}`);
  console.log(`   ❌ Handlers SANS defer: ${handlersWithoutDefer}`);

  if (handlersWithoutDefer > 0) {
    log(`\n⚠️  ATTENTION: ${handlersWithoutDefer} handler(s) sans deferUpdate/deferReply !`, 'red');
    results.filter(r => r.found && !r.hasDefer && !r.hasShowModal).forEach(r => {
      log(`   - ${r.name}`, 'red');
    });
  }

  return results;
}

async function findCustomIds(content) {
  section('4. IDENTIFICATION DES CUSTOM IDS');

  // Rechercher tous les customId dans le fichier
  const customIdRegex = /customId:\s*['"`]([^'"`]+)['"`]/g;
  const customIds = new Set();
  let match;

  while ((match = customIdRegex.exec(content)) !== null) {
    customIds.add(match[1]);
  }

  log(`🔑 ${customIds.size} customId(s) unique(s) trouvé(s):`, 'blue');

  const sortedIds = Array.from(customIds).sort();
  sortedIds.forEach((id, index) => {
    console.log(`   ${index + 1}. ${id}`);
  });

  return sortedIds;
}

async function checkRoutingLogic(content) {
  section('5. VÉRIFICATION DE LA LOGIQUE DE ROUTING');

  // Rechercher le switch/if qui route les interactions
  const hasSwitchStatement = /switch\s*\([^)]*customId[^)]*\)/i.test(content);
  const hasIfElseChain = /if\s*\([^)]*customId[^)]*\.startsWith/i.test(content);

  log('Mécanisme de routing détecté:', 'blue');
  if (hasSwitchStatement) {
    log('   ✅ Switch statement trouvé', 'green');
  }
  if (hasIfElseChain) {
    log('   ✅ Chaîne if/else trouvée', 'green');
  }

  if (!hasSwitchStatement && !hasIfElseChain) {
    log('   ❌ Aucun mécanisme de routing clair trouvé!', 'red');
  }

  // Vérifier la présence d'un catch-all pour les erreurs
  const hasCatchAll = /catch\s*\([^)]*error[^)]*\)/i.test(content);
  const hasTryCatch = /try\s*{/.test(content);

  log('\nGestion des erreurs:', 'blue');
  if (hasTryCatch && hasCatchAll) {
    log('   ✅ Try/catch détecté', 'green');
  } else if (hasCatchAll) {
    log('   ⚠️  Catch trouvé mais pas de try', 'yellow');
  } else {
    log('   ❌ Aucune gestion d\'erreur détectée!', 'red');
  }
}

async function checkIndexJsIntegration() {
  section('6. VÉRIFICATION DE L\'INTÉGRATION DANS INDEX.JS');

  const indexPath = path.join(__dirname, 'index.js');

  const exists = await checkFileExists(indexPath);

  if (!exists) {
    log(`❌ Fichier introuvable: ${indexPath}`, 'red');
    return;
  }

  log(`✅ Fichier trouvé: ${indexPath}`, 'green');

  const content = await fs.promises.readFile(indexPath, 'utf8');

  // Vérifier l'import du handler
  const hasRequire = /require\s*\([^)]*giveUniqueHandler[^)]*\)/i.test(content);
  const hasImport = /import\s+.*giveUniqueHandler/i.test(content);

  log('\nImport du handler:', 'blue');
  if (hasRequire || hasImport) {
    log('   ✅ Handler importé', 'green');
  } else {
    log('   ❌ Handler NON importé!', 'red');
  }

  // Vérifier l'événement interactionCreate
  const hasInteractionEvent = /client\.on\s*\(\s*['"`]interactionCreate['"`]/i.test(content);
  const hasInteractionHandler = /\.handleInteraction\s*\(/i.test(content);

  log('\nÉcouteur d\'interactions:', 'blue');
  if (hasInteractionEvent) {
    log('   ✅ Event "interactionCreate" trouvé', 'green');
  } else {
    log('   ❌ Event "interactionCreate" NON trouvé!', 'red');
  }

  if (hasInteractionHandler) {
    log('   ✅ Appel à handleInteraction() trouvé', 'green');
  } else {
    log('   ⚠️  Aucun appel explicite à handleInteraction()', 'yellow');
  }

  // Vérifier les intents
  const intentsRegex = /GatewayIntentBits\.([\w,\s]+)/g;
  const intents = [];
  let match;

  while ((match = intentsRegex.exec(content)) !== null) {
    intents.push(match[1].trim());
  }

  if (intents.length > 0) {
    log('\n🔧 Intents Discord configurés:', 'blue');
    intents.forEach(intent => {
      console.log(`   - ${intent}`);
    });
  }
}

async function checkCommonIssues(content) {
  section('7. VÉRIFICATION DES PROBLÈMES COURANTS');

  const issues = [];

  // Problème 1: Double defer
  const doubleDeferRegex = /deferUpdate[\s\S]{0,200}deferUpdate/g;
  if (doubleDeferRegex.test(content)) {
    issues.push({
      severity: 'high',
      message: 'Double appel à deferUpdate() détecté (risque d\'erreur InteractionAlreadyReplied)'
    });
  }

  // Problème 2: update() après defer
  const updateAfterDeferRegex = /deferUpdate[\s\S]{0,500}\.update\(/g;
  if (updateAfterDeferRegex.test(content)) {
    issues.push({
      severity: 'medium',
      message: 'Appel à update() après deferUpdate() (utiliser editReply() à la place)'
    });
  }

  // Problème 3: reply() après defer
  const replyAfterDeferRegex = /defer(?:Update|Reply)[\s\S]{0,500}\.reply\(/g;
  if (replyAfterDeferRegex.test(content)) {
    issues.push({
      severity: 'medium',
      message: 'Appel à reply() après defer (utiliser editReply() ou followUp())'
    });
  }

  // Problème 4: Pas de await avant defer
  const noDeferAwaitRegex = /(?<!await\s+)interaction\.defer(?:Update|Reply)\(/g;
  if (noDeferAwaitRegex.test(content)) {
    issues.push({
      severity: 'high',
      message: 'Appel à defer() sans await (l\'interaction ne sera pas différée correctement)'
    });
  }

  // Problème 5: Long traitement synchrone avant defer
  const longCodeBeforeDeferRegex = /async\s+handle\w+\s*\([^)]*\)\s*\{[\s\S]{200,}?defer/g;
  const matches = content.match(longCodeBeforeDeferRegex);
  if (matches && matches.length > 0) {
    issues.push({
      severity: 'low',
      message: `${matches.length} handler(s) avec du code avant defer (risque de timeout si traitement long)`
    });
  }

  if (issues.length === 0) {
    log('✅ Aucun problème courant détecté', 'green');
  } else {
    log(`⚠️  ${issues.length} problème(s) potentiel(s) détecté(s):`, 'yellow');
    issues.forEach((issue, index) => {
      const emoji = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
      console.log(`\n   ${emoji} Problème ${index + 1} (${issue.severity}):`);
      console.log(`   ${issue.message}`);
    });
  }

  return issues;
}

async function generateReport(handlers, deferResults, customIds, issues) {
  section('8. RAPPORT FINAL');

  const totalHandlers = handlers.length;
  const handlersWithDefer = deferResults.filter(r => r.hasDefer).length;
  const handlersWithModal = deferResults.filter(r => r.hasShowModal).length;
  const handlersAtRisk = deferResults.filter(r => r.found && !r.hasDefer && !r.hasShowModal).length;

  const score = totalHandlers > 0 ? Math.round((handlersWithDefer + handlersWithModal) / totalHandlers * 100) : 0;

  log('📊 SCORE DE SANTÉ DU ROUTING:', 'cyan');

  let scoreColor = 'green';
  let scoreEmoji = '✅';
  if (score < 70) {
    scoreColor = 'red';
    scoreEmoji = '❌';
  } else if (score < 90) {
    scoreColor = 'yellow';
    scoreEmoji = '⚠️';
  }

  log(`\n   ${scoreEmoji} Score: ${score}%`, scoreColor);

  console.log('\n📈 Détails:');
  console.log(`   - Handlers totaux: ${totalHandlers}`);
  console.log(`   - Handlers protégés (defer): ${handlersWithDefer}`);
  console.log(`   - Handlers avec modal: ${handlersWithModal}`);
  console.log(`   - Handlers à risque: ${handlersAtRisk}`);
  console.log(`   - CustomIds uniques: ${customIds.length}`);
  console.log(`   - Problèmes détectés: ${issues.length}`);

  if (handlersAtRisk > 0) {
    log('\n⚠️  RECOMMANDATIONS:', 'yellow');
    log('   1. Ajouter deferUpdate() au début de chaque handler à risque', 'yellow');
    log('   2. Utiliser deferReply() pour les soumissions de modal', 'yellow');
    log('   3. Toujours utiliser await avant defer()', 'yellow');
  }

  if (score >= 90) {
    log('\n✅ Le routing semble correctement configuré!', 'green');
  } else if (score >= 70) {
    log('\n⚠️  Le routing nécessite quelques améliorations.', 'yellow');
  } else {
    log('\n❌ Le routing présente des problèmes critiques!', 'red');
  }
}

async function main() {
  try {
    log('\n' + '█'.repeat(80), 'cyan');
    log('  DIAGNOSTIC DU ROUTING DES INTERACTIONS - GIVE UNIQUE', 'cyan');
    log('█'.repeat(80) + '\n', 'cyan');

    log(`📅 Date: ${new Date().toLocaleString('fr-FR')}\n`, 'magenta');

    // Exécuter tous les diagnostics
    const content = await analyzeHandlerFile();

    if (!content) {
      log('\n❌ Impossible de continuer sans le fichier handler.', 'red');
      process.exit(1);
    }

    const handlers = await findAllHandlers(content);
    const deferResults = await checkDeferCalls(content, handlers);
    const customIds = await findCustomIds(content);
    await checkRoutingLogic(content);
    await checkIndexJsIntegration();
    const issues = await checkCommonIssues(content);
    await generateReport(handlers, deferResults, customIds, issues);

    // Résumé final
    section('✅ DIAGNOSTIC TERMINÉ');
    log('Tous les diagnostics ont été exécutés.', 'green');
    log('Consultez les sections ci-dessus pour les détails.\n', 'green');

    process.exit(0);
  } catch (error) {
    log(`\n❌ ERREUR FATALE: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Exécuter le diagnostic
main();
