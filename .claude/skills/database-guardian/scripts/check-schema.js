#!/usr/bin/env node
/**
 * Vérifie l'existence de tables/colonnes dans le schéma
 * Usage: node check-schema.js [table] [colonne]
 */

const fs = require('fs');
const path = require('path');

// Charger le schéma depuis DATABASE-SCHEMA.md
function loadSchema() {
  const schemaPath = path.join(process.cwd(), 'DATABASE-SCHEMA.md');
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ DATABASE-SCHEMA.md non trouvé');
    console.log('   Exécutez depuis le dossier du projet bot discord');
    process.exit(1);
  }
  return fs.readFileSync(schemaPath, 'utf8');
}

// Extraire les tables du schéma
function extractTables(schema) {
  const tables = {};
  const tableRegex = /### `(\w+)`\s*\n([\s\S]*?)(?=###|$)/g;
  let match;

  while ((match = tableRegex.exec(schema)) !== null) {
    const tableName = match[1];
    const content = match[2];

    // Extraire les colonnes
    const columnRegex = /\|\s*`(\w+)`\s*\|\s*`([^`]+)`/g;
    const columns = {};
    let colMatch;

    while ((colMatch = columnRegex.exec(content)) !== null) {
      columns[colMatch[1]] = colMatch[2];
    }

    tables[tableName] = columns;
  }

  return tables;
}

function checkTable(tables, tableName) {
  if (!tables[tableName]) {
    console.log(`❌ Table '${tableName}' NON TROUVÉE`);
    console.log('\n📋 Tables disponibles:');
    Object.keys(tables).sort().forEach(t => console.log(`   - ${t}`));
    return false;
  }

  console.log(`✅ Table '${tableName}' existe`);
  console.log(`\n📊 Colonnes (${Object.keys(tables[tableName]).length}):`);

  const hasGuildId = tables[tableName].guild_id;
  Object.entries(tables[tableName]).forEach(([col, type]) => {
    const icon = col === 'guild_id' ? '🔑' : col === 'id' ? '🆔' : '  ';
    console.log(`   ${icon} ${col}: ${type}`);
  });

  if (!hasGuildId) {
    console.log('\n⚠️  ATTENTION: Cette table n\'a PAS de guild_id');
    console.log('   → Table globale OU erreur de schéma');
  }

  return true;
}

function checkColumn(tables, tableName, columnName) {
  if (!tables[tableName]) {
    console.log(`❌ Table '${tableName}' NON TROUVÉE`);
    return false;
  }

  if (!tables[tableName][columnName]) {
    console.log(`❌ Colonne '${columnName}' NON TROUVÉE dans '${tableName}'`);
    console.log('\n📋 Colonnes disponibles:');
    Object.keys(tables[tableName]).forEach(c => console.log(`   - ${c}`));
    return false;
  }

  console.log(`✅ Colonne '${tableName}.${columnName}' existe`);
  console.log(`   Type: ${tables[tableName][columnName]}`);
  return true;
}

// Main
const args = process.argv.slice(2);
const schema = loadSchema();
const tables = extractTables(schema);

console.log(`🔍 Schéma chargé: ${Object.keys(tables).length} tables\n`);

if (args.length === 0) {
  // Lister toutes les tables
  console.log('📋 Tables disponibles:\n');
  Object.keys(tables).sort().forEach(t => {
    const colCount = Object.keys(tables[t]).length;
    const hasGuildId = tables[t].guild_id ? '🔑' : '⚠️';
    console.log(`   ${hasGuildId} ${t} (${colCount} colonnes)`);
  });
  console.log('\n🔑 = a guild_id | ⚠️ = globale (pas de guild_id)');
} else if (args.length === 1) {
  // Vérifier une table
  checkTable(tables, args[0]);
} else {
  // Vérifier une colonne
  checkColumn(tables, args[0], args[1]);
}
