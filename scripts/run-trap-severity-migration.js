/**
 * Script d'exécution de la migration Système de Sévérité des Pièges
 * Exécute le fichier SQL: database/migrations/add-trap-severity.sql
 *
 * Usage: node scripts/run-trap-severity-migration.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../utils/database-pg');

async function runMigration() {
  console.log('='.repeat(80));
  console.log('🔧 MIGRATION: Système de Sévérité des Pièges');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Vérifier l'état AVANT migration
    console.log('📊 ÉTAT AVANT MIGRATION:');
    console.log('-'.repeat(60));

    // Vérifier si colonne severity existe déjà
    const severityExists = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'traps' AND column_name = 'severity'
    `);
    console.log(`   Colonne 'severity' dans traps: ${severityExists ? '✅ Existe' : '❌ N\'existe pas'}`);

    // Vérifier si colonnes trap_severity_* existent
    const configColumns = await db.queryAll(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'theme_config' AND column_name LIKE 'trap_severity_%'
      ORDER BY column_name
    `);
    console.log(`   Colonnes 'trap_severity_*' dans theme_config: ${configColumns.length}/5`);

    // Distribution actuelle des pièges par type
    const trapsByType = await db.queryAll(`
      SELECT type, COUNT(*) as count FROM traps GROUP BY type ORDER BY type
    `);
    console.log('\n   Distribution pièges par type:');
    trapsByType.forEach(t => console.log(`     - ${t.type}: ${t.count}`));

    console.log('\n');

    // Exécuter les étapes de migration manuellement (plus fiable que lire le fichier SQL)
    console.log('🚀 EXÉCUTION DE LA MIGRATION...');
    console.log('-'.repeat(60));

    // ÉTAPE 1: Ajouter colonne severity à traps
    if (!severityExists) {
      await db.query(`
        ALTER TABLE traps
        ADD COLUMN severity INTEGER DEFAULT 3
        CHECK (severity >= 1 AND severity <= 5)
      `);
      console.log('✅ Étape 1: Colonne severity ajoutée à traps');
    } else {
      console.log('⏭️  Étape 1: Colonne severity existe déjà');
    }

    // ÉTAPE 2: Ajouter colonnes trap_severity_* à theme_config
    const columnsToAdd = [
      { name: 'trap_severity_1', default: 45 },
      { name: 'trap_severity_2', default: 30 },
      { name: 'trap_severity_3', default: 15 },
      { name: 'trap_severity_4', default: 8 },
      { name: 'trap_severity_5', default: 2 }
    ];

    for (const col of columnsToAdd) {
      const exists = await db.queryOne(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'theme_config' AND column_name = $1
      `, [col.name]);

      if (!exists) {
        await db.query(`ALTER TABLE theme_config ADD COLUMN ${col.name} INTEGER DEFAULT ${col.default}`);
        console.log(`✅ Étape 2: Colonne ${col.name} ajoutée (default: ${col.default}%)`);
      } else {
        console.log(`⏭️  Étape 2: Colonne ${col.name} existe déjà`);
      }
    }

    // ÉTAPE 3: Migrer les pièges existants (assigner sévérité par type)
    const updateResult = await db.query(`
      UPDATE traps SET severity =
        CASE type
          WHEN 'empty-box' THEN 1
          WHEN 'cooldown' THEN 2
          WHEN 'points-malus' THEN 2
          WHEN 'lose-collectible' THEN 3
          WHEN 'public-shame' THEN 3
          WHEN 'lose-all-collectibles' THEN 5
          ELSE 3
        END
      WHERE severity IS NULL OR severity = 0
    `);
    console.log(`✅ Étape 3: ${updateResult.rowCount} piège(s) mis à jour avec sévérité`);

    // ÉTAPE 4: Mettre à jour les thèmes existants
    await db.query(`
      UPDATE theme_config SET
        trap_severity_1 = COALESCE(trap_severity_1, 45),
        trap_severity_2 = COALESCE(trap_severity_2, 30),
        trap_severity_3 = COALESCE(trap_severity_3, 15),
        trap_severity_4 = COALESCE(trap_severity_4, 8),
        trap_severity_5 = COALESCE(trap_severity_5, 2)
    `);
    console.log('✅ Étape 4: Configuration des thèmes mise à jour');

    console.log('\n');

    // Vérifier l'état APRÈS migration
    console.log('📊 ÉTAT APRÈS MIGRATION:');
    console.log('-'.repeat(60));

    // Distribution par sévérité
    const trapsBySeverity = await db.queryAll(`
      SELECT
        severity,
        CASE severity
          WHEN 1 THEN '⭐ Minor'
          WHEN 2 THEN '⭐⭐ Low'
          WHEN 3 THEN '⭐⭐⭐ Medium'
          WHEN 4 THEN '⭐⭐⭐⭐ High'
          WHEN 5 THEN '⭐⭐⭐⭐⭐ Extreme'
        END as label,
        COUNT(*) as count
      FROM traps
      WHERE severity IS NOT NULL
      GROUP BY severity
      ORDER BY severity
    `);

    console.log('\n   Distribution pièges par sévérité:');
    console.table(trapsBySeverity);

    // Afficher quelques exemples
    const examples = await db.queryAll(`
      SELECT name, type, severity FROM traps
      ORDER BY severity, type
      LIMIT 10
    `);
    console.log('\n   Exemples de pièges avec sévérité:');
    console.table(examples);

    // Vérifier la config
    const configExample = await db.queryOne(`
      SELECT trap_severity_1, trap_severity_2, trap_severity_3, trap_severity_4, trap_severity_5
      FROM theme_config LIMIT 1
    `);
    if (configExample) {
      console.log('\n   Configuration probabilités (1er thème):');
      console.log(`     Sévérité 1 (Minor):   ${configExample.trap_severity_1}%`);
      console.log(`     Sévérité 2 (Low):     ${configExample.trap_severity_2}%`);
      console.log(`     Sévérité 3 (Medium):  ${configExample.trap_severity_3}%`);
      console.log(`     Sévérité 4 (High):    ${configExample.trap_severity_4}%`);
      console.log(`     Sévérité 5 (Extreme): ${configExample.trap_severity_5}%`);
      const total = (configExample.trap_severity_1 || 0) +
                    (configExample.trap_severity_2 || 0) +
                    (configExample.trap_severity_3 || 0) +
                    (configExample.trap_severity_4 || 0) +
                    (configExample.trap_severity_5 || 0);
      console.log(`     TOTAL: ${total}%`);
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERREUR LORS DE LA MIGRATION:', error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
