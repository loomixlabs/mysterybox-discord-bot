/**
 * Script de test pour le quizAnswerMatcher
 * Teste tous les scénarios demandés par l'utilisateur
 */

const matcher = require('../utils/quizAnswerMatcher');

console.log('='.repeat(80));
console.log('TEST DU QUIZ ANSWER MATCHER');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

function test(name, expected, result) {
  const success = result === expected;
  if (success) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     Attendu: ${expected}, Obtenu: ${result}`);
  }
}

// ============================================
// TEST 1: Normalisation des articles
// ============================================
console.log('\n📝 TEST 1: Normalisation des articles français');

test('Strip "un" - "un baiser" -> "baiser"',
  'baiser', matcher.normalizeAnswer('un baiser'));

test('Strip "une" - "une pomme" -> "pomme"',
  'pomme', matcher.normalizeAnswer('une pomme'));

test('Strip "le" - "le chat" -> "chat"',
  'chat', matcher.normalizeAnswer('le chat'));

test('Strip "la" - "la maison" -> "maison"',
  'maison', matcher.normalizeAnswer('la maison'));

test('Strip "les" - "les enfants" -> "enfants"',
  'enfants', matcher.normalizeAnswer('les enfants'));

test('Strip "l\'" - "l\'amour" -> "amour"',
  'amour', matcher.normalizeAnswer("l'amour"));

test('Strip "d\'" - "d\'accord" -> "accord"',
  'accord', matcher.normalizeAnswer("d'accord"));

test('Strip "du" - "du pain" -> "pain"',
  'pain', matcher.normalizeAnswer('du pain'));

test('Strip "des" - "des fleurs" -> "fleurs"',
  'fleurs', matcher.normalizeAnswer('des fleurs'));

// ============================================
// TEST 2: Suppression des accents
// ============================================
console.log('\n📝 TEST 2: Suppression des accents');

test('Accents - "café" -> "cafe"',
  'cafe', matcher.normalizeAnswer('café'));

test('Accents - "français" -> "francais"',
  'francais', matcher.normalizeAnswer('français'));

test('Accents - "naïf" -> "naif"',
  'naif', matcher.normalizeAnswer('naïf'));

// ============================================
// TEST 3: Comparaison exacte (après normalisation)
// ============================================
console.log('\n📝 TEST 3: Comparaison exacte après normalisation');

let result = matcher.matchAnswer('un baiser', 'baiser');
test('Article ignoré - "un baiser" == "baiser"', true, result.isCorrect);

result = matcher.matchAnswer('baiser', 'un baiser');
test('Article ignoré inversé - "baiser" == "un baiser"', true, result.isCorrect);

result = matcher.matchAnswer('Le Chat', 'chat');
test('Casse + article - "Le Chat" == "chat"', true, result.isCorrect);

// ============================================
// TEST 4: Tolérance fautes de frappe (Levenshtein)
// ============================================
console.log('\n📝 TEST 4: Tolérance aux fautes de frappe');

result = matcher.matchAnswer('biser', 'baiser');
test('Faute légère - "biser" ~= "baiser" (isCorrect)', true, result.isCorrect);

result = matcher.matchAnswer('baisr', 'baiser');
test('Inversion - "baisr" ~= "baiser" (isCorrect)', true, result.isCorrect);

result = matcher.matchAnswer('baisser', 'baiser');
test('Doublon - "baisser" ~= "baiser" (isCorrect)', true, result.isCorrect);

result = matcher.matchAnswer('bai', 'baiser');
test('Trop court - "bai" != "baiser"', false, result.isCorrect);

// ============================================
// TEST 5: Réponses proches (70-84%)
// ============================================
console.log('\n📝 TEST 5: Réponses proches (70-84%)');

result = matcher.matchAnswer('bais', 'baiser');
test('Proche - "bais" (isClose)', true, result.isClose);

// ============================================
// TEST 6: Réponses multiples (toutes requises)
// ============================================
console.log('\n📝 TEST 6: Réponses multiples (toutes requises)');

// Test avec virgule
result = matcher.matchAnswer('timide, prof', 'timide, prof');
test('Multiples virgule - "timide, prof" OK', true, result.isCorrect);

result = matcher.matchAnswer('prof, timide', 'timide, prof');
test('Ordre inversé - "prof, timide" OK', true, result.isCorrect);

// Test avec "et"
result = matcher.matchAnswer('timide et prof', 'timide, prof');
test('Séparateur "et" - "timide et prof" OK', true, result.isCorrect);

// Test partiel (manque une réponse)
result = matcher.matchAnswer('timide', 'timide, prof');
test('Partiel - "timide" seul (isClose, pas isCorrect)', true, result.isClose && !result.isCorrect);

result = matcher.matchAnswer('prof', 'timide, prof');
test('Partiel inversé - "prof" seul (isClose)', true, result.isClose && !result.isCorrect);

// ============================================
// TEST 7: Combinaisons complexes
// ============================================
console.log('\n📝 TEST 7: Combinaisons complexes');

result = matcher.matchAnswer('la belle, le prince', 'belle, prince');
test('Articles + multiples - "la belle, le prince" OK', true, result.isCorrect);

result = matcher.matchAnswer('un baiser magique', 'baiser magique');
test('Article sur phrase - "un baiser magique" OK', true, result.isCorrect);

// ============================================
// TEST 8: Alternatives acceptées
// ============================================
console.log('\n📝 TEST 8: Alternatives acceptées');

result = matcher.matchAnswer('sept', '7', ['sept', 'seven']);
test('Alternative - "sept" pour "7"', true, result.isCorrect);

result = matcher.matchAnswer('7', '7', ['sept']);
test('Principale - "7" pour "7"', true, result.isCorrect);

// ============================================
// RÉSUMÉ
// ============================================
console.log('\n' + '='.repeat(80));
console.log(`RÉSUMÉ: ${passed} tests passés, ${failed} tests échoués`);
console.log('='.repeat(80));

if (failed === 0) {
  console.log('\n✅ TOUS LES TESTS SONT PASSÉS - Le système est compatible !');
} else {
  console.log('\n⚠️  Certains tests ont échoué - Vérifier l\'implémentation');
}

process.exit(failed > 0 ? 1 : 0);
