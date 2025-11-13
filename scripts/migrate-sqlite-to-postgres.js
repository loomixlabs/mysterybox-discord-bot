/**
 * Script de migration SQLite → PostgreSQL Multi-serveur
 *
 * Ce script :
 * 1. Lit les données de bot.db (SQLite)
 * 2. Ajoute le guild_id à toutes les données
 * 3. Insère dans PostgreSQL avec le nouveau schéma multi-serveur
 *
 * IMPORTANT: Exécuter ce script UNE SEULE FOIS après avoir créé le schéma PostgreSQL
 */

require('dotenv').config({ override: true });
const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Configuration
const SQLITE_PATH = path.join(__dirname, '..', 'bot.db');
const GUILD_ID = process.env.GUILD_ID; // Votre serveur de test

if (!GUILD_ID) {
  log('❌ ERREUR: GUILD_ID non défini dans .env', 'red');
  process.exit(1);
}

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgres')) {
  log('❌ ERREUR: DATABASE_URL PostgreSQL non défini dans .env', 'red');
  process.exit(1);
}

log('\n╔════════════════════════════════════════════════════╗', 'cyan');
log('║  MIGRATION SQLite → PostgreSQL Multi-serveur       ║', 'cyan');
log('╚════════════════════════════════════════════════════╝\n', 'cyan');

log(`📦 SQLite source : ${SQLITE_PATH}`, 'yellow');
log(`🎯 Guild ID      : ${GUILD_ID}`, 'yellow');
log(`🐘 PostgreSQL    : ${process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@')}\n`, 'yellow');

// Connexions
let sqliteDb;
let pgPool;

async function connectDatabases() {
  log('🔌 Connexion aux bases de données...', 'cyan');

  try {
    // SQLite
    sqliteDb = new Database(SQLITE_PATH, { readonly: true });
    log('✅ SQLite connecté', 'green');

    // PostgreSQL
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    await pgPool.query('SELECT NOW()');
    log('✅ PostgreSQL connecté\n', 'green');

  } catch (error) {
    log(`❌ Erreur de connexion: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function registerGuild() {
  log('📝 Enregistrement du serveur Discord...', 'cyan');

  try {
    const guildName = process.env.GUILD_NAME || 'Serveur de test';
    const ownerId = process.env.OWNER_DISCORD_ID || null;

    const result = await pgPool.query(`
      INSERT INTO guild_config (guild_id, guild_name, is_active, owner_id)
      VALUES ($1, $2, TRUE, $3)
      ON CONFLICT (guild_id) DO UPDATE
        SET guild_name = EXCLUDED.guild_name,
            last_activity = NOW()
      RETURNING *
    `, [GUILD_ID, guildName, ownerId]);

    log(`✅ Serveur enregistré: ${result.rows[0].guild_name}\n`, 'green');
  } catch (error) {
    log(`❌ Erreur lors de l'enregistrement: ${error.message}`, 'red');
    throw error;
  }
}

async function migrateThemes() {
  log('🎨 Migration des thèmes...', 'cyan');

  try {
    const themes = sqliteDb.prepare('SELECT * FROM themes').all();

    for (const theme of themes) {
      const result = await pgPool.query(`
        INSERT INTO themes (
          guild_id, theme_id, name, is_active, duration_days,
          required_items, final_role_name, final_role_color,
          final_role_discord_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (guild_id, theme_id) DO NOTHING
        RETURNING id
      `, [
        GUILD_ID,
        theme.theme_id,
        theme.name,
        theme.is_active === 1,
        theme.duration_days,
        theme.required_items,
        theme.final_role_name,
        theme.final_role_color,
        theme.final_role_discord_id || null,
        theme.created_at,
        theme.updated_at
      ]);

      if (result.rows.length > 0) {
        log(`  ✓ Thème migré: ${theme.name}`, 'green');

        // Migrer la config du thème
        const config = sqliteDb.prepare('SELECT * FROM theme_config WHERE theme_id = ?').get(theme.id);
        if (config) {
          await pgPool.query(`
            INSERT INTO theme_config (
              guild_id, theme_id, probability_collectible, probability_mission,
              probability_trap, mystery_box_image, mystery_box_title, mystery_box_description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (guild_id, theme_id) DO NOTHING
          `, [
            GUILD_ID,
            result.rows[0].id,
            config.probability_collectible,
            config.probability_mission,
            config.probability_trap,
            config.mystery_box_image,
            config.mystery_box_title,
            config.mystery_box_description
          ]);
        }

        // Migrer les messages du thème
        const messages = sqliteDb.prepare('SELECT * FROM theme_messages WHERE theme_id = ?').all(theme.id);
        for (const msg of messages) {
          await pgPool.query(`
            INSERT INTO theme_messages (guild_id, theme_id, key, content)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (guild_id, theme_id, key) DO NOTHING
          `, [GUILD_ID, result.rows[0].id, msg.key, msg.content]);
        }
      }
    }

    log(`✅ ${themes.length} thème(s) migré(s)\n`, 'green');
  } catch (error) {
    log(`❌ Erreur migration thèmes: ${error.message}`, 'red');
    throw error;
  }
}

async function migrateCollectibles() {
  log('🎁 Migration des collectibles...', 'cyan');

  try {
    const collectibles = sqliteDb.prepare('SELECT * FROM collectibles').all();

    for (const collectible of collectibles) {
      // Récupérer l'ID du thème dans PostgreSQL
      const themeResult = await pgPool.query(
        'SELECT id FROM themes WHERE guild_id = $1 AND id = $2',
        [GUILD_ID, collectible.theme_id]
      );

      if (themeResult.rows.length === 0) continue;

      await pgPool.query(`
        INSERT INTO collectibles (
          guild_id, theme_id, collectible_id, name, image_url,
          rarity, reveal_message, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (guild_id, theme_id, collectible_id) DO NOTHING
      `, [
        GUILD_ID,
        themeResult.rows[0].id,
        collectible.collectible_id,
        collectible.name,
        collectible.image_url,
        collectible.rarity || 'common',
        collectible.reveal_message,
        collectible.created_at
      ]);

      log(`  ✓ Collectible migré: ${collectible.name}`, 'green');
    }

    log(`✅ ${collectibles.length} collectible(s) migré(s)\n`, 'green');
  } catch (error) {
    log(`❌ Erreur migration collectibles: ${error.message}`, 'red');
    throw error;
  }
}

async function migrateMissions() {
  log('📋 Migration des missions...', 'cyan');

  try {
    const missions = sqliteDb.prepare('SELECT * FROM missions').all();

    for (const mission of missions) {
      const themeResult = await pgPool.query(
        'SELECT id FROM themes WHERE guild_id = $1 AND id = $2',
        [GUILD_ID, mission.theme_id]
      );

      if (themeResult.rows.length === 0) continue;

      await pgPool.query(`
        INSERT INTO missions (
          guild_id, theme_id, mission_id, name, type, description,
          validation_type, validation_data, timeout, image_url,
          reward_type, reward_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (guild_id, mission_id) DO NOTHING
      `, [
        GUILD_ID,
        themeResult.rows[0].id,
        mission.mission_id,
        mission.name,
        mission.type,
        mission.description,
        mission.validation_type,
        mission.validation_data ? JSON.parse(mission.validation_data) : null,
        mission.timeout,
        mission.image_url,
        mission.reward_type,
        mission.reward_data ? JSON.parse(mission.reward_data) : null,
        mission.created_at
      ]);

      log(`  ✓ Mission migrée: ${mission.name}`, 'green');
    }

    log(`✅ ${missions.length} mission(s) migrée(s)\n`, 'green');
  } catch (error) {
    log(`❌ Erreur migration missions: ${error.message}`, 'red');
    throw error;
  }
}

async function migrateTraps() {
  log('💀 Migration des pièges...', 'cyan');

  try {
    const traps = sqliteDb.prepare('SELECT * FROM traps').all();

    for (const trap of traps) {
      const themeResult = await pgPool.query(
        'SELECT id FROM themes WHERE guild_id = $1 AND id = $2',
        [GUILD_ID, trap.theme_id]
      );

      if (themeResult.rows.length === 0) continue;

      await pgPool.query(`
        INSERT INTO traps (
          guild_id, theme_id, trap_id, name, type, description, image_url,
          cooldown_duration, removes_collectible, shame_message,
          shame_channel_id, malus_points, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (guild_id, trap_id) DO NOTHING
      `, [
        GUILD_ID,
        themeResult.rows[0].id,
        trap.trap_id,
        trap.name,
        trap.type,
        trap.description,
        trap.image_url,
        trap.cooldown_duration,
        trap.removes_collectible === 1,
        trap.shame_message,
        trap.shame_channel_id,
        trap.malus_points,
        trap.created_at
      ]);

      log(`  ✓ Piège migré: ${trap.name}`, 'green');
    }

    log(`✅ ${traps.length} piège(s) migré(s)\n`, 'green');
  } catch (error) {
    log(`❌ Erreur migration pièges: ${error.message}`, 'red');
    throw error;
  }
}

async function migrateSuperBonuses() {
  log('⭐ Migration des super bonus...', 'cyan');

  try {
    const bonuses = sqliteDb.prepare('SELECT * FROM super_bonuses').all();

    for (const bonus of bonuses) {
      let themeId = null;
      if (bonus.theme_id) {
        const themeResult = await pgPool.query(
          'SELECT id FROM themes WHERE guild_id = $1 AND id = $2',
          [GUILD_ID, bonus.theme_id]
        );
        if (themeResult.rows.length > 0) {
          themeId = themeResult.rows[0].id;
        }
      }

      await pgPool.query(`
        INSERT INTO super_bonuses (
          guild_id, bonus_id, name, description, icon, bonus_type,
          effect_type, effect_config, duration_type, duration_value,
          image_url, color, rarity, theme_id, announcement_message, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (guild_id, bonus_id) DO NOTHING
      `, [
        GUILD_ID,
        bonus.bonus_id,
        bonus.name,
        bonus.description,
        bonus.icon,
        bonus.bonus_type,
        bonus.effect_type,
        bonus.effect_config ? JSON.parse(bonus.effect_config) : null,
        bonus.duration_type,
        bonus.duration_value,
        bonus.image_url,
        bonus.color,
        bonus.rarity,
        themeId,
        bonus.announcement_message,
        bonus.created_at
      ]);

      log(`  ✓ Super bonus migré: ${bonus.name}`, 'green');
    }

    log(`✅ ${bonuses.length} super bonus migré(s)\n`, 'green');
  } catch (error) {
    log(`❌ Erreur migration super bonus: ${error.message}`, 'red');
    throw error;
  }
}

async function migratePlayers() {
  log('👥 Migration des joueurs...', 'cyan');

  try {
    const players = sqliteDb.prepare('SELECT * FROM players').all();

    for (const player of players) {
      const result = await pgPool.query(`
        INSERT INTO players (guild_id, discord_id, username, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (guild_id, discord_id) DO NOTHING
        RETURNING id
      `, [GUILD_ID, player.discord_id, player.username, player.created_at, player.updated_at]);

      if (result.rows.length > 0) {
        const newPlayerId = result.rows[0].id;

        // Migrer la progression
        const progress = sqliteDb.prepare('SELECT * FROM player_progress WHERE player_id = ?').all(player.id);
        for (const prog of progress) {
          const themeResult = await pgPool.query(
            'SELECT id FROM themes WHERE guild_id = $1 AND id = $2',
            [GUILD_ID, prog.theme_id]
          );

          if (themeResult.rows.length === 0) continue;

          await pgPool.query(`
            INSERT INTO player_progress (
              guild_id, player_id, theme_id, collected_count,
              is_completed, completed_at, started_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (guild_id, player_id, theme_id) DO NOTHING
          `, [
            GUILD_ID,
            newPlayerId,
            themeResult.rows[0].id,
            prog.collected_count,
            prog.is_completed === 1,
            prog.completed_at,
            prog.started_at
          ]);
        }

        // Migrer les collections
        const collections = sqliteDb.prepare('SELECT * FROM collections WHERE player_id = ?').all(player.id);
        for (const col of collections) {
          const collectibleResult = await pgPool.query(
            'SELECT id FROM collectibles WHERE guild_id = $1 AND id = $2',
            [GUILD_ID, col.collectible_id]
          );

          if (collectibleResult.rows.length === 0) continue;

          await pgPool.query(`
            INSERT INTO collections (
              guild_id, player_id, collectible_id, collected_at, source
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (guild_id, player_id, collectible_id) DO NOTHING
          `, [
            GUILD_ID,
            newPlayerId,
            collectibleResult.rows[0].id,
            col.collected_at,
            col.source
          ]);
        }
      }
    }

    log(`✅ ${players.length} joueur(s) migré(s)\n`, 'green');
  } catch (error) {
    log(`❌ Erreur migration joueurs: ${error.message}`, 'red');
    throw error;
  }
}

async function migrateGiveChannels() {
  log('📢 Migration des canaux de give...', 'cyan');

  try {
    const channels = sqliteDb.prepare('SELECT * FROM give_channels').all();

    for (const channel of channels) {
      await pgPool.query(`
        INSERT INTO give_channels (
          guild_id, type, discord_id, name, parent_category_id, created_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (guild_id, discord_id) DO NOTHING
      `, [
        GUILD_ID,
        channel.type,
        channel.discord_id,
        channel.name,
        channel.parent_category_id,
        channel.created_at,
        channel.created_by
      ]);

      log(`  ✓ Canal migré: ${channel.name}`, 'green');
    }

    log(`✅ ${channels.length} canal/catégorie migré(s)\n`, 'green');
  } catch (error) {
    log(`❌ Erreur migration canaux: ${error.message}`, 'red');
    throw error;
  }
}

async function migrateAnnouncements() {
  log('📣 Migration des annonces...', 'cyan');

  try {
    // Canal d'annonces
    const announcementChannel = sqliteDb.prepare('SELECT * FROM announcement_channel LIMIT 1').get();
    if (announcementChannel) {
      await pgPool.query(`
        INSERT INTO announcement_channel (guild_id, channel_id, channel_name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (guild_id) DO NOTHING
      `, [
        GUILD_ID,
        announcementChannel.channel_id,
        announcementChannel.channel_name,
        announcementChannel.created_at,
        announcementChannel.updated_at
      ]);
      log(`  ✓ Canal d'annonces migré`, 'green');
    }

    // Paramètres d'annonces
    const announcementSettings = sqliteDb.prepare('SELECT * FROM announcement_settings LIMIT 1').get();
    if (announcementSettings) {
      await pgPool.query(`
        INSERT INTO announcement_settings (
          guild_id, legendary_collectible, collection_completed,
          collection_traded, collection_lost, trap_curse,
          mission_word_guessed, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (guild_id) DO NOTHING
      `, [
        GUILD_ID,
        announcementSettings.legendary_collectible === 1,
        announcementSettings.collection_completed === 1,
        announcementSettings.collection_traded === 1,
        announcementSettings.collection_lost === 1,
        announcementSettings.trap_curse === 1,
        announcementSettings.mission_word_guessed === 1,
        announcementSettings.created_at,
        announcementSettings.updated_at
      ]);
      log(`  ✓ Paramètres d'annonces migrés`, 'green');
    }

    log(`✅ Annonces migrées\n`, 'green');
  } catch (error) {
    log(`❌ Erreur migration annonces: ${error.message}`, 'red');
    throw error;
  }
}

async function updateGuildStats() {
  log('📊 Mise à jour des statistiques du serveur...', 'cyan');

  try {
    const stats = await pgPool.query(`
      WITH stats AS (
        SELECT
          (SELECT COUNT(*) FROM players WHERE guild_id = $1) as total_players,
          (SELECT COUNT(*) FROM give_logs WHERE guild_id = $1) as total_gives,
          (SELECT COUNT(*) FROM give_campaigns WHERE guild_id = $1) as total_campaigns,
          (SELECT COUNT(*) FROM collections WHERE guild_id = $1) as total_collections,
          (SELECT MAX(created_at) FROM give_logs WHERE guild_id = $1) as last_give_at
      )
      INSERT INTO guild_stats (guild_id, total_players, total_gives, total_campaigns, total_collections, last_give_at, updated_at)
      SELECT $1, total_players, total_gives, total_campaigns, total_collections, last_give_at, NOW()
      FROM stats
      ON CONFLICT (guild_id) DO UPDATE
        SET total_players = EXCLUDED.total_players,
            total_gives = EXCLUDED.total_gives,
            total_campaigns = EXCLUDED.total_campaigns,
            total_collections = EXCLUDED.total_collections,
            last_give_at = EXCLUDED.last_give_at,
            updated_at = NOW()
      RETURNING *
    `, [GUILD_ID]);

    const s = stats.rows[0];
    log(`  ✓ Joueurs: ${s.total_players}`, 'green');
    log(`  ✓ Gives: ${s.total_gives}`, 'green');
    log(`  ✓ Campagnes: ${s.total_campaigns}`, 'green');
    log(`  ✓ Collections: ${s.total_collections}`, 'green');

    log(`✅ Statistiques mises à jour\n`, 'green');
  } catch (error) {
    log(`❌ Erreur mise à jour stats: ${error.message}`, 'red');
    throw error;
  }
}

async function main() {
  try {
    await connectDatabases();
    await registerGuild();
    await migrateThemes();
    await migrateCollectibles();
    await migrateMissions();
    await migrateTraps();
    await migrateSuperBonuses();
    await migratePlayers();
    await migrateGiveChannels();
    await migrateAnnouncements();
    await updateGuildStats();

    log('\n╔════════════════════════════════════════════════════╗', 'green');
    log('║  ✅ MIGRATION TERMINÉE AVEC SUCCÈS !               ║', 'green');
    log('╚════════════════════════════════════════════════════╝\n', 'green');

    log('Prochaines étapes:', 'cyan');
    log('1. Modifier utils/database.js pour utiliser PostgreSQL', 'yellow');
    log('2. Modifier tous les handlers pour passer guild_id', 'yellow');
    log('3. Tester le bot avec PostgreSQL', 'yellow');
    log('4. Supprimer bot.db une fois que tout fonctionne\n', 'yellow');

  } catch (error) {
    log('\n❌ MIGRATION ÉCHOUÉE', 'red');
    log(error.stack, 'red');
    process.exit(1);
  } finally {
    if (sqliteDb) sqliteDb.close();
    if (pgPool) await pgPool.end();
  }
}

main();
