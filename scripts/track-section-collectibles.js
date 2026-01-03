/**
 * Track Section: COLLECTIBLES (CollectiblesSection component)
 * Affiche les vrais champs du composant CollectiblesSection
 *
 * Champs par collectible:
 * - collectible_id: string (unique ID)
 * - name: string
 * - rarity: 'legendary' | 'epic' | 'rare' | 'common'
 * - image_url: string (optional)
 * - reveal_message: string (optional)
 */
const db = require('../utils/database-pg');

const THEME_ID = 'test tracking';

async function track() {
  console.log('═'.repeat(80));
  console.log('💎 TRACKING SECTION: COLLECTIBLES (Composant CollectiblesSection)');
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

  const collectibles = theme.theme_data?.collectibles || [];

  // Stats par rareté
  const rarities = ['legendary', 'epic', 'rare', 'common'];
  const stats = {};
  rarities.forEach(r => {
    stats[r] = collectibles.filter(c => c.rarity === r).length;
  });

  // Info générale
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 💎 SECTION: COLLECTIBLES                                                    │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 📦 Total collectibles:       ${collectibles.length.toString().padEnd(45)}│`);
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log('│ 📊 RÉPARTITION PAR RARETÉ                                                   │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 👑 Legendary:  ${stats.legendary.toString().padEnd(5)} ${'█'.repeat(Math.min(stats.legendary * 2, 50)).padEnd(50)}│`);
  console.log(`│ 💜 Epic:       ${stats.epic.toString().padEnd(5)} ${'█'.repeat(Math.min(stats.epic * 2, 50)).padEnd(50)}│`);
  console.log(`│ 💙 Rare:       ${stats.rare.toString().padEnd(5)} ${'█'.repeat(Math.min(stats.rare * 2, 50)).padEnd(50)}│`);
  console.log(`│ ⚪ Common:     ${stats.common.toString().padEnd(5)} ${'█'.repeat(Math.min(stats.common * 2, 50)).padEnd(50)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  if (collectibles.length === 0) {
    console.log('');
    console.log('⚠️  Aucun collectible configuré.');
  } else {
    // Liste détaillée (max 20)
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ 📋 LISTE DES COLLECTIBLES                                                   │');
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');

    const displayItems = collectibles.slice(0, 20);
    displayItems.forEach((item, i) => {
      const emoji = { legendary: '👑', epic: '💜', rare: '💙', common: '⚪' }[item.rarity] || '❓';
      const name = (item.name || '(sans nom)').substring(0, 20).padEnd(20);
      const id = (item.collectible_id || '(sans id)').substring(0, 18).padEnd(18);
      const hasImg = item.image_url ? '🖼️' : '  ';
      const hasMsg = item.reveal_message ? '💬' : '  ';
      console.log(`│ ${(i + 1).toString().padStart(2)}. ${emoji} ${name} │ ${id} │ ${hasImg} ${hasMsg} │`);
    });

    if (collectibles.length > 20) {
      console.log(`│ ... et ${collectibles.length - 20} autres collectibles                                        │`);
    }

    console.log('├─────────────────────────────────────────────────────────────────────────────┤');
    console.log('│ DÉTAILS PREMIERS COLLECTIBLES (max 5):                                      │');
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');

    const detailItems = collectibles.slice(0, 5);
    detailItems.forEach((item, i) => {
      console.log(`│ Collectible #${i + 1}:                                                             │`);
      console.log(`│   • collectible_id:  ${(item.collectible_id || '(vide)').substring(0, 50).padEnd(50)}│`);
      console.log(`│   • name:            ${(item.name || '(vide)').substring(0, 50).padEnd(50)}│`);
      console.log(`│   • rarity:          ${(item.rarity || '(vide)').padEnd(50)}│`);
      console.log(`│   • image_url:       ${(item.image_url ? item.image_url.substring(0, 48) + '...' : '(vide)').padEnd(50)}│`);
      console.log(`│   • reveal_message:  ${(item.reveal_message || '(vide)').substring(0, 50).padEnd(50)}│`);
      if (i < detailItems.length - 1) {
        console.log('│                                                                             │');
      }
    });

    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
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
