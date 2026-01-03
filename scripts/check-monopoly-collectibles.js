/**
 * Vérification des collectibles Monopoly
 */
const theme = require('../themes/presets/monopoly.theme.json');

console.log('📊 VÉRIFICATION THÈME MONOPOLY\n');
console.log('='.repeat(60));

// Check for duplicates
const ids = theme.collectibles.map(c => c.collectible_id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);

if (dupes.length > 0) {
  console.log('❌ DOUBLONS DÉTECTÉS:', dupes);
} else {
  console.log('✅ Aucun doublon');
}

// List all collectibles
console.log('\n📋 LISTE COMPLÈTE DES COLLECTIBLES (' + theme.collectibles.length + '):');
console.log('-'.repeat(60));

theme.collectibles.forEach((c, i) => {
  const num = (i + 1).toString().padStart(2, ' ');
  const rarity = c.rarity.toUpperCase().padEnd(10);
  console.log(`${num}. [${rarity}] ${c.name}`);
});

// Summary by rarity
console.log('\n📈 RÉSUMÉ PAR RARETÉ:');
console.log('-'.repeat(30));
const byRarity = {};
theme.collectibles.forEach(c => {
  byRarity[c.rarity] = (byRarity[c.rarity] || 0) + 1;
});
const order = ['legendary', 'epic', 'rare', 'common'];
order.forEach(r => {
  if (byRarity[r]) {
    const emoji = r === 'legendary' ? '🌟' : r === 'epic' ? '💜' : r === 'rare' ? '💙' : '⬜';
    console.log(`  ${emoji} ${r}: ${byRarity[r]}`);
  }
});

console.log('\n⚙️ CONFIGURATION DU THÈME:');
console.log('-'.repeat(30));
console.log(`  - required_items: ${theme.theme.required_items}`);
console.log(`  - duration_days: ${theme.theme.duration_days}`);
console.log(`  - final_role: ${theme.theme.final_role_name}`);

// Check traps
console.log('\n🪤 PIÈGES (' + theme.traps.length + '):');
console.log('-'.repeat(30));
theme.traps.forEach(t => {
  const hasImage = t.image_url ? '✅' : '❌';
  console.log(`  ${hasImage} ${t.name} (${t.type})`);
});

console.log('\n✅ Vérification terminée');
