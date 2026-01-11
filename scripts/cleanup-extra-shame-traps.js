/**
 * Script: Supprimer les pièges shame-nickname en double
 * Garde uniquement 'shame-nickname', supprime 'shame-nickname-light', 'shame-nickname-medium', 'shame-nickname-heavy'
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function cleanupExtraShameTraps() {
  console.log('🧹 Nettoyage des pièges shame-nickname en double\n');
  console.log('='.repeat(60));

  try {
    // Trouver les pièges à supprimer (les variantes light/medium/heavy)
    const extraTraps = await db.queryAll(`
      SELECT t.id, t.trap_id, t.name, t.guild_id, th.name as theme_name
      FROM traps t
      JOIN themes th ON t.theme_id = th.id AND t.guild_id = th.guild_id
      WHERE t.type = 'shame-nickname'
        AND t.trap_id IN ('shame-nickname-light', 'shame-nickname-medium', 'shame-nickname-heavy')
      ORDER BY t.guild_id, th.name
    `);

    if (extraTraps.length === 0) {
      console.log('✅ Aucun piège en double trouvé.');
      process.exit(0);
    }

    console.log(`📊 ${extraTraps.length} piège(s) en double trouvé(s):\n`);

    for (const trap of extraTraps) {
      console.log(`   🗑️  ${trap.name} (${trap.trap_id}) - Thème: ${trap.theme_name}`);
    }

    console.log('\n🔄 Suppression en cours...\n');

    // D'abord supprimer les références dans player_shame_nickname
    const trapIds = extraTraps.map(t => t.id);
    if (trapIds.length > 0) {
      await db.query(`
        DELETE FROM player_shame_nickname
        WHERE trap_id = ANY($1::int[])
      `, [trapIds]);
      console.log('   ✅ Références player_shame_nickname supprimées');
    }

    // Ensuite supprimer les pièges en double
    const result = await db.query(`
      DELETE FROM traps
      WHERE type = 'shame-nickname'
        AND trap_id IN ('shame-nickname-light', 'shame-nickname-medium', 'shame-nickname-heavy')
    `);

    console.log(`✅ ${result.rowCount || extraTraps.length} piège(s) supprimé(s)`);

    // Vérifier ce qui reste
    const remaining = await db.queryAll(`
      SELECT t.trap_id, t.name, th.name as theme_name
      FROM traps t
      JOIN themes th ON t.theme_id = th.id AND t.guild_id = th.guild_id
      WHERE t.type = 'shame-nickname'
      ORDER BY t.guild_id, th.name
    `);

    console.log(`\n📋 Pièges shame-nickname restants: ${remaining.length}`);
    remaining.forEach(t => {
      console.log(`   ✅ ${t.name} (${t.trap_id}) - ${t.theme_name}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ NETTOYAGE TERMINÉ');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 ERREUR:', error);
    process.exit(1);
  }
}

cleanupExtraShameTraps();
