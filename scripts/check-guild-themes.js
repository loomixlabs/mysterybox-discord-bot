/**
 * Script pour vérifier les thèmes d'un serveur
 */
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function checkGuildThemes() {
  console.log('═'.repeat(80));
  console.log('🔍 VÉRIFICATION DES THÈMES DU SERVEUR', GUILD_ID);
  console.log('═'.repeat(80));

  // 1. Thèmes dans la table themes (serveur)
  console.log('\n📋 1. THÈMES SUR LE SERVEUR (table themes)\n');
  const guildThemes = await db.queryAll(`
    SELECT id, theme_id, name, is_active, required_items,
           final_role_name, created_at
    FROM themes
    WHERE guild_id = $1
    ORDER BY is_active DESC, name
  `, [GUILD_ID]);

  if (guildThemes.length > 0) {
    console.table(guildThemes.map(t => ({
      id: t.id,
      theme_id: (t.theme_id || '').substring(0, 25),
      name: (t.name || '').substring(0, 25),
      is_active: t.is_active ? '✅ ACTIF' : '❌',
      required_items: t.required_items,
      final_role: t.final_role_name
    })));
  } else {
    console.log('  ⚠️ Aucun thème trouvé sur ce serveur');
  }

  // 2. Thème actif détaillé
  console.log('\n📋 2. THÈME ACTIF DÉTAILLÉ\n');
  const activeTheme = await db.queryOne(`
    SELECT * FROM themes WHERE guild_id = $1 AND is_active = TRUE
  `, [GUILD_ID]);

  if (activeTheme) {
    console.log('  ID:', activeTheme.id);
    console.log('  theme_id:', activeTheme.theme_id);
    console.log('  Nom:', activeTheme.name);
    console.log('  Items requis:', activeTheme.required_items);
    console.log('  Rôle final:', activeTheme.final_role_name);
    console.log('  Créé le:', activeTheme.created_at);
  } else {
    console.log('  ⚠️ Aucun thème actif');
  }

  // 3. Collectibles du thème actif
  if (activeTheme) {
    console.log('\n📋 3. COLLECTIBLES DU THÈME ACTIF\n');
    const collectibles = await db.queryAll(`
      SELECT name, rarity, emoji FROM collectibles
      WHERE guild_id = $1 AND theme_id = $2
      ORDER BY rarity DESC, name
    `, [GUILD_ID, activeTheme.id]);

    console.log(`  Total: ${collectibles.length} collectibles`);
    if (collectibles.length > 0) {
      console.table(collectibles.slice(0, 10).map(c => ({
        name: c.name,
        rarity: c.rarity,
        emoji: c.emoji
      })));
    }
  }

  console.log('\n' + '═'.repeat(80));
  process.exit(0);
}

checkGuildThemes().catch(e => {
  console.error('❌ Erreur:', e.message);
  process.exit(1);
});
