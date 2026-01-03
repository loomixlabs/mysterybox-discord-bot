/**
 * Migration: Ajout des annonces pour le système d'évolution des collectibles
 *
 * Cette migration ajoute:
 * - 3 nouvelles colonnes dans announcement_settings (toggles)
 * - 3 nouveaux templates dans announcement_templates
 */

require('dotenv').config();
const db = require('../utils/database-pg');
const { DEFAULT_ANNOUNCEMENT_TEMPLATES } = require('../utils/announcementDefaults');

async function runMigration() {
  console.log('🚀 Migration: Annonces évolution collectibles');
  console.log('='.repeat(60));

  try {
    // Étape 1: Ajouter les colonnes dans announcement_settings
    console.log('\n📋 Étape 1: Ajout des colonnes dans announcement_settings...');

    const columnsToAdd = [
      { name: 'collectible_level_up', default: true },
      { name: 'collectible_max_level', default: true },
      { name: 'collectible_restored', default: true }
    ];

    for (const col of columnsToAdd) {
      try {
        await db.query(`
          ALTER TABLE announcement_settings
          ADD COLUMN IF NOT EXISTS ${col.name} BOOLEAN DEFAULT ${col.default}
        `);
        console.log(`   ✅ Colonne ${col.name} ajoutée/existante`);
      } catch (error) {
        if (error.code === '42701') { // Column already exists
          console.log(`   ⏭️  Colonne ${col.name} existe déjà`);
        } else {
          throw error;
        }
      }
    }

    // Étape 2: Mettre à jour les serveurs existants (activer les toggles)
    console.log('\n📋 Étape 2: Activation des toggles pour serveurs existants...');

    const updateResult = await db.query(`
      UPDATE announcement_settings
      SET
        collectible_level_up = COALESCE(collectible_level_up, TRUE),
        collectible_max_level = COALESCE(collectible_max_level, TRUE),
        collectible_restored = COALESCE(collectible_restored, TRUE)
    `);
    console.log(`   ✅ ${updateResult.rowCount || 0} serveur(s) mis à jour`);

    // Étape 3: Ajouter les templates pour chaque serveur existant
    console.log('\n📋 Étape 3: Ajout des templates par défaut...');

    // Récupérer tous les guilds uniques de announcement_templates
    const guilds = await db.queryAll(`
      SELECT DISTINCT guild_id FROM announcement_templates
    `);
    console.log(`   📊 ${guilds.length} serveur(s) trouvé(s)`);

    // Templates à ajouter (filtrés depuis DEFAULT_ANNOUNCEMENT_TEMPLATES)
    const newTemplates = DEFAULT_ANNOUNCEMENT_TEMPLATES.filter(t =>
      ['collectible_level_up', 'collectible_max_level', 'collectible_restored'].includes(t.type)
    );
    console.log(`   📄 ${newTemplates.length} template(s) à ajouter par serveur`);

    let totalCreated = 0;
    for (const guild of guilds) {
      const guildId = guild.guild_id;

      for (const template of newTemplates) {
        // Vérifier si le template existe déjà (global, sans theme_id)
        const existing = await db.queryOne(`
          SELECT id FROM announcement_templates
          WHERE guild_id = $1 AND type = $2 AND theme_id IS NULL
        `, [guildId, template.type]);

        if (!existing) {
          await db.query(`
            INSERT INTO announcement_templates (
              guild_id, type, title, description, color, footer_text, image_url, thumbnail_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            guildId,
            template.type,
            template.title,
            template.description,
            template.color,
            template.footer_text,
            template.image_url,
            template.thumbnail_url
          ]);
          totalCreated++;
          console.log(`   ✅ Template ${template.type} créé pour ${guildId}`);
        } else {
          console.log(`   ⏭️  Template ${template.type} existe déjà pour ${guildId}`);
        }
      }
    }

    console.log(`\n   📊 Total: ${totalCreated} template(s) créé(s)`);

    // Étape 4: Vérification finale
    console.log('\n📋 Étape 4: Vérification...');

    const verifyColumns = await db.queryOne(`
      SELECT
        COUNT(*) FILTER (WHERE collectible_level_up IS NOT NULL) as level_up_count,
        COUNT(*) FILTER (WHERE collectible_max_level IS NOT NULL) as max_level_count,
        COUNT(*) FILTER (WHERE collectible_restored IS NOT NULL) as restored_count
      FROM announcement_settings
    `);
    console.log(`   ✅ Colonnes vérifiées:
      - collectible_level_up: ${verifyColumns.level_up_count} entrées
      - collectible_max_level: ${verifyColumns.max_level_count} entrées
      - collectible_restored: ${verifyColumns.restored_count} entrées`);

    const verifyTemplates = await db.queryAll(`
      SELECT type, COUNT(*) as count
      FROM announcement_templates
      WHERE type IN ('collectible_level_up', 'collectible_max_level', 'collectible_restored')
      GROUP BY type
    `);
    console.log('   ✅ Templates vérifiés:');
    verifyTemplates.forEach(t => {
      console.log(`      - ${t.type}: ${t.count} template(s)`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration terminée avec succès !');
    console.log('\nNouvelles annonces disponibles:');
    console.log('  - collectible_level_up: Quand un collectible monte de niveau');
    console.log('  - collectible_max_level: Quand un collectible atteint le niveau max');
    console.log('  - collectible_restored: Quand un collectible perdu est restauré');

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
