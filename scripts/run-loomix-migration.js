/**
 * Script d'exécution de la migration Loomix Currency System
 * Crée les tables: player_currency, currency_transactions, daily_catchup_config, etc.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../utils/database-pg');

async function runMigration() {
  console.log('🚀 MIGRATION: Système de Monnaie Loomix v2.3.0\n');
  console.log('='.repeat(80));

  try {
    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../database/migrations/add-loomix-currency-system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Séparer les commandes (par les commentaires de section)
    const sections = sql.split(/-- ={10,}/g).filter(s => s.trim());

    console.log(`\n📋 ${sections.length} sections à exécuter\n`);

    // Exécuter le SQL complet
    console.log('⏳ Exécution de la migration...\n');

    await db.query(sql);

    console.log('✅ Migration exécutée avec succès!\n');

    // Vérification
    console.log('🔍 VÉRIFICATION DES TABLES CRÉÉES:\n');

    // 1. player_currency
    const pcExists = await db.queryOne(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'player_currency') as exists
    `);
    console.log(`  📋 player_currency: ${pcExists.exists ? '✅ OK' : '❌ MANQUANTE'}`);

    // 2. currency_transactions
    const ctExists = await db.queryOne(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'currency_transactions') as exists
    `);
    console.log(`  📋 currency_transactions: ${ctExists.exists ? '✅ OK' : '❌ MANQUANTE'}`);

    // 3. daily_catchup_config
    const dccExists = await db.queryOne(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_catchup_config') as exists
    `);
    console.log(`  📋 daily_catchup_config: ${dccExists.exists ? '✅ OK' : '❌ MANQUANTE'}`);

    // 4. daily_catchup_history
    const dchExists = await db.queryOne(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_catchup_history') as exists
    `);
    console.log(`  📋 daily_catchup_history: ${dchExists.exists ? '✅ OK' : '❌ MANQUANTE'}`);

    // 5. guild_currency_config
    const gccExists = await db.queryOne(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'guild_currency_config') as exists
    `);
    console.log(`  📋 guild_currency_config: ${gccExists.exists ? '✅ OK' : '❌ MANQUANTE'}`);

    // Vérifier les données par défaut
    console.log('\n📊 DONNÉES PAR DÉFAUT:\n');

    const guildConfig = await db.queryOne(`
      SELECT * FROM guild_currency_config WHERE guild_id = '1248028543389143070'
    `);
    if (guildConfig) {
      console.log(`  💎 Config Loomix: ${guildConfig.display_name} ${guildConfig.display_emoji}`);
      console.log(`     - Bonus claim: ${guildConfig.daily_claim_bonus} Loomix`);
      console.log(`     - Bonus streak: +${guildConfig.streak_bonus_per_day}/jour`);
    }

    const catchupConfigs = await db.queryAll(`
      SELECT dcc.*, t.name as theme_name
      FROM daily_catchup_config dcc
      JOIN themes t ON dcc.theme_id = t.id
      WHERE dcc.guild_id = '1248028543389143070'
    `);
    console.log(`\n  🔧 Configs rattrapage: ${catchupConfigs.length} thème(s)`);
    catchupConfigs.forEach(c => {
      console.log(`     - ${c.theme_name}: ${c.base_price} Loomix (base) + ${c.price_increment}/jour`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS!');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
