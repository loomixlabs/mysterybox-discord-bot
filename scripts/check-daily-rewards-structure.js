/**
 * Script de vérification de la structure DB pour Daily Rewards v2.3
 * Vérifie les tables existantes et propose les modifications nécessaires
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function checkStructure() {
  console.log('🔍 VÉRIFICATION STRUCTURE DB - DAILY REWARDS v2.3\n');
  console.log('='.repeat(80));

  try {
    // 1. Vérifier daily_rewards_config
    console.log('\n📋 1. TABLE: daily_rewards_config');
    console.log('-'.repeat(40));

    const dailyRewardsExists = await db.queryOne(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'daily_rewards_config'
      ) as exists
    `);

    if (dailyRewardsExists.exists) {
      console.log('✅ Table existe');

      const columns = await db.queryAll(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'daily_rewards_config'
        ORDER BY ordinal_position
      `);
      console.log('\nColonnes actuelles:');
      console.table(columns);

      // Vérifier les données existantes
      const count = await db.queryOne('SELECT COUNT(*) as count FROM daily_rewards_config');
      console.log(`\n📊 Données: ${count.count} entrées`);

      if (count.count > 0) {
        const sample = await db.queryAll('SELECT DISTINCT reward_type FROM daily_rewards_config');
        console.log('Types de récompenses existants:', sample.map(s => s.reward_type));
      }
    } else {
      console.log('❌ Table n\'existe pas - À créer');
    }

    // 2. Vérifier player_currency (nouvelle table pour Loomix)
    console.log('\n📋 2. TABLE: player_currency (pour Loomix)');
    console.log('-'.repeat(40));

    const currencyExists = await db.queryOne(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'player_currency'
      ) as exists
    `);

    if (currencyExists.exists) {
      console.log('✅ Table existe');
      const columns = await db.queryAll(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'player_currency'
        ORDER BY ordinal_position
      `);
      console.table(columns);
    } else {
      console.log('❌ Table n\'existe pas - À créer');
    }

    // 3. Vérifier daily_catchup_config (config rattrapage)
    console.log('\n📋 3. TABLE: daily_catchup_config (config rattrapage)');
    console.log('-'.repeat(40));

    const catchupExists = await db.queryOne(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'daily_catchup_config'
      ) as exists
    `);

    if (catchupExists.exists) {
      console.log('✅ Table existe');
      const columns = await db.queryAll(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'daily_catchup_config'
        ORDER BY ordinal_position
      `);
      console.table(columns);
    } else {
      console.log('❌ Table n\'existe pas - À créer');
    }

    // 4. Vérifier super_bonuses (pour référence)
    console.log('\n📋 4. TABLE: super_bonuses (référence)');
    console.log('-'.repeat(40));

    const superBonuses = await db.queryAll(`
      SELECT id, name, effect_type, rarity
      FROM super_bonuses
      WHERE guild_id = '1248028543389143070'
      ORDER BY id
      LIMIT 10
    `);

    if (superBonuses.length > 0) {
      console.log('Super bonus disponibles (sample):');
      console.table(superBonuses);
    } else {
      console.log('Aucun super bonus trouvé');
    }

    // 5. Vérifier collectibles (pour référence)
    console.log('\n📋 5. TABLE: collectibles (référence)');
    console.log('-'.repeat(40));

    const collectibles = await db.queryAll(`
      SELECT DISTINCT rarity, COUNT(*) as count
      FROM collectibles
      WHERE guild_id = '1248028543389143070'
      GROUP BY rarity
    `);

    if (collectibles.length > 0) {
      console.log('Collectibles par rareté:');
      console.table(collectibles);
    }

    // 6. Vérifier claim_streak_by_theme dans players
    console.log('\n📋 6. COLONNE: players.claim_streak_by_theme');
    console.log('-'.repeat(40));

    const claimStreakCol = await db.queryOne(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'players' AND column_name = 'claim_streak_by_theme'
      ) as exists
    `);

    console.log(claimStreakCol.exists ? '✅ Colonne existe' : '❌ Colonne n\'existe pas');

    // 7. Résumé et recommandations
    console.log('\n' + '='.repeat(80));
    console.log('📝 RÉSUMÉ ET RECOMMANDATIONS');
    console.log('='.repeat(80));

    console.log('\n🎁 Types de récompenses à supporter:');
    console.log('  1. mystery_box_[rarity]  - Mystery Box par rareté (common/rare/epic/legendary)');
    console.log('  2. collectible_specific  - Collectible spécifique (par ID)');
    console.log('  3. collectible_random    - Collectible aléatoire (par rareté)');
    console.log('  4. super_bonus_specific  - Super Bonus spécifique (par ID)');
    console.log('  5. super_bonus_random    - Super Bonus aléatoire');
    console.log('  6. currency              - Monnaie Loomix');

    console.log('\n💎 Structure player_currency proposée:');
    console.log(`
CREATE TABLE IF NOT EXISTS player_currency (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  currency_type VARCHAR(32) DEFAULT 'loomix',
  balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, player_id, currency_type)
);`);

    console.log('\n🎁 Structure daily_rewards_config proposée:');
    console.log(`
CREATE TABLE IF NOT EXISTS daily_rewards_config (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  reward_type VARCHAR(32) NOT NULL,
  -- Types: mystery_box, collectible_specific, collectible_random,
  --        super_bonus_specific, super_bonus_random, currency
  reward_rarity VARCHAR(32),          -- Pour mystery_box, collectible_random
  reward_id INTEGER,                   -- Pour collectible_specific, super_bonus_specific
  reward_amount INTEGER DEFAULT 1,
  is_milestone BOOLEAN DEFAULT FALSE,
  display_name VARCHAR(100),
  display_emoji VARCHAR(32),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, theme_id, day_number)
);`);

    console.log('\n🔧 Structure daily_catchup_config proposée:');
    console.log(`
CREATE TABLE IF NOT EXISTS daily_catchup_config (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(32) NOT NULL,
  theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
  currency_type VARCHAR(32) DEFAULT 'loomix',
  base_price INTEGER DEFAULT 250,
  price_increment INTEGER DEFAULT 100,    -- +100 par jour manqué
  price_multiplier DECIMAL(4,2) DEFAULT 1.0, -- Ou multiplicateur (1.4 = +40%)
  pricing_mode VARCHAR(16) DEFAULT 'increment', -- 'increment' ou 'multiplier'
  max_catchup_days INTEGER DEFAULT 0,     -- 0 = illimité
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, theme_id)
);`);

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkStructure();
