/**
 * Script de tracking pour suivre la création d'un nouveau thème
 * Utilise la config DB du bot discord
 */
const db = require('../utils/database-pg');

async function showCurrentState() {
  console.log('═'.repeat(80));
  console.log('🔍 ÉTAT ACTUEL DE themes_library');
  console.log('═'.repeat(80));

  // Compte total
  const countResult = await db.queryOne(`
    SELECT COUNT(*) as total FROM themes_library
  `);
  console.log(`\n📊 Total: ${countResult.total} thème(s)\n`);

  // Structure de la table
  console.log('📋 STRUCTURE DE LA TABLE:');
  const cols = await db.queryAll(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'themes_library'
    ORDER BY ordinal_position
  `);
  console.table(cols.map(c => ({
    colonne: c.column_name,
    type: c.data_type,
    nullable: c.is_nullable
  })));

  // Derniers thèmes
  console.log('\n📚 DERNIERS THÈMES (5):');
  const themes = await db.queryAll(`
    SELECT
      theme_id,
      name,
      visibility,
      is_draft,
      version,
      creator_username,
      creator_discord_id,
      created_at,
      updated_at
    FROM themes_library
    ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
    LIMIT 5
  `);

  if (themes.length > 0) {
    console.table(themes.map(t => ({
      theme_id: (t.theme_id || '').substring(0, 20) + '...',
      name: (t.name || '').substring(0, 20),
      visibility: t.visibility,
      is_draft: t.is_draft ? '📝 Brouillon' : '✅ Déployé',
      version: t.version || '1.0.0',
      creator: t.creator_username,
      discord_id: t.creator_discord_id
    })));
  } else {
    console.log('  (aucun thème)');
  }

  // Détails du dernier thème
  if (themes.length > 0) {
    const lastTheme = themes[0];
    console.log('\n📋 DÉTAILS DU DERNIER THÈME:');
    console.log('─'.repeat(60));
    console.log('  ID:', lastTheme.theme_id);
    console.log('  Nom:', lastTheme.name);
    console.log('  Visibilité:', lastTheme.visibility);
    console.log('  Brouillon:', lastTheme.is_draft ? 'OUI' : 'NON');
    console.log('  Version:', lastTheme.version);
    console.log('  Créateur:', lastTheme.creator_username, `(${lastTheme.creator_discord_id})`);
    console.log('  Créé le:', lastTheme.created_at);
    console.log('  Mis à jour:', lastTheme.updated_at);

    // Récupérer theme_data complet
    const fullTheme = await db.queryOne(`
      SELECT theme_data FROM themes_library WHERE theme_id = $1
    `, [lastTheme.theme_id]);

    if (fullTheme?.theme_data) {
      try {
        const data = typeof fullTheme.theme_data === 'string'
          ? JSON.parse(fullTheme.theme_data)
          : fullTheme.theme_data;

        console.log('\n  📦 CONTENU theme_data:');
        console.log('    - theme.theme_id:', data.theme?.theme_id);
        console.log('    - theme.name:', data.theme?.name);
        console.log('    - metadata.visibility:', data.metadata?.visibility);
        console.log('    - metadata.is_draft:', data.metadata?.is_draft);
        console.log('    - metadata.description:', (data.metadata?.description || '').substring(0, 50));
        console.log('    - metadata.tags:', data.metadata?.tags);
        console.log('    - collectibles:', data.collectibles?.length || 0);
        console.log('    - traps:', data.traps?.length || 0);
        console.log('    - missions:', data.missions?.length || 0);
      } catch (e) {
        console.log('    (theme_data non parsable:', e.message, ')');
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  process.exit(0);
}

showCurrentState().catch(e => {
  console.error('❌ Erreur:', e.message);
  process.exit(1);
});
