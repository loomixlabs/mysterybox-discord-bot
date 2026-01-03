/**
 * Track Section: PROBABILITÉS (ProbabilitiesSection component)
 */
const db = require('../utils/database-pg');

const THEME_ID = 'test tracking';

async function track() {
  console.log('═'.repeat(80));
  console.log('🎲 TRACKING SECTION: PROBABILITÉS');
  console.log('═'.repeat(80));

  const theme = await db.queryOne(`
    SELECT theme_data FROM themes_library WHERE theme_id = $1
  `, [THEME_ID]);

  if (!theme) {
    console.log('❌ Thème non trouvé!');
    process.exit(1);
  }

  const cfg = theme.theme_data?.theme_config || {};

  // Onglet Distribution
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 🎲 DISTRIBUTION (Mystery Box)                                               │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 💎 Collectible:    ${String(cfg.probability_collectible ?? '(vide)').padEnd(55)}│`);
  console.log(`│ 🎯 Mission:        ${String(cfg.probability_mission ?? '(vide)').padEnd(55)}│`);
  console.log(`│ ⚠️  Piège:          ${String(cfg.probability_trap ?? '(vide)').padEnd(55)}│`);
  console.log(`│ ⭐ Super Bonus:    ${String(cfg.probability_super_bonus ?? '(vide)').padEnd(55)}│`);
  const totalMain = (cfg.probability_collectible || 0) + (cfg.probability_mission || 0) +
                    (cfg.probability_trap || 0) + (cfg.probability_super_bonus || 0);
  console.log(`│ 📊 TOTAL:          ${String(totalMain + '%').padEnd(55)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  // Onglet Collectibles
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 💎 RARETÉS COLLECTIBLES                                                     │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 👑 Légendaire:     ${String(cfg.collectible_rarity_legendary ?? '(vide)').padEnd(55)}│`);
  console.log(`│ 💜 Épique:         ${String(cfg.collectible_rarity_epic ?? '(vide)').padEnd(55)}│`);
  console.log(`│ 💙 Rare:           ${String(cfg.collectible_rarity_rare ?? '(vide)').padEnd(55)}│`);
  console.log(`│ ⚪ Commun:         ${String(cfg.collectible_rarity_common ?? '(vide)').padEnd(55)}│`);
  const totalColl = (cfg.collectible_rarity_legendary || 0) + (cfg.collectible_rarity_epic || 0) +
                    (cfg.collectible_rarity_rare || 0) + (cfg.collectible_rarity_common || 0);
  console.log(`│ 📊 TOTAL:          ${String(totalColl + '%').padEnd(55)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  // Onglet Super Bonus
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ ⭐ RARETÉS SUPER BONUS                                                      │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 👑 Légendaire:     ${String(cfg.super_bonus_rarity_legendary ?? '(vide)').padEnd(55)}│`);
  console.log(`│ 💜 Épique:         ${String(cfg.super_bonus_rarity_epic ?? '(vide)').padEnd(55)}│`);
  console.log(`│ 💙 Rare:           ${String(cfg.super_bonus_rarity_rare ?? '(vide)').padEnd(55)}│`);
  console.log(`│ ⚪ Commun:         ${String(cfg.super_bonus_rarity_common ?? '(vide)').padEnd(55)}│`);
  const totalSB = (cfg.super_bonus_rarity_legendary || 0) + (cfg.super_bonus_rarity_epic || 0) +
                  (cfg.super_bonus_rarity_rare || 0) + (cfg.super_bonus_rarity_common || 0);
  console.log(`│ 📊 TOTAL:          ${String(totalSB + '%').padEnd(55)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  process.exit(0);
}

track().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
