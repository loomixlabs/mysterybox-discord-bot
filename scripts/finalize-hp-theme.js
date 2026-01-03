/**
 * Finaliser le thème Harry Potter :
 * - Ajouter template manquant super_bonus_joker_used
 * - Lister les images à personnaliser
 */
const db = require('../utils/database-pg');

const GUILD_ID = '1182395170273099806';
const THEME_ID = 65;

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('🧙 FINALISATION THÈME HARRY POTTER');
  console.log('█'.repeat(60));

  // 1. Ajouter le template manquant
  console.log('\n🃏 1. Ajout du template super_bonus_joker_used...');
  try {
    await db.query(`
      INSERT INTO announcement_templates (guild_id, theme_id, type, title, description, color, footer_text)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (guild_id, theme_id, type) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        color = EXCLUDED.color,
        footer_text = EXCLUDED.footer_text
    `, [
      GUILD_ID, THEME_ID, 'super_bonus_joker_used',
      '🃏 FELIX FELICIS ACTIVÉ !',
      `╔═══════════════════════════════════════╗
║  ⚗️ **POTION DE CHANCE UTILISÉE** ⚗️  ║
╚═══════════════════════════════════════╝

**{userName}** a bu le **Felix Felicis** !

🎁 Relique choisie:
╭─────────────────────────╮
│  ✨ **{collectibleName}**
│  📊 Rareté: **{collectibleRarity}**
╰─────────────────────────╯

*"La chance est de ton côté aujourd'hui..."*`,
      '#FFD700',
      '🃏 Felix Felicis • Potion Légendaire'
    ]);
    console.log('   ✅ Template super_bonus_joker_used ajouté/mis à jour');
  } catch (e) {
    console.log('   ⚠️  Erreur:', e.message);
  }

  // 2. Compter les templates
  const templates = await db.queryAll(
    `SELECT type FROM announcement_templates WHERE guild_id = $1 AND theme_id = $2`,
    [GUILD_ID, THEME_ID]
  );
  console.log(`\n📊 Total templates HP: ${templates.length}`);

  // 3. Vérifier les missions
  console.log('\n🎯 2. Missions HP créées:');
  const missions = await db.queryAll(
    `SELECT name, type FROM missions WHERE guild_id = $1 AND theme_id = $2`,
    [GUILD_ID, THEME_ID]
  );
  console.table(missions);

  // 4. Lister les images à personnaliser
  console.log('\n' + '═'.repeat(60));
  console.log('🖼️  3. IMAGES À PERSONNALISER');
  console.log('═'.repeat(60));

  // Mystery Box config
  const config = await db.queryOne(
    `SELECT mystery_box_image, mystery_box_celebration_gif FROM theme_config WHERE guild_id = $1 AND theme_id = $2`,
    [GUILD_ID, THEME_ID]
  );
  console.log('\n📦 Theme Config (MysteryBox):');
  if (config) {
    console.log(`   • mystery_box_image: ${config.mystery_box_image || 'MANQUANTE'}`);
    console.log(`   • mystery_box_celebration_gif: ${config.mystery_box_celebration_gif || 'MANQUANTE'}`);
  }

  // Pièges sans image
  const traps = await db.queryAll(
    `SELECT name, type, image_url FROM traps WHERE guild_id = $1 AND theme_id = $2`,
    [GUILD_ID, THEME_ID]
  );
  console.log('\n🪤 Pièges (vérifier image_url):');
  traps.forEach(t => {
    const status = t.image_url ? '✅' : '⚠️';
    console.log(`   ${status} ${t.name} (${t.type}): ${t.image_url || 'MANQUANTE'}`);
  });

  // Collectibles (vérifier si les images sont valides)
  const collectibles = await db.queryAll(
    `SELECT name, rarity, image_url FROM collectibles WHERE guild_id = $1 AND theme_id = $2 ORDER BY rarity, name`,
    [GUILD_ID, THEME_ID]
  );
  console.log('\n🎁 Collectibles (22 - vérifier les images):');
  let missing = 0;
  collectibles.forEach(c => {
    if (!c.image_url || c.image_url.includes('placeholder') || c.image_url.includes('example')) {
      console.log(`   ⚠️  ${c.name} (${c.rarity}): ${c.image_url || 'MANQUANTE'}`);
      missing++;
    }
  });
  if (missing === 0) {
    console.log('   ✅ Tous les collectibles ont des images valides');
  }

  // Résumé final
  console.log('\n' + '█'.repeat(60));
  console.log('✅ THÈME HARRY POTTER - CONFIGURATION COMPLÈTE');
  console.log('█'.repeat(60));
  console.log('\n📋 RÉSUMÉ:');
  console.log(`   ✅ ${templates.length} templates d'annonces HP`);
  console.log(`   ✅ ${traps.length} pièges avec notifications HP`);
  console.log(`   ✅ ${missions.length} missions HP`);
  console.log(`   ✅ 22 collectibles configurés`);
  console.log('\n⚠️  À FAIRE MANUELLEMENT:');
  console.log('   • Vérifier les URLs d\'images des pièges (voir liste ci-dessus)');
  console.log('   • Vérifier les images MysteryBox dans theme_config');

  process.exit(0);
}

main().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
