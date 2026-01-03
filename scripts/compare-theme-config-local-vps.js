/**
 * Comparaison theme_config local vs VPS
 */

const db = require('../utils/database-pg');

async function compare() {
  console.log('🔍 COMPARAISON THEME_CONFIG - LOCAL vs VPS');
  console.log('='.repeat(80));

  try {
    // 1. Vérifier les colonnes de theme_config
    console.log('\n📋 Structure de la table theme_config locale:');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      ORDER BY ordinal_position
    `);

    for (const col of columns) {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    }

    // 2. Vérifier si progression_roles existe
    const hasProgressionRoles = columns.some(c => c.column_name === 'progression_roles');

    console.log('\n' + '='.repeat(80));
    if (hasProgressionRoles) {
      console.log('✅ La colonne progression_roles EXISTE localement');
    } else {
      console.log('❌ La colonne progression_roles MANQUE localement!');
      console.log('   → Il faut ajouter cette colonne pour que les rôles de progression fonctionnent');
    }

    // 3. Chercher le thème testv3
    console.log('\n📋 Thème testv3:');
    const theme = await db.queryOne(`
      SELECT id, theme_id, name, guild_id FROM themes WHERE theme_id = 'testv3'
    `);

    if (theme) {
      console.log(`   ID: ${theme.id}, Nom: ${theme.name}, Guild: ${theme.guild_id}`);

      // 4. Vérifier theme_config pour ce thème
      console.log('\n📋 Configuration theme_config pour testv3:');

      if (hasProgressionRoles) {
        const config = await db.queryOne(`
          SELECT *, progression_roles::text as progression_roles_text
          FROM theme_config
          WHERE theme_id = $1
        `, [theme.id]);

        if (config) {
          console.log(`   - probability_collectible: ${config.probability_collectible}`);
          console.log(`   - probability_mission: ${config.probability_mission}`);
          console.log(`   - probability_trap: ${config.probability_trap}`);
          console.log(`   - probability_super_bonus: ${config.probability_super_bonus}`);
          console.log(`   - progression_roles: ${config.progression_roles_text}`);

          if (config.progression_roles_text === '[]' || !config.progression_roles_text) {
            console.log('\n❌ PROBLÈME: progression_roles est vide!');
            console.log('   Les rôles de progression ne sont pas configurés pour ce thème.');
          } else {
            console.log('\n✅ Rôles de progression configurés');
          }
        } else {
          console.log('   ❌ Aucune configuration theme_config trouvée pour ce thème');
        }
      } else {
        const config = await db.queryOne(`
          SELECT * FROM theme_config WHERE theme_id = $1
        `, [theme.id]);

        if (config) {
          console.log(`   Configuration trouvée (sans colonne progression_roles):`);
          console.log(`   - probability_collectible: ${config.probability_collectible}`);
          console.log(`   - probability_mission: ${config.probability_mission}`);
          console.log(`   - probability_trap: ${config.probability_trap}`);
        } else {
          console.log('   ❌ Aucune configuration theme_config trouvée');
        }
      }
    } else {
      console.log('   ❌ Thème testv3 non trouvé');
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(80));

    if (!hasProgressionRoles) {
      console.log('\n🔧 SOLUTION REQUISE:');
      console.log('   ALTER TABLE theme_config ADD COLUMN progression_roles JSONB DEFAULT \'[]\'::jsonb;');
      console.log('   CREATE INDEX idx_theme_config_progression_roles ON theme_config USING gin (progression_roles);');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

compare();
