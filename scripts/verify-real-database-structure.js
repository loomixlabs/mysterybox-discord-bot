const db = require('../utils/database-pg');

async function verifyRealStructure() {
  try {
    const guildId = '297309737135898624';
    const userId = '297307186307006464';

    console.log('🔍 VÉRIFICATION STRUCTURE RÉELLE\n');
    console.log('='.repeat(80));

    // 1. Structure player_active_bonuses
    console.log('\n📋 STRUCTURE player_active_bonuses:');
    console.log('-'.repeat(80));
    const pabColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      ORDER BY ordinal_position
    `);

    pabColumns.forEach((col, i) => {
      console.log(`   ${i + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
    });

    // 2. Structure super_bonuses
    console.log('\n\n📋 STRUCTURE super_bonuses:');
    console.log('-'.repeat(80));
    const sbColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      ORDER BY ordinal_position
    `);

    sbColumns.forEach((col, i) => {
      console.log(`   ${i + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
    });

    // 3. Données brutes player_active_bonuses pour xmicordix
    console.log('\n\n📊 DONNÉES BRUTES player_active_bonuses (xmicordix):');
    console.log('-'.repeat(80));

    const player = await db.queryOne(`
      SELECT id FROM players WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, userId]);

    if (!player) {
      console.log('❌ Player introuvable\n');
      process.exit(1);
    }

    const rawData = await db.query(`
      SELECT * FROM player_active_bonuses
      WHERE guild_id = $1 AND user_id = $2
      ORDER BY activated_at DESC
    `, [guildId, userId]);

    console.log(`   Total: ${rawData.length} entrée(s)\n`);

    if (rawData.length > 0) {
      console.log('   Première entrée (toutes les colonnes):');
      const first = rawData[0];
      Object.keys(first).forEach(key => {
        console.log(`   - ${key}: ${first[key]}`);
      });
    }

    // 4. Tous les super_bonuses pour ce serveur
    console.log('\n\n📊 TOUS LES super_bonuses (serveur de test):');
    console.log('-'.repeat(80));
    const allBonuses = await db.query(`
      SELECT id, name, bonus_type, effect_type, uses_charges, max_charges
      FROM super_bonuses
      WHERE guild_id = $1
      ORDER BY id
    `, [guildId]);

    console.log(`   Total: ${allBonuses.length} super bonus\n`);

    allBonuses.forEach((bonus, i) => {
      console.log(`   ${i + 1}. [ID ${bonus.id}] ${bonus.name}`);
      console.log(`      bonus_type: ${bonus.bonus_type}`);
      console.log(`      effect_type: ${bonus.effect_type}`);
      console.log(`      uses_charges: ${bonus.uses_charges}`);
      console.log(`      max_charges: ${bonus.max_charges}\n`);
    });

    // 5. Bonus actifs pour xmicordix (avec JOIN)
    console.log('\n📊 BONUS ACTIFS (avec JOIN):');
    console.log('-'.repeat(80));
    const activeBonuses = await db.query(`
      SELECT
        pab.*,
        sb.name as bonus_name,
        sb.bonus_type,
        sb.effect_type
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1 AND pab.user_id = $2
      ORDER BY pab.activated_at DESC
    `, [guildId, userId]);

    console.log(`   Total: ${activeBonuses.length} bonus actif(s)\n`);

    activeBonuses.forEach((bonus, i) => {
      console.log(`   ${i + 1}. ${bonus.bonus_name} (pab.id: ${bonus.id})`);
      console.log(`      bonus_id: ${bonus.bonus_id}`);
      console.log(`      bonus_type: ${bonus.bonus_type}`);
      console.log(`      effect_type: ${bonus.effect_type}`);
      console.log(`      is_active: ${bonus.is_active}`);
      console.log(`      remaining_charges: ${bonus.remaining_charges}`);
      console.log(`      expires_at: ${bonus.expires_at}\n`);
    });

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

verifyRealStructure();
