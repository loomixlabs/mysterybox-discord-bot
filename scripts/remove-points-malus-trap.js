const fs = require('fs');
const path = require('path');
const db = require('../utils/database-pg');

/**
 * Script pour supprimer complètement le type de piège "points-malus"
 * qui n'est plus utilisé dans le système
 */

async function removePointsMalusTrap() {
  console.log('🗑️  SUPPRESSION DU PIÈGE "points-malus"\n');
  console.log('='.repeat(80));

  // 1. Supprimer de la base de données
  console.log('\n📊 1. Suppression des pièges "points-malus" de la DB...');
  try {
    const result = await db.query(`
      DELETE FROM traps
      WHERE type = 'points-malus' OR trap_id LIKE '%malus%'
      RETURNING id, guild_id, theme_id, trap_id, name
    `);
    if (result.rows && result.rows.length > 0) {
      console.log(`✅ ${result.rows.length} piège(s) supprimé(s):`);
      console.table(result.rows);
    } else {
      console.log('✅ Aucun piège à supprimer');
    }
  } catch (error) {
    console.error('❌ Erreur DB:', error.message);
  }

  // 2. Fichiers à modifier (handlers)
  console.log('\n📁 2. Fichiers à modifier manuellement:');
  console.log(`
  Les fichiers suivants contiennent encore des références à "points-malus":

  1. handlers/trapAdminHandler.js
     - Lignes 61, 86-87, 131, 329, 458, 467, 501, 803, 869, 1161, 1174, 1185
     - Supprimer les entrées 'points-malus' des objets de mapping
     - Supprimer les conditions "else if (trap.type === 'points-malus')"
     - Supprimer l'option de type dans les select menus

  2. handlers/adminPanelHandler.js
     - Lignes 2906, 6838, 6927, 6967
     - Supprimer les entrées 'points-malus' des mappings

  3. handlers/mysteryBoxHandler.js
     - Ligne 1011: Supprimer le case 'points-malus'

  4. handlers/modalHandler.js
     - Ligne 1456: Supprimer la condition "else if (trapType === 'points-malus')"

  5. themes/schema/theme.schema.json
     - Supprimer "points-malus" de l'enum des types de pièges

  6. utils/themeValidator.js, utils/themeImporter.js, utils/themeExporter.js
     - Supprimer les références si présentes
  `);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Suppression DB terminée. Modifier les fichiers manuellement.');

  process.exit(0);
}

removePointsMalusTrap();
