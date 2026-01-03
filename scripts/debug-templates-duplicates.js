/**
 * Script de diagnostic pour les templates d'annonces - Doublons
 */

const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624';

async function debug() {
  console.log('='.repeat(80));
  console.log(`🔍 DIAGNOSTIC DOUBLONS TEMPLATES - Guild: ${GUILD_ID}`);
  console.log('='.repeat(80));

  try {
    // 1. Templates avec theme_id IS NULL (ceux utilisés par showTemplatesListMenu)
    console.log('\n1. Templates GLOBAUX (theme_id IS NULL):');
    const globalTemplates = await db.queryAll(`
      SELECT id, type, title, theme_id
      FROM announcement_templates
      WHERE guild_id = $1 AND theme_id IS NULL
      ORDER BY type
    `, [GUILD_ID]);

    console.log(`   Total: ${globalTemplates.length} templates globaux`);
    console.table(globalTemplates);

    // 2. Vérifier les doublons par type (problème pour StringSelectMenu)
    console.log('\n2. Recherche de DOUBLONS par type (theme_id IS NULL):');
    const duplicates = await db.queryAll(`
      SELECT type, COUNT(*) as count
      FROM announcement_templates
      WHERE guild_id = $1 AND theme_id IS NULL
      GROUP BY type
      HAVING COUNT(*) > 1
    `, [GUILD_ID]);

    if (duplicates.length > 0) {
      console.log('   ⚠️ DOUBLONS TROUVÉS (cause du bug) !');
      console.table(duplicates);

      // Détails des doublons
      for (const dup of duplicates) {
        console.log(`\n   Détails pour type "${dup.type}":`);
        const details = await db.queryAll(`
          SELECT id, type, title, created_at
          FROM announcement_templates
          WHERE guild_id = $1 AND theme_id IS NULL AND type = $2
          ORDER BY id
        `, [GUILD_ID, dup.type]);
        console.table(details);
      }
    } else {
      console.log('   ✅ Aucun doublon (theme_id IS NULL)');
    }

    // 3. Vérifier si le problème vient d'ailleurs
    console.log('\n3. Comparaison avec autres serveurs (templates globaux):');
    const guildCounts = await db.queryAll(`
      SELECT guild_id, COUNT(*) as global_count
      FROM announcement_templates
      WHERE theme_id IS NULL
      GROUP BY guild_id
      ORDER BY global_count DESC
    `);
    console.table(guildCounts);

    // 4. Vérifier les types distincts
    console.log('\n4. Types de templates distincts pour ce guild:');
    const types = await db.queryAll(`
      SELECT DISTINCT type
      FROM announcement_templates
      WHERE guild_id = $1 AND theme_id IS NULL
      ORDER BY type
    `, [GUILD_ID]);
    console.log(`   ${types.length} types distincts (max 25 pour Discord)`);
    types.forEach(t => console.log(`   - ${t.type}`));

    // 5. Test du problème réel - simulation du code
    console.log('\n5. SIMULATION du code showTemplatesListMenu:');
    const templates = await db.queryAll(`
      SELECT * FROM announcement_templates
      WHERE guild_id = $1 AND theme_id IS NULL
      ORDER BY type
    `, [GUILD_ID]);

    console.log(`   Total templates récupérés: ${templates.length}`);

    // Vérifier les values uniques (comme Discord le fait)
    const values = templates.map(t => t.type);
    const uniqueValues = [...new Set(values)];
    console.log(`   Values uniques: ${uniqueValues.length}`);

    if (values.length !== uniqueValues.length) {
      console.log('   ❌ ERREUR: Doublons dans les values du StringSelectMenu!');
      console.log('   Discord n\'accepte pas de values dupliquées.');
      console.log('   C\'est la cause de l\'erreur!');
    } else {
      console.log('   ✅ Pas de doublons dans les values');
    }

    if (templates.length > 25) {
      console.log(`   ❌ ERREUR: ${templates.length} templates > 25 (limite Discord)!`);
    }

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error('   Stack:', error.stack);
  }

  process.exit(0);
}

debug();
