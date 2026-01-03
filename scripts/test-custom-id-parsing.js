/**
 * Test du nouveau parsing de customId pour gérer super_bonus
 */

console.log('\n🧪 TEST - Parsing CustomId\n');
console.log('='.repeat(80));

// Fonction de parsing (copie exacte de handleMysteryBoxOpen)
function parseCustomId(customId) {
  const customIdParts = customId.split('_');
  const itemId = customIdParts[customIdParts.length - 1];
  const type = customIdParts.slice(2, -1).join('_');
  return { type, itemId };
}

// Tests
const testCases = [
  {
    customId: 'mystery_open_collectible_123',
    expected: { type: 'collectible', itemId: '123' }
  },
  {
    customId: 'mystery_open_mission_456',
    expected: { type: 'mission', itemId: '456' }
  },
  {
    customId: 'mystery_open_trap_789',
    expected: { type: 'trap', itemId: '789' }
  },
  {
    customId: 'mystery_open_super_bonus_9',
    expected: { type: 'super_bonus', itemId: '9' }
  },
  {
    customId: 'mystery_open_super_bonus_1',
    expected: { type: 'super_bonus', itemId: '1' }
  }
];

let passed = 0;
let failed = 0;

console.log('\n📋 TESTS DE PARSING:\n');

testCases.forEach((testCase, index) => {
  const result = parseCustomId(testCase.customId);
  const isTypeOk = result.type === testCase.expected.type;
  const isItemIdOk = result.itemId === testCase.expected.itemId;
  const success = isTypeOk && isItemIdOk;

  if (success) {
    console.log(`✅ Test ${index + 1}: ${testCase.customId}`);
    console.log(`   → Type: "${result.type}" ✓`);
    console.log(`   → ItemId: "${result.itemId}" ✓\n`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: ${testCase.customId}`);
    console.log(`   → Type: "${result.type}" (attendu: "${testCase.expected.type}") ${isTypeOk ? '✓' : '✗'}`);
    console.log(`   → ItemId: "${result.itemId}" (attendu: "${testCase.expected.itemId}") ${isItemIdOk ? '✓' : '✗'}\n`);
    failed++;
  }
});

console.log('='.repeat(80));
console.log(`\n📊 RÉSULTAT: ${passed}/${testCases.length} tests réussis\n`);

if (failed === 0) {
  console.log('✅ Tous les tests sont passés ! Le parsing fonctionne correctement.\n');
  process.exit(0);
} else {
  console.log(`❌ ${failed} test(s) échoué(s)\n`);
  process.exit(1);
}
