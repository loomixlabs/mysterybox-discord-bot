const db = require('./utils/database-pg');

async function verifyTrapStructure() {
  console.log('\n🔍 VÉRIFICATION DE LA STRUCTURE DES PIÈGES\n');
  console.log('='.repeat(80));

  try {
    // 1. Vérifier la structure de la table traps
    console.log('\n📋 Structure de la table "traps":');
    const trapColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'traps'
      ORDER BY ordinal_position
    `);
    console.table(trapColumns);

    // 2. Vérifier les contraintes
    console.log('\n🔗 Contraintes de la table "traps":');
    const trapConstraints = await db.queryAll(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'traps'
    `);
    console.table(trapConstraints);

    // 3. Compter les pièges existants
    console.log('\n📊 Pièges existants:');
    const trapCount = await db.queryAll(`
      SELECT
        guild_id,
        theme_id,
        trap_id,
        name,
        type,
        cooldown_duration,
        malus_points,
        shame_message,
        removes_collectible
      FROM traps
      ORDER BY guild_id, theme_id
    `);

    if (trapCount.length === 0) {
      console.log('⚠️  Aucun piège trouvé dans la base de données');
    } else {
      console.table(trapCount);
    }

    // 4. Vérifier la structure de trap_triggered
    console.log('\n📋 Structure de la table "trap_triggered":');
    const trapTriggeredColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'trap_triggered'
      ORDER BY ordinal_position
    `);
    console.table(trapTriggeredColumns);

    // 5. Vérifier la structure de player_cooldowns
    console.log('\n📋 Structure de la table "player_cooldowns":');
    const cooldownColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_cooldowns'
      ORDER BY ordinal_position
    `);
    console.table(cooldownColumns);

    // 6. Vérifier la structure de player_malus_points
    console.log('\n📋 Structure de la table "player_malus_points":');
    const malusColumns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_malus_points'
      ORDER BY ordinal_position
    `);
    console.table(malusColumns);

    console.log('\n✅ Vérification terminée !');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error);
    process.exit(1);
  }
}

verifyTrapStructure();
