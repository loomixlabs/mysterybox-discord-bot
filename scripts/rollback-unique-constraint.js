require('dotenv').config();
const db = require('../utils/database-pg');

async function rollback() {
  try {
    console.log('🔄 ROLLBACK: Suppression de la contrainte UNIQUE (système de cumul volontaire)\n');
    console.log('='.repeat(80));

    // Supprimer l'index unique partiel
    await db.query(`
      DROP INDEX IF EXISTS unique_active_bonus_per_player;
    `);

    console.log('✅ Contrainte UNIQUE supprimée');
    console.log('✅ Le système de cumul est rétabli\n');

    // Vérifier que la contrainte a bien été supprimée
    const constraints = await db.queryAll(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'player_active_bonuses'
        AND indexname = 'unique_active_bonus_per_player'
    `);

    if (constraints.length === 0) {
      console.log('✅ Vérification: La contrainte a bien été supprimée\n');
    } else {
      console.error('❌ ERREUR: La contrainte existe encore!\n');
    }

    console.log('='.repeat(80));
    console.log('✅ Rollback terminé - Le cumul de bonus est à nouveau possible\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

rollback();
