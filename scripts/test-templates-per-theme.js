/**
 * Test: Vérifier que les templates sont créés par thème
 */
const db = require('../utils/database-pg');

async function test() {
  console.log('\n🧪 TEST: Templates par thème\n');
  console.log('='.repeat(70));

  try {
    const guildId = '1248028543389143070'; // Test server

    // 1. Lister les thèmes existants
    console.log('\n📋 1. Thèmes existants:');
    console.log('─'.repeat(50));
    const themes = await db.queryAll(
      'SELECT id, name, is_active FROM themes WHERE guild_id = $1 ORDER BY id',
      [guildId]
    );
    console.table(themes);

    // 2. Compter les templates par theme_id
    console.log('\n📋 2. Templates par theme_id:');
    console.log('─'.repeat(50));
    const templateCounts = await db.queryAll(`
      SELECT
        theme_id,
        COUNT(*) as count,
        CASE WHEN theme_id IS NULL THEN 'Global (NULL)' ELSE 'Thème ' || theme_id::text END as description
      FROM announcement_templates
      WHERE guild_id = $1
      GROUP BY theme_id
      ORDER BY theme_id NULLS FIRST
    `, [guildId]);
    console.table(templateCounts);

    // 3. Détails templates pour le thème actif
    console.log('\n📋 3. Templates pour le thème actif:');
    console.log('─'.repeat(50));
    const activeTheme = themes.find(t => t.is_active);
    if (activeTheme) {
      const activeTemplates = await db.queryAll(`
        SELECT type, title, theme_id
        FROM announcement_templates
        WHERE guild_id = $1 AND theme_id = $2
        ORDER BY type
      `, [guildId, activeTheme.id]);

      if (activeTemplates.length === 0) {
        console.log(`   ⚠️ AUCUN template spécifique pour le thème actif (${activeTheme.name})`);
        console.log('   → Le système utilise les templates globaux (theme_id = NULL)');

        // Afficher les templates globaux
        const globalTemplates = await db.queryAll(`
          SELECT type, title,
            CASE WHEN title LIKE '%pomme%' OR title LIKE '%Pomme%' THEN '⚠️ THEMED' ELSE '✅ Generic' END as status
          FROM announcement_templates
          WHERE guild_id = $1 AND theme_id IS NULL
          ORDER BY type
        `, [guildId]);
        console.log('\n   Templates globaux (fallback):');
        console.table(globalTemplates);
      } else {
        console.log(`   ✅ ${activeTemplates.length} templates pour thème "${activeTheme.name}"`);
        console.table(activeTemplates);
      }
    } else {
      console.log('   ❌ Aucun thème actif');
    }

    // 4. Test de simulation: créer templates pour un thème existant
    console.log('\n📋 4. Test: Créer templates pour thème actif (simulation):');
    console.log('─'.repeat(50));
    if (activeTheme) {
      const { createDefaultTemplatesForTheme } = require('../utils/announcementDefaults');
      const created = await createDefaultTemplatesForTheme(guildId, activeTheme.id);
      console.log(`   → ${created} templates créés pour thème ${activeTheme.id}`);
    }

    // 5. Re-compter après création
    console.log('\n📋 5. Templates après création:');
    console.log('─'.repeat(50));
    const templateCountsAfter = await db.queryAll(`
      SELECT
        theme_id,
        COUNT(*) as count,
        CASE WHEN theme_id IS NULL THEN 'Global (NULL)' ELSE 'Thème ' || theme_id::text END as description
      FROM announcement_templates
      WHERE guild_id = $1
      GROUP BY theme_id
      ORDER BY theme_id NULLS FIRST
    `, [guildId]);
    console.table(templateCountsAfter);

    console.log('\n' + '='.repeat(70));
    console.log('✅ Test terminé\n');
    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

test();
