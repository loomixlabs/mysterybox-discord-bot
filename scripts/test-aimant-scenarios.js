/**
 * Tester différents scénarios de probabilités de base avec Aimant +50%
 */

function calculateWithBoost(baseProbabilities, boost = 50, targetRarity = 'legendary') {
  const boosted = { ...baseProbabilities };
  boosted[targetRarity] += boost;

  const total = boosted.legendary + boosted.epic + boosted.rare + boosted.common;
  const factor = 100 / total;

  const normalized = {
    legendary: Math.round(boosted.legendary * factor),
    epic: Math.round(boosted.epic * factor),
    rare: Math.round(boosted.rare * factor),
    common: Math.round(boosted.common * factor)
  };

  return {
    base: baseProbabilities,
    boosted,
    normalized,
    total,
    factor,
    legendaryGain: normalized.legendary - baseProbabilities.legendary
  };
}

console.log('🎯 SCÉNARIOS - Impact de l\'Aimant (+50%) selon les probabilités de base\n');
console.log('='.repeat(80));

// Scénario 1: Configuration par défaut (Hostinger standard)
console.log('\n📊 SCÉNARIO 1: Configuration PAR DÉFAUT (système Hostinger)\n');
const scenario1 = calculateWithBoost({
  legendary: 5,
  epic: 10,
  rare: 20,
  common: 40
});

console.log(`   Base: legendary=${scenario1.base.legendary}%, epic=${scenario1.base.epic}%, rare=${scenario1.base.rare}%, common=${scenario1.base.common}%`);
console.log(`   Après boost: legendary=${scenario1.boosted.legendary}%`);
console.log(`   Total: ${scenario1.total}% → Facteur: ${scenario1.factor.toFixed(4)}`);
console.log(`   ✅ FINAL: legendary=${scenario1.normalized.legendary}%, epic=${scenario1.normalized.epic}%, rare=${scenario1.normalized.rare}%, common=${scenario1.normalized.common}%`);
console.log(`   📈 Gain legendary: +${scenario1.legendaryGain}% (${scenario1.base.legendary}% → ${scenario1.normalized.legendary}%)`);

// Scénario 2: Ton serveur de test actuel
console.log('\n' + '='.repeat(80));
console.log('\n📊 SCÉNARIO 2: TON SERVEUR DE TEST (custom)\n');
const scenario2 = calculateWithBoost({
  legendary: 20,
  epic: 20,
  rare: 30,
  common: 30
});

console.log(`   Base: legendary=${scenario2.base.legendary}%, epic=${scenario2.base.epic}%, rare=${scenario2.base.rare}%, common=${scenario2.base.common}%`);
console.log(`   Après boost: legendary=${scenario2.boosted.legendary}%`);
console.log(`   Total: ${scenario2.total}% → Facteur: ${scenario2.factor.toFixed(4)}`);
console.log(`   ✅ FINAL: legendary=${scenario2.normalized.legendary}%, epic=${scenario2.normalized.epic}%, rare=${scenario2.normalized.rare}%, common=${scenario2.normalized.common}%`);
console.log(`   📈 Gain legendary: +${scenario2.legendaryGain}% (${scenario2.base.legendary}% → ${scenario2.normalized.legendary}%)`);

// Scénario 3: Legendary très faible (1%)
console.log('\n' + '='.repeat(80));
console.log('\n📊 SCÉNARIO 3: LEGENDARY TRÈS RARE (1% de base)\n');
const scenario3 = calculateWithBoost({
  legendary: 1,
  epic: 5,
  rare: 15,
  common: 50
});

console.log(`   Base: legendary=${scenario3.base.legendary}%, epic=${scenario3.base.epic}%, rare=${scenario3.base.rare}%, common=${scenario3.base.common}%`);
console.log(`   Après boost: legendary=${scenario3.boosted.legendary}%`);
console.log(`   Total: ${scenario3.total}% → Facteur: ${scenario3.factor.toFixed(4)}`);
console.log(`   ✅ FINAL: legendary=${scenario3.normalized.legendary}%, epic=${scenario3.normalized.epic}%, rare=${scenario3.normalized.rare}%, common=${scenario3.normalized.common}%`);
console.log(`   📈 Gain legendary: +${scenario3.legendaryGain}% (${scenario3.base.legendary}% → ${scenario3.normalized.legendary}%)`);

// Scénario 4: Legendary déjà élevé (30%)
console.log('\n' + '='.repeat(80));
console.log('\n📊 SCÉNARIO 4: LEGENDARY DÉJÀ ÉLEVÉ (30% de base)\n');
const scenario4 = calculateWithBoost({
  legendary: 30,
  epic: 25,
  rare: 25,
  common: 20
});

console.log(`   Base: legendary=${scenario4.base.legendary}%, epic=${scenario4.base.epic}%, rare=${scenario4.base.rare}%, common=${scenario4.base.common}%`);
console.log(`   Après boost: legendary=${scenario4.boosted.legendary}%`);
console.log(`   Total: ${scenario4.total}% → Facteur: ${scenario4.factor.toFixed(4)}`);
console.log(`   ✅ FINAL: legendary=${scenario4.normalized.legendary}%, epic=${scenario4.normalized.epic}%, rare=${scenario4.normalized.rare}%, common=${scenario4.normalized.common}%`);
console.log(`   📈 Gain legendary: +${scenario4.legendaryGain}% (${scenario4.base.legendary}% → ${scenario4.normalized.legendary}%)`);

// Scénario 5: Distribution égale
console.log('\n' + '='.repeat(80));
console.log('\n📊 SCÉNARIO 5: DISTRIBUTION ÉGALE (25% partout)\n');
const scenario5 = calculateWithBoost({
  legendary: 25,
  epic: 25,
  rare: 25,
  common: 25
});

console.log(`   Base: legendary=${scenario5.base.legendary}%, epic=${scenario5.base.epic}%, rare=${scenario5.base.rare}%, common=${scenario5.base.common}%`);
console.log(`   Après boost: legendary=${scenario5.boosted.legendary}%`);
console.log(`   Total: ${scenario5.total}% → Facteur: ${scenario5.factor.toFixed(4)}`);
console.log(`   ✅ FINAL: legendary=${scenario5.normalized.legendary}%, epic=${scenario5.normalized.epic}%, rare=${scenario5.normalized.rare}%, common=${scenario5.normalized.common}%`);
console.log(`   📈 Gain legendary: +${scenario5.legendaryGain}% (${scenario5.base.legendary}% → ${scenario5.normalized.legendary}%)`);

console.log('\n' + '='.repeat(80));
console.log('\n🎯 CONCLUSION\n');
console.log('Le résultat FINAL de legendary avec Aimant (+50%) VARIE selon la configuration:');
console.log(`   - Config défaut (5% base)  → ${scenario1.normalized.legendary}% final`);
console.log(`   - Config test (20% base)    → ${scenario2.normalized.legendary}% final`);
console.log(`   - Très rare (1% base)       → ${scenario3.normalized.legendary}% final`);
console.log(`   - Déjà élevé (30% base)     → ${scenario4.normalized.legendary}% final`);
console.log(`   - Distribution égale (25%)  → ${scenario5.normalized.legendary}% final`);
console.log('\n💡 Le boost +50% est une ADDITION ABSOLUE, mais la normalisation à 100%');
console.log('   fait que le résultat final dépend de TOUTES les probabilités de base.\n');
console.log('='.repeat(80));
