const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

const TEST_GUILD_ID = '297309737135898624'; // Serveur de test
const PROD_GUILD_ID = '1248028543389143070'; // Serveur de production

async function analyzeAccelerateurCooldown() {
  console.log('🔍 ANALYSE COMPLÈTE: Accélérateur Cooldown\n');
  console.log('═'.repeat(100));

  try {
    // 1. Structure de player_cooldowns
    console.log('\n📋 STRUCTURE DE LA TABLE player_cooldowns:');
    console.log('─'.repeat(100));

    const cooldownStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_cooldowns'
      ORDER BY ordinal_position
    `);

    console.table(cooldownStructure.rows);

    // 2. Configuration de l'Accélérateur Cooldown dans super_bonuses
    console.log('\n📊 CONFIGURATION ACCÉLÉRATEUR COOLDOWN (super_bonuses):');
    console.log('─'.repeat(100));

    const bonusConfig = await pool.query(`
      SELECT
        id,
        name,
        code,
        effect_type,
        effect_config,
        duration_type,
        duration_value,
        default_charges,
        activation_mode,
        is_enabled,
        rarity
      FROM super_bonuses
      WHERE name LIKE '%Accélérateur%'
    `);

    if (bonusConfig.rows.length === 0) {
      console.log('⚠️  Bonus "Accélérateur Cooldown" NON TROUVÉ dans super_bonuses');
      console.log('   → Bonus pas encore créé dans la base de données');
    } else {
      console.table(bonusConfig.rows);

      const bonus = bonusConfig.rows[0];
      console.log('\n📝 Détail effect_config:');
      if (bonus.effect_config) {
        console.log(JSON.stringify(JSON.parse(bonus.effect_config), null, 2));
      } else {
        console.log('   → Aucune configuration d\'effet définie');
      }
    }

    // 3. Joueurs avec bonus actif (si existe)
    console.log('\n👥 JOUEURS AVEC ACCÉLÉRATEUR ACTIF:');
    console.log('─'.repeat(100));

    const activePlayers = await pool.query(`
      SELECT
        pab.id as active_bonus_id,
        pab.guild_id,
        pab.user_id,
        p.username,
        pab.is_active,
        pab.activated_at,
        pab.expires_at,
        pab.remaining_charges,
        sb.effect_config
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      LEFT JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      WHERE sb.name LIKE '%Accélérateur%'
        AND (pab.guild_id = $1 OR pab.guild_id = $2)
      ORDER BY pab.is_active DESC, pab.activated_at DESC
    `, [TEST_GUILD_ID, PROD_GUILD_ID]);

    if (activePlayers.rows.length === 0) {
      console.log('ℹ️  Aucun joueur n\'a actuellement d\'Accélérateur Cooldown');
    } else {
      console.table(activePlayers.rows);
    }

    // 4. Cooldowns actifs sur les serveurs
    console.log('\n⏱️  COOLDOWNS ACTIFS (player_cooldowns):');
    console.log('─'.repeat(100));

    const activeCooldowns = await pool.query(`
      SELECT
        pc.guild_id,
        p.username,
        pc.type,
        pc.target_id,
        pc.created_at,
        pc.expires_at,
        pc.is_active,
        EXTRACT(EPOCH FROM (pc.expires_at - NOW())) / 60 as minutes_remaining
      FROM player_cooldowns pc
      LEFT JOIN players p ON pc.player_id = p.id
      WHERE pc.guild_id IN ($1, $2)
        AND pc.expires_at > NOW()
      ORDER BY pc.expires_at ASC
      LIMIT 10
    `, [TEST_GUILD_ID, PROD_GUILD_ID]);

    if (activeCooldowns.rows.length === 0) {
      console.log('ℹ️  Aucun cooldown actif actuellement');
    } else {
      console.table(activeCooldowns.rows);
      console.log(`\n✅ ${activeCooldowns.rows.length} cooldown(s) actif(s)`);
    }

    // 5. Analyse du code existant
    console.log('\n💻 ANALYSE DU CODE EXISTANT:');
    console.log('─'.repeat(100));

    console.log(`
📁 Fichiers à analyser pour l'implémentation:
   1. handlers/superBonusHandler.js - Handler pour appliquer réduction cooldown
   2. utils/database-pg.js - Méthodes addCooldown(), setCooldown()
   3. handlers/missionHandler.js - Application cooldown après mission
   4. handlers/mysteryBoxHandler.js - Application cooldown mystery box (si existe)
   5. commands/player/profile.js - Affichage cooldowns avec réduction

📊 Types de cooldowns identifiés:
   - Missions (type = 'mission')
   - Mystery Boxes potentiel
   - Traps potentiel

🔧 Implémentation suggérée:
   1. Créer fonction checkCooldownAccelerator(guildId, userId)
   2. Modifier addCooldown/setCooldown pour appliquer -50% si actif
   3. Afficher temps réduit dans /profile
   4. Logger utilisation dans bonus_usage_history
`);

    // 6. Statistiques globales
    console.log('\n📈 STATISTIQUES GLOBALES:');
    console.log('─'.repeat(100));

    const stats = {
      total_cooldowns: await pool.query('SELECT COUNT(*) FROM player_cooldowns'),
      active_cooldowns: await pool.query('SELECT COUNT(*) FROM player_cooldowns WHERE expires_at > NOW()'),
      avg_cooldown_minutes: await pool.query(`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (expires_at - created_at)) / 60)) as avg_minutes
        FROM player_cooldowns
        WHERE created_at > NOW() - INTERVAL '7 days'
      `),
      cooldowns_by_type: await pool.query(`
        SELECT type, COUNT(*) as count
        FROM player_cooldowns
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY type
      `)
    };

    console.log(`\n🔢 Total cooldowns créés: ${stats.total_cooldowns.rows[0].count}`);
    console.log(`🔢 Cooldowns actifs actuellement: ${stats.active_cooldowns.rows[0].count}`);
    console.log(`⏱️  Durée moyenne cooldown (7 derniers jours): ${stats.avg_cooldown_minutes.rows[0]?.avg_minutes || 0} minutes`);

    console.log('\n📊 Répartition par type (7 derniers jours):');
    console.table(stats.cooldowns_by_type.rows);

    // 7. Diagnostic & Recommandations
    console.log('\n' + '═'.repeat(100));
    console.log('🔍 DIAGNOSTIC & RECOMMANDATIONS');
    console.log('═'.repeat(100));

    const diagnostic = {
      bonus_exists: bonusConfig.rows.length > 0,
      bonus_enabled: bonusConfig.rows[0]?.is_enabled || false,
      players_have_bonus: activePlayers.rows.length > 0,
      cooldown_system_active: activeCooldowns.rows.length > 0,
      avg_cooldown: parseFloat(stats.avg_cooldown_minutes.rows[0]?.avg_minutes || 0)
    };

    console.log('\n✅ ÉTAT ACTUEL:');
    console.log(`   • Bonus existe en DB: ${diagnostic.bonus_exists ? '✅ OUI' : '❌ NON'}`);
    console.log(`   • Bonus activé: ${diagnostic.bonus_enabled ? '✅ OUI' : '❌ NON'}`);
    console.log(`   • Joueurs avec bonus: ${diagnostic.players_have_bonus ? `✅ ${activePlayers.rows.length}` : '❌ 0'}`);
    console.log(`   • Système cooldown actif: ${diagnostic.cooldown_system_active ? '✅ OUI' : '⚠️  Aucun cooldown actif'}`);
    console.log(`   • Durée moyenne cooldown: ${diagnostic.avg_cooldown} minutes`);

    console.log('\n📋 RECOMMANDATIONS:');

    if (!diagnostic.bonus_exists) {
      console.log(`
   🔴 PRIORITÉ HAUTE:
      1. Créer le bonus "Accélérateur Cooldown" dans super_bonuses
      2. Configuration suggérée:
         - effect_type: 'cooldown_reduction'
         - effect_config: {"reduction_percentage": 50}
         - duration_type: 'temporary'
         - duration_value: 86400 (24h)
         - activation_mode: 'automatic'
         - rarity: 'epic'
`);
    }

    if (diagnostic.bonus_exists && !diagnostic.bonus_enabled) {
      console.log(`
   🟠 PRIORITÉ MOYENNE:
      1. Activer le bonus via admin panel
      2. Tester distribution via mystery box
`);
    }

    console.log(`
   📝 IMPLÉMENTATION NÉCESSAIRE:
      1. Créer fonction dans superBonusHandler.js:
         - hasCooldownAccelerator(guildId, userId)
         - applyCooldownReduction(duration, percentage)

      2. Modifier database-pg.js:
         - Méthode setCooldown() pour vérifier bonus actif
         - Appliquer réduction -50% avant insertion

      3. Modifier affichage /profile:
         - Afficher temps normal vs temps réduit
         - Indicateur visuel "⚡ (-50%)"

      4. Ajouter logging:
         - Track utilisation dans bonus_usage_history
         - Stats: "Temps économisé grâce à Accélérateur"

   ⏱️  ESTIMATION IMPLÉMENTATION:
      - Phase 1: Logique réduction (2h)
      - Phase 2: UI affichage (2h)
      - Phase 3: Tests E2E (2h)
      - TOTAL: 6h
`);

    console.log('\n' + '═'.repeat(100) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'analyse:', error);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

analyzeAccelerateurCooldown();
