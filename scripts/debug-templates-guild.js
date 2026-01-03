/**
 * Script de diagnostic pour les templates d'annonces d'un guild spécifique
 */

const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624';

async function debug() {
  console.log('='.repeat(80));
  console.log(`🔍 DIAGNOSTIC TEMPLATES - Guild: ${GUILD_ID}`);
  console.log('='.repeat(80));

  try {
    // 1. Vérifier si le guild existe dans guild_config
    console.log('\n1. Vérification guild_config:');
    const guildConfig = await db.queryOne(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [GUILD_ID]
    );
    console.log('   guild_config:', guildConfig ? 'EXISTE' : 'N\'EXISTE PAS');
    if (guildConfig) {
      console.log('   - bot_status:', guildConfig.bot_status);
      console.log('   - created_at:', guildConfig.created_at);
    }

    // 2. Compter les templates pour ce guild
    console.log('\n2. Nombre de templates:');
    const countResult = await db.queryOne(
      'SELECT COUNT(*) as count FROM announcement_templates WHERE guild_id = $1',
      [GUILD_ID]
    );
    console.log(`   Total templates: ${countResult?.count || 0}`);

    // 3. Lister les templates par type
    console.log('\n3. Templates par type:');
    const templates = await db.queryAll(
      'SELECT id, type, title, theme_id, created_at FROM announcement_templates WHERE guild_id = $1 ORDER BY type',
      [GUILD_ID]
    );

    if (templates.length === 0) {
      console.log('   ⚠️  AUCUN TEMPLATE TROUVÉ pour ce guild!');
    } else {
      console.table(templates);
    }

    // 4. Vérifier s'il y a des templates avec des données corrompues
    console.log('\n4. Vérification des données corrompues:');
    const corruptedTemplates = await db.queryAll(`
      SELECT id, type,
             CASE WHEN title IS NULL THEN 'NULL title' ELSE 'OK' END as title_status,
             CASE WHEN description IS NULL THEN 'NULL desc' ELSE 'OK' END as desc_status,
             CASE WHEN color IS NULL THEN 'NULL color' ELSE 'OK' END as color_status
      FROM announcement_templates
      WHERE guild_id = $1
        AND (title IS NULL OR description IS NULL OR color IS NULL)
    `, [GUILD_ID]);

    if (corruptedTemplates.length > 0) {
      console.log('   ⚠️  Templates avec données NULL:');
      console.table(corruptedTemplates);
    } else {
      console.log('   ✅ Aucune donnée corrompue détectée');
    }

    // 5. Comparer avec un guild qui fonctionne
    console.log('\n5. Comparaison avec autres guilds:');
    const guildCounts = await db.queryAll(`
      SELECT guild_id, COUNT(*) as template_count
      FROM announcement_templates
      GROUP BY guild_id
      ORDER BY template_count DESC
    `);
    console.table(guildCounts);

    // 6. Vérifier la structure des templates pour ce guild vs un autre
    console.log('\n6. Exemple de template (guild problématique):');
    const sampleTemplate = await db.queryOne(
      'SELECT * FROM announcement_templates WHERE guild_id = $1 LIMIT 1',
      [GUILD_ID]
    );
    if (sampleTemplate) {
      console.log('   ID:', sampleTemplate.id);
      console.log('   Type:', sampleTemplate.type);
      console.log('   Title:', sampleTemplate.title?.substring(0, 50) + '...');
      console.log('   Theme ID:', sampleTemplate.theme_id);
    } else {
      console.log('   ⚠️  Aucun template à afficher');
    }

    // 7. Vérifier les templates d'un guild qui fonctionne
    console.log('\n7. Exemple de template (guild fonctionnel):');
    const workingGuild = guildCounts.find(g => g.guild_id !== GUILD_ID && parseInt(g.template_count) > 10);
    if (workingGuild) {
      const workingSample = await db.queryOne(
        'SELECT id, type, title, theme_id FROM announcement_templates WHERE guild_id = $1 LIMIT 1',
        [workingGuild.guild_id]
      );
      console.log('   Guild ID:', workingGuild.guild_id);
      console.log('   Template count:', workingGuild.template_count);
      if (workingSample) {
        console.log('   Sample - ID:', workingSample.id, 'Type:', workingSample.type);
      }
    }

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error('   Stack:', error.stack);
  }

  process.exit(0);
}

debug();
