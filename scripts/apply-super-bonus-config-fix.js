const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  console.log('\n🔧 APPLICATION DE LA MIGRATION - fix-super-bonus-config.sql\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', 'fix-super-bonus-config.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Contenu de la migration:');
    console.log(sqlContent);
    console.log('\n' + '='.repeat(80));

    // État AVANT la migration
    console.log('\n📊 ÉTAT AVANT LA MIGRATION:\n');

    const beforeJackpot = await db.queryOne(`
      SELECT bonus_id, name, activation_mode, duration_type, duration_value
      FROM super_bonuses
      WHERE bonus_id = 'jackpot_x2' AND guild_id = $1
    `, [guildId]);

    const beforeCelebrity = await db.queryOne(`
      SELECT bonus_id, name, activation_mode, duration_type, duration_value
      FROM super_bonuses
      WHERE bonus_id = 'celebrity_aura' AND guild_id = $1
    `, [guildId]);

    const beforeGodparent = await db.queryOne(`
      SELECT bonus_id, name, activation_mode, duration_type, duration_value
      FROM super_bonuses
      WHERE bonus_id = 'godparent' AND guild_id = $1
    `, [guildId]);

    console.log('💵 Jackpot x2:');
    console.table([beforeJackpot]);

    console.log('\n👑 Aura de Célébrité:');
    console.table([beforeCelebrity]);

    console.log('\n🤝 Parrain/Marraine:');
    console.table([beforeGodparent]);

    // Appliquer la migration
    console.log('\n⚙️  APPLICATION EN COURS...\n');

    // Exécuter chaque UPDATE séparément (plus safe)
    await db.query(`
      UPDATE super_bonuses
      SET
        activation_mode = 'automatic',
        duration_value = 1
      WHERE bonus_id = 'jackpot_x2' AND guild_id = $1
    `, [guildId]);
    console.log('✅ Jackpot x2 mis à jour');

    await db.query(`
      UPDATE super_bonuses
      SET
        activation_mode = 'automatic'
      WHERE bonus_id = 'celebrity_aura' AND guild_id = $1
    `, [guildId]);
    console.log('✅ Aura de Célébrité mis à jour');

    await db.query(`
      UPDATE super_bonuses
      SET
        duration_type = 'charges',
        duration_value = 1
      WHERE bonus_id = 'godparent' AND guild_id = $1
    `, [guildId]);
    console.log('✅ Parrain/Marraine mis à jour');

    // État APRÈS la migration
    console.log('\n📊 ÉTAT APRÈS LA MIGRATION:\n');

    const afterJackpot = await db.queryOne(`
      SELECT bonus_id, name, activation_mode, duration_type, duration_value
      FROM super_bonuses
      WHERE bonus_id = 'jackpot_x2' AND guild_id = $1
    `, [guildId]);

    const afterCelebrity = await db.queryOne(`
      SELECT bonus_id, name, activation_mode, duration_type, duration_value
      FROM super_bonuses
      WHERE bonus_id = 'celebrity_aura' AND guild_id = $1
    `, [guildId]);

    const afterGodparent = await db.queryOne(`
      SELECT bonus_id, name, activation_mode, duration_type, duration_value
      FROM super_bonuses
      WHERE bonus_id = 'godparent' AND guild_id = $1
    `, [guildId]);

    console.log('💵 Jackpot x2:');
    console.table([afterJackpot]);

    console.log('\n👑 Aura de Célébrité:');
    console.table([afterCelebrity]);

    console.log('\n🤝 Parrain/Marraine:');
    console.table([afterGodparent]);

    console.log('\n✅ MIGRATION APPLIQUÉE AVEC SUCCÈS !');
    console.log('\n' + '='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la migration:', error);
    process.exit(1);
  }
}

applyMigration();
