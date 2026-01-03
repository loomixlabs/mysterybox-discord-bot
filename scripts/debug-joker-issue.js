/**
 * Debug MysteryBox Joker - Investigation du bug
 */
const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624';
const DISCORD_ID = '297307186307006464'; // xmicordix

async function debug() {
  console.log('🔍 DEBUG MYSTERYBOX JOKER\n');
  console.log('='.repeat(60));

  try {
    // 1. Vérifier le joueur
    console.log('\n📋 1. JOUEUR');
    const player = await db.queryOne(`
      SELECT id, discord_id, username
      FROM players
      WHERE discord_id = $1 AND guild_id = $2
    `, [DISCORD_ID, GUILD_ID]);

    if (!player) {
      console.log('❌ Joueur non trouvé !');
      process.exit(1);
    }
    console.log(`   ID: ${player.id}, Username: ${player.username}`);

    // 2. Vérifier le thème actif
    console.log('\n📋 2. THÈME ACTIF');
    const theme = await db.queryOne(`
      SELECT id, name
      FROM themes
      WHERE guild_id = $1 AND is_active = TRUE
    `, [GUILD_ID]);

    if (!theme) {
      console.log('❌ Aucun thème actif !');
      process.exit(1);
    }
    console.log(`   ID: ${theme.id}, Name: ${theme.name}`);

    // 3. Vérifier les collectibles du thème
    console.log('\n📋 3. COLLECTIBLES DU THÈME');
    const collectibles = await db.queryAll(`
      SELECT id, name, rarity
      FROM collectibles
      WHERE guild_id = $1 AND theme_id = $2
      ORDER BY rarity DESC, name
    `, [GUILD_ID, theme.id]);
    console.log(`   ${collectibles.length} collectibles trouvés:`);
    collectibles.forEach(c => console.log(`   - [${c.rarity}] ${c.name} (ID: ${c.id})`));

    // 4. Vérifier la collection du joueur
    console.log('\n📋 4. COLLECTION DU JOUEUR');
    const owned = await db.queryAll(`
      SELECT c.id, col.name, col.rarity, c.lost_at
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND col.theme_id = $3
    `, [GUILD_ID, player.id, theme.id]);
    console.log(`   ${owned.length} entrées dans collections:`);
    owned.forEach(o => console.log(`   - ${o.name} [${o.rarity}] ${o.lost_at ? '(PERDU: ' + o.lost_at + ')' : '(possédé)'}`));

    // 5. Collectibles possédés (non perdus)
    console.log('\n📋 5. COLLECTIBLES POSSÉDÉS (lost_at IS NULL)');
    const ownedActive = await db.queryAll(`
      SELECT c.collectible_id, col.name, col.rarity
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND col.theme_id = $3 AND c.lost_at IS NULL
    `, [GUILD_ID, player.id, theme.id]);
    console.log(`   ${ownedActive.length} collectibles possédés`);
    ownedActive.forEach(o => console.log(`   - ${o.name} [${o.rarity}]`));

    // 6. Bonus joker assigné
    console.log('\n📋 6. BONUS JOKER ASSIGNÉ');
    const jokerBonus = await db.queryAll(`
      SELECT pab.id, sb.name, sb.effect_type, pab.remaining_charges, pab.is_active
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.super_bonus_id = sb.id
      WHERE pab.guild_id = $1 AND pab.player_id = $2 AND sb.effect_type = 'joker'
    `, [GUILD_ID, player.id]);
    console.log(`   ${jokerBonus.length} bonus joker trouvé(s)`);
    jokerBonus.forEach(b => console.log(`   - ${b.name}: charges=${b.remaining_charges}, active=${b.is_active}`));

    // 7. Tous les bonus du joueur
    console.log('\n📋 7. TOUS LES BONUS DU JOUEUR');
    const allBonuses = await db.queryAll(`
      SELECT pab.id, sb.name, sb.effect_type, pab.remaining_charges, pab.is_active
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.super_bonus_id = sb.id
      WHERE pab.guild_id = $1 AND pab.player_id = $2
    `, [GUILD_ID, player.id]);
    console.log(`   ${allBonuses.length} bonus trouvé(s)`);
    allBonuses.forEach(b => console.log(`   - ${b.name} [${b.effect_type}]: charges=${b.remaining_charges}, active=${b.is_active}`));

    // 8. Calcul des collectibles manquants (même logique que getMissingCollectibles)
    console.log('\n📋 8. CALCUL COLLECTIBLES MANQUANTS');
    const ownedIds = ownedActive.map(o => o.collectible_id);
    const missing = collectibles.filter(c => !ownedIds.includes(c.id));
    console.log(`   ${missing.length} collectibles manquants:`);
    missing.forEach(m => console.log(`   - [${m.rarity}] ${m.name}`));

    console.log('\n' + '='.repeat(60));
    console.log('✅ Debug terminé');
    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

debug();
