const db = require('../utils/database-pg');

async function testThemeCreation() {
  try {
    console.log('🔍 TEST - Création manuelle de thème\n');
    console.log('='.repeat(80));

    const guildId = '1248028543389143070';  // Serveur de l'utilisateur

    // Vérifier les contraintes de la table themes
    console.log('\n📊 Contraintes de la table themes:');
    const constraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'themes'::regclass
    `);
    console.table(constraints);

    // Simuler la création (sans vraiment l'insérer)
    console.log('\n📊 Test de création avec les mêmes données que l\'utilisateur:');
    console.log('   theme_id: "test"');
    console.log('   name: "test"');
    console.log('   duration_days: 10');
    console.log('   final_role_name: "tessssst"');

    // Vérifier si theme_id "test" existe déjà
    const existingTheme = await db.queryOne(
      'SELECT * FROM themes WHERE guild_id = $1 AND theme_id = $2',
      [guildId, 'test']
    );

    if (existingTheme) {
      console.log('❌ Un thème avec theme_id "test" existe déjà !');
      console.log(existingTheme);
    } else {
      console.log('✅ Aucun thème "test" existant - OK pour créer');
    }

    // Tester vraiment l'insertion avec BEGIN/ROLLBACK pour ne pas modifier la DB
    console.log('\n📊 Test d\'insertion (avec ROLLBACK):');
    try {
      await db.query('BEGIN');

      // Test INSERT themes
      const testTheme = await db.queryOne(`
        INSERT INTO themes (guild_id, theme_id, name, duration_days, required_items, final_role_name, final_role_color, is_active, activated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [guildId, 'test_simulation', 'Test Simulation', 10, 0, 'test_role', '#FFD700', false, null]);

      console.log('✅ INSERT themes réussi:', testTheme.id);

      // Test INSERT theme_config
      await db.query(`
        INSERT INTO theme_config (guild_id, theme_id, probability_collectible, probability_mission, probability_trap, probability_super_bonus)
        VALUES ($1, $2, 50, 25, 15, 10)
      `, [guildId, testTheme.id]);

      console.log('✅ INSERT theme_config réussi');

      // ROLLBACK pour ne pas modifier la DB
      await db.query('ROLLBACK');
      console.log('✅ Test terminé (ROLLBACK effectué)');

    } catch (insertError) {
      await db.query('ROLLBACK');
      console.error('❌ Erreur lors de l\'insertion de test:', insertError.message);
      console.error('   Détails:', insertError);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

testThemeCreation();
