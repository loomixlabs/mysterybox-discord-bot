/**
 * Vérification des structures de tables pour le theme-builder dashboard
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function checkStructures() {
  try {
    console.log('🔍 VÉRIFICATION STRUCTURES TABLES DASHBOARD\n');
    console.log('='.repeat(80));

    // Vérifier la table badges
    console.log('\n📋 TABLE: badges');
    console.log('-'.repeat(40));
    const badgesCols = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'badges'
      ORDER BY ordinal_position
    `);
    console.table(badgesCols);

    // Vérifier la table guild_admin_roles
    console.log('\n📋 TABLE: guild_admin_roles');
    console.log('-'.repeat(40));
    const adminRolesCols = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'guild_admin_roles'
      ORDER BY ordinal_position
    `);
    if (adminRolesCols.length === 0) {
      console.log('❌ Table guild_admin_roles non trouvée');
    } else {
      console.table(adminRolesCols);
    }

    // Vérifier la table progression_roles (discord-roles)
    console.log('\n📋 TABLE: progression_roles');
    console.log('-'.repeat(40));
    const progressionRolesCols = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'progression_roles'
      ORDER BY ordinal_position
    `);
    if (progressionRolesCols.length === 0) {
      console.log('❌ Table progression_roles non trouvée');
    } else {
      console.table(progressionRolesCols);
    }

    // Vérifier les tables existantes contenant "role"
    console.log('\n🔍 TABLES CONTENANT "role":');
    console.log('-'.repeat(40));
    const roleTables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE '%role%'
      ORDER BY table_name
    `);
    console.table(roleTables);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkStructures();
