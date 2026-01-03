/**
 * Vérifier la structure de la table traps et les contraintes sur le type
 */

const db = require('../utils/database-pg');

async function check() {
  try {
    console.log('🔍 VÉRIFICATION STRUCTURE TABLE TRAPS\n');
    console.log('='.repeat(80));

    // 1. Vérifier les contraintes CHECK
    console.log('\n📋 1. CONTRAINTES CHECK SUR traps:\n');
    const constraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'traps'::regclass
      AND contype = 'c'
    `);

    if (constraints.length > 0) {
      console.table(constraints);
    } else {
      console.log('   ✅ Aucune contrainte CHECK trouvée - le type est libre');
    }

    // 2. Vérifier les types de pièges actuellement utilisés
    console.log('\n📋 2. TYPES DE PIÈGES ACTUELLEMENT EN BASE:\n');
    const trapTypes = await db.queryAll(`
      SELECT DISTINCT type, COUNT(*) as count
      FROM traps
      GROUP BY type
      ORDER BY count DESC
    `);

    if (trapTypes.length > 0) {
      console.table(trapTypes);
    } else {
      console.log('   Aucun piège en base');
    }

    // 3. Structure de la colonne type
    console.log('\n📋 3. DÉFINITION COLONNE type:\n');
    const columnDef = await db.queryAll(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'traps' AND column_name = 'type'
    `);
    console.table(columnDef);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
