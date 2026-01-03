const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  console.log('\n🔧 APPLICATION DE LA MIGRATION - add-rarity-probability-columns.sql\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', 'add-rarity-probability-columns.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Migration à appliquer:');
    console.log('  - 8 nouvelles colonnes pour theme_config');
    console.log('  - 4 colonnes: collectible_rarity_* (legendary/epic/rare/common)');
    console.log('  - 4 colonnes: super_bonus_rarity_* (legendary/epic/rare/common)');
    console.log('  - 2 contraintes de validation (poids > 0)');
    console.log('\n' + '='.repeat(80));

    // État AVANT la migration
    console.log('\n📊 VÉRIFICATION AVANT MIGRATION:\n');

    const columnsBefore = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      AND column_name LIKE '%rarity%'
      ORDER BY column_name
    `);

    if (columnsBefore.length > 0) {
      console.log('⚠️  Colonnes rarity déjà présentes:');
      console.table(columnsBefore);
    } else {
      console.log('✅ Aucune colonne rarity - Migration nécessaire');
    }

    // Appliquer la migration
    console.log('\n⚙️  APPLICATION EN COURS...\n');

    // Exécuter le fichier SQL complet
    // Note: On ne peut pas exécuter directement du SQL avec BEGIN/COMMIT via node-postgres
    // Il faut extraire les commandes individuelles

    // Colonnes collectibles
    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS collectible_rarity_legendary INTEGER DEFAULT 5
    `);
    console.log('✅ collectible_rarity_legendary ajoutée');

    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS collectible_rarity_epic INTEGER DEFAULT 10
    `);
    console.log('✅ collectible_rarity_epic ajoutée');

    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS collectible_rarity_rare INTEGER DEFAULT 20
    `);
    console.log('✅ collectible_rarity_rare ajoutée');

    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS collectible_rarity_common INTEGER DEFAULT 40
    `);
    console.log('✅ collectible_rarity_common ajoutée');

    // Colonnes super bonuses
    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS super_bonus_rarity_legendary INTEGER DEFAULT 5
    `);
    console.log('✅ super_bonus_rarity_legendary ajoutée');

    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS super_bonus_rarity_epic INTEGER DEFAULT 10
    `);
    console.log('✅ super_bonus_rarity_epic ajoutée');

    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS super_bonus_rarity_rare INTEGER DEFAULT 20
    `);
    console.log('✅ super_bonus_rarity_rare ajoutée');

    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS super_bonus_rarity_common INTEGER DEFAULT 40
    `);
    console.log('✅ super_bonus_rarity_common ajoutée');

    // Contraintes (avec gestion d'erreur si déjà existantes)
    try {
      await db.query(`
        ALTER TABLE theme_config
        ADD CONSTRAINT collectible_rarity_weights_positive
        CHECK (
          collectible_rarity_legendary > 0 AND
          collectible_rarity_epic > 0 AND
          collectible_rarity_rare > 0 AND
          collectible_rarity_common > 0
        )
      `);
      console.log('✅ Contrainte collectible_rarity_weights_positive ajoutée');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  Contrainte collectible_rarity_weights_positive déjà existante');
      } else {
        throw error;
      }
    }

    try {
      await db.query(`
        ALTER TABLE theme_config
        ADD CONSTRAINT super_bonus_rarity_weights_positive
        CHECK (
          super_bonus_rarity_legendary > 0 AND
          super_bonus_rarity_epic > 0 AND
          super_bonus_rarity_rare > 0 AND
          super_bonus_rarity_common > 0
        )
      `);
      console.log('✅ Contrainte super_bonus_rarity_weights_positive ajoutée');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  Contrainte super_bonus_rarity_weights_positive déjà existante');
      } else {
        throw error;
      }
    }

    // État APRÈS la migration
    console.log('\n📊 VÉRIFICATION APRÈS MIGRATION:\n');

    const columnsAfter = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      AND column_name LIKE '%rarity%'
      ORDER BY column_name
    `);

    console.table(columnsAfter);

    // Afficher la config actuelle du thème
    console.log('\n📊 CONFIGURATION DU THÈME ACTIF:\n');

    const config = await db.queryOne(`
      SELECT
        collectible_rarity_legendary,
        collectible_rarity_epic,
        collectible_rarity_rare,
        collectible_rarity_common,
        super_bonus_rarity_legendary,
        super_bonus_rarity_epic,
        super_bonus_rarity_rare,
        super_bonus_rarity_common
      FROM theme_config tc
      JOIN themes t ON tc.theme_id = t.id
      WHERE t.guild_id = $1 AND t.is_active = true
    `, [guildId]);

    if (config) {
      console.log('🎁 COLLECTIBLES:');
      console.log(`   Legendary: ${config.collectible_rarity_legendary} (${calculatePercentage(config, 'collectible', 'legendary')}%)`);
      console.log(`   Epic:      ${config.collectible_rarity_epic} (${calculatePercentage(config, 'collectible', 'epic')}%)`);
      console.log(`   Rare:      ${config.collectible_rarity_rare} (${calculatePercentage(config, 'collectible', 'rare')}%)`);
      console.log(`   Common:    ${config.collectible_rarity_common} (${calculatePercentage(config, 'collectible', 'common')}%)`);

      console.log('\n✨ SUPER BONUSES:');
      console.log(`   Legendary: ${config.super_bonus_rarity_legendary} (${calculatePercentage(config, 'super_bonus', 'legendary')}%)`);
      console.log(`   Epic:      ${config.super_bonus_rarity_epic} (${calculatePercentage(config, 'super_bonus', 'epic')}%)`);
      console.log(`   Rare:      ${config.super_bonus_rarity_rare} (${calculatePercentage(config, 'super_bonus', 'rare')}%)`);
      console.log(`   Common:    ${config.super_bonus_rarity_common} (${calculatePercentage(config, 'super_bonus', 'common')}%)`);
    }

    console.log('\n✅ MIGRATION APPLIQUÉE AVEC SUCCÈS !');
    console.log('\n💡 PROCHAINES ÉTAPES:');
    console.log('   1. Créer probabilityHandler.js');
    console.log('   2. Implémenter selectCollectible() pondéré');
    console.log('   3. Modifier selectSuperBonus() pour utiliser config DB');
    console.log('   4. Créer interface admin pour configuration');

    console.log('\n' + '='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'application de la migration:', error);
    process.exit(1);
  }
}

function calculatePercentage(config, type, rarity) {
  const prefix = type === 'collectible' ? 'collectible_rarity_' : 'super_bonus_rarity_';

  const total =
    config[`${prefix}legendary`] +
    config[`${prefix}epic`] +
    config[`${prefix}rare`] +
    config[`${prefix}common`];

  const value = config[`${prefix}${rarity}`];

  return ((value / total) * 100).toFixed(2);
}

applyMigration();
