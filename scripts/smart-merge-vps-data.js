/**
 * Merge intelligent des données VPS vers Local
 * - N'importe QUE les données d'activité joueurs
 * - Ne touche PAS aux tables Theme Builder
 * - Ne touche PAS aux tables de contenu thème (collectibles, traps, missions, etc.)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Tables à NE PAS TOUCHER (Theme Builder + Contenu thème)
const PROTECTED_TABLES = [
  // Theme Builder spécifiques
  'theme_builder_sessions',
  'theme_builder_config',
  'theme_builder_logs',
  'theme_uploads',
  'themes_library',
  'banned_builder_users',
  'guild_branding',
  'guild_stats',
  'theme_creator_guilds',

  // Contenu thème (créé via Theme Builder)
  'collectibles',
  'traps',
  'missions',
  'mission_keywords',
  'quiz_questions',
  'themes',
  'theme_config',
  'theme_messages',
  'announcement_templates',

  // Config serveur
  'guild_config',
  'guild_admin_roles',
  'announcement_settings',
  'announcement_channel',

  // Système
  'super_admins',
  'super_bonuses',
  'badges',
  'colors'
];

// Tables à MERGER (données d'activité joueurs)
const TABLES_TO_MERGE = [
  'players',
  'player_progress',
  'player_active_bonuses',
  'player_badges',
  'player_cooldowns',
  'player_login_history',
  'player_malus_points',
  'collections',
  'badge_progress',
  'bonus_usage_history',
  'give_logs',
  'give_campaigns',
  'give_channels',
  'mission_progress',
  'trap_triggered',
  'audit_logs',
  'super_admin_logs',
  'apple_game_winners'
];

async function smartMerge() {
  try {
    console.log('🔄 MERGE INTELLIGENT VPS → LOCAL\n');
    console.log('='.repeat(80));

    // Lire le backup VPS
    const backupPath = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');
    const backupContent = fs.readFileSync(backupPath, 'utf-8');

    console.log('\n📋 TABLES PROTÉGÉES (non modifiées):');
    console.log('   ' + PROTECTED_TABLES.slice(0, 10).join(', ') + '...');

    console.log('\n📥 TABLES À MERGER:');
    console.log('   ' + TABLES_TO_MERGE.join(', '));

    console.log('\n' + '-'.repeat(80));

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const tableName of TABLES_TO_MERGE) {
      // Extraire les données COPY du backup
      const copyRegex = new RegExp(
        `COPY public\\.${tableName} \\(([^)]+)\\) FROM stdin;([\\s\\S]*?)\\\\\\.`,
        'i'
      );
      const copyMatch = backupContent.match(copyRegex);

      if (!copyMatch) {
        console.log(`⏭️  ${tableName}: Pas de données dans le backup`);
        continue;
      }

      const columns = copyMatch[1].split(',').map(c => c.trim());
      const dataLines = copyMatch[2].trim().split('\n').filter(l => l.trim());

      if (dataLines.length === 0) {
        console.log(`⏭️  ${tableName}: 0 lignes`);
        continue;
      }

      // Compter les lignes locales actuelles
      const localCount = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
      const localRows = parseInt(localCount.rows[0].count);

      console.log(`\n📦 ${tableName}: ${dataLines.length} lignes VPS, ${localRows} lignes locales`);

      // Déterminer la clé primaire
      const pkResult = await pool.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary
      `, [tableName]);

      const primaryKeys = pkResult.rows.map(r => r.attname);

      if (primaryKeys.length === 0) {
        console.log(`   ⚠️  Pas de clé primaire, skip`);
        continue;
      }

      let inserted = 0;
      let skipped = 0;

      for (const line of dataLines) {
        const values = line.split('\t');

        // Construire l'objet de données
        const data = {};
        columns.forEach((col, idx) => {
          let val = values[idx];
          if (val === '\\N') val = null;
          data[col] = val;
        });

        // Vérifier si l'entrée existe déjà
        const whereClause = primaryKeys.map((pk, idx) => `${pk} = $${idx + 1}`).join(' AND ');
        const pkValues = primaryKeys.map(pk => data[pk]);

        try {
          const exists = await pool.query(
            `SELECT 1 FROM ${tableName} WHERE ${whereClause}`,
            pkValues
          );

          if (exists.rows.length > 0) {
            skipped++;
            continue;
          }

          // Insérer la nouvelle ligne
          const insertCols = columns.filter(c => data[c] !== undefined);
          const insertVals = insertCols.map(c => data[c]);
          const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');

          await pool.query(
            `INSERT INTO ${tableName} (${insertCols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            insertVals
          );
          inserted++;

        } catch (err) {
          // Ignorer les erreurs de contrainte
          if (!err.message.includes('duplicate') && !err.message.includes('violates')) {
            console.log(`   ❌ Erreur: ${err.message.substring(0, 50)}`);
          }
          skipped++;
        }
      }

      console.log(`   ✅ Insérées: ${inserted}, Existantes: ${skipped}`);
      totalInserted += inserted;
      totalSkipped += skipped;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 RÉSUMÉ:`);
    console.log(`   ✅ Nouvelles entrées insérées: ${totalInserted}`);
    console.log(`   ⏭️  Entrées existantes (ignorées): ${totalSkipped}`);
    console.log(`\n✅ Merge terminé avec succès!`);

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await pool.end();
    process.exit(1);
  }
}

smartMerge();
