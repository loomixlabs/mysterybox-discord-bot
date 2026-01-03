/**
 * Remplacer le thème Harry Potter local (ID 58) par celui du VPS (ID 63)
 * Pour le serveur 297309737135898624
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const GUILD_ID = '297309737135898624';
const LOCAL_THEME_ID = 58;
const VPS_THEME_ID = 63;

async function replaceTheme() {
  const client = await pool.connect();

  try {
    console.log('🔄 REMPLACEMENT THEME HARRY POTTER\n');
    console.log('='.repeat(80));
    console.log(`Guild: ${GUILD_ID}`);
    console.log(`Local Theme ID: ${LOCAL_THEME_ID} → VPS Theme ID: ${VPS_THEME_ID}`);

    await client.query('BEGIN');

    // 1. Supprimer les données du thème local
    console.log('\n🗑️  SUPPRESSION THEME LOCAL (ID 58):');

    // Quiz questions
    const delQuiz = await client.query(
      'DELETE FROM quiz_questions WHERE theme_id = $1 RETURNING id',
      [LOCAL_THEME_ID]
    );
    console.log(`   - quiz_questions: ${delQuiz.rowCount} supprimées`);

    // Mission keywords
    const missionIds = await client.query(
      'SELECT id FROM missions WHERE theme_id = $1',
      [LOCAL_THEME_ID]
    );
    if (missionIds.rows.length > 0) {
      const ids = missionIds.rows.map(r => r.id);
      const delKw = await client.query(
        'DELETE FROM mission_keywords WHERE mission_id = ANY($1) RETURNING id',
        [ids]
      );
      console.log(`   - mission_keywords: ${delKw.rowCount} supprimés`);
    }

    // Missions
    const delMissions = await client.query(
      'DELETE FROM missions WHERE theme_id = $1 RETURNING id',
      [LOCAL_THEME_ID]
    );
    console.log(`   - missions: ${delMissions.rowCount} supprimées`);

    // Traps
    const delTraps = await client.query(
      'DELETE FROM traps WHERE theme_id = $1 RETURNING id',
      [LOCAL_THEME_ID]
    );
    console.log(`   - traps: ${delTraps.rowCount} supprimés`);

    // Collectibles
    const delCols = await client.query(
      'DELETE FROM collectibles WHERE theme_id = $1 RETURNING id',
      [LOCAL_THEME_ID]
    );
    console.log(`   - collectibles: ${delCols.rowCount} supprimés`);

    // Theme config
    const delConfig = await client.query(
      'DELETE FROM theme_config WHERE theme_id = $1 RETURNING id',
      [LOCAL_THEME_ID]
    );
    console.log(`   - theme_config: ${delConfig.rowCount} supprimés`);

    // Theme messages
    const delMsgs = await client.query(
      'DELETE FROM theme_messages WHERE theme_id = $1 RETURNING id',
      [LOCAL_THEME_ID]
    );
    console.log(`   - theme_messages: ${delMsgs.rowCount} supprimés`);

    // Theme
    const delTheme = await client.query(
      'DELETE FROM themes WHERE id = $1 RETURNING id',
      [LOCAL_THEME_ID]
    );
    console.log(`   - themes: ${delTheme.rowCount} supprimé`);

    // 2. Lire et importer les données du VPS
    console.log('\n📥 IMPORT DEPUIS VPS (ID 63):');

    const backupPath = path.join(__dirname, '..', 'backups', 'backup_botdb_fresh_20251129_203846.sql');
    const content = fs.readFileSync(backupPath, 'utf-8');

    // Helper pour parser une section COPY
    function parseCopySection(tableName) {
      const regex = new RegExp(
        `COPY public\\.${tableName} \\(([^)]+)\\) FROM stdin;([\\s\\S]*?)\\\\\\.\n`,
        'i'
      );
      const match = content.match(regex);
      if (!match) return { columns: [], rows: [] };

      const columns = match[1].split(',').map(c => c.trim());
      const rows = match[2].trim().split('\n').filter(l => l.trim()).map(line => {
        const values = line.split('\t');
        const obj = {};
        columns.forEach((col, i) => {
          obj[col] = values[i] === '\\N' ? null : values[i];
        });
        return obj;
      });

      return { columns, rows };
    }

    // Import theme
    const themes = parseCopySection('themes');
    const vpsTheme = themes.rows.find(t => t.id === '63');
    if (vpsTheme) {
      await client.query(`
        INSERT INTO themes (id, guild_id, theme_id, name, is_active, duration_days, required_items,
                           final_role_name, final_role_color, final_role_discord_id, created_at, updated_at, activated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        63, GUILD_ID, vpsTheme.theme_id, vpsTheme.name, vpsTheme.is_active === 'true',
        vpsTheme.duration_days, vpsTheme.required_items, vpsTheme.final_role_name,
        vpsTheme.final_role_color, vpsTheme.final_role_discord_id,
        vpsTheme.created_at, vpsTheme.updated_at, vpsTheme.activated_at
      ]);
      console.log(`   ✅ Theme importé: ${vpsTheme.name}`);
    }

    // Import collectibles
    const collectibles = parseCopySection('collectibles');
    const vpsCols = collectibles.rows.filter(c => c.theme_id === '63');
    for (const col of vpsCols) {
      await client.query(`
        INSERT INTO collectibles (id, guild_id, theme_id, collectible_id, name, rarity, image_url,
                                 reveal_message, description, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [
        col.id, GUILD_ID, 63, col.collectible_id, col.name, col.rarity,
        col.image_url, col.reveal_message, col.description, col.created_at
      ]);
    }
    console.log(`   ✅ Collectibles: ${vpsCols.length} importés`);

    // Import traps
    const traps = parseCopySection('traps');
    const vpsTraps = traps.rows.filter(t => t.theme_id === '63');
    for (const trap of vpsTraps) {
      await client.query(`
        INSERT INTO traps (id, guild_id, theme_id, trap_id, name, type, description, image_url,
                          cooldown_duration, shame_message, shame_channel_id, malus_points,
                          removes_collectible, is_active, is_default, created_at,
                          notif_title, notif_description, notif_color, notif_footer)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        ON CONFLICT (id) DO NOTHING
      `, [
        trap.id, GUILD_ID, 63, trap.trap_id, trap.name, trap.type, trap.description, trap.image_url,
        trap.cooldown_duration, trap.shame_message, trap.shame_channel_id, trap.malus_points,
        trap.removes_collectible === 'true', trap.is_active === 'true', trap.is_default === 'true',
        trap.created_at, trap.notif_title, trap.notif_description, trap.notif_color, trap.notif_footer
      ]);
    }
    console.log(`   ✅ Traps: ${vpsTraps.length} importés`);

    // Import missions
    const missions = parseCopySection('missions');
    const vpsMissions = missions.rows.filter(m => m.theme_id === '63');
    for (const m of vpsMissions) {
      await client.query(`
        INSERT INTO missions (id, guild_id, theme_id, mission_id, name, description, type, timeout,
                             max_attempts, reward_type, reward_amount, image_url, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO NOTHING
      `, [
        m.id, GUILD_ID, 63, m.mission_id, m.name, m.description, m.type, m.timeout,
        m.max_attempts, m.reward_type, m.reward_amount, m.image_url,
        m.is_active === 'true', m.created_at
      ]);
    }
    console.log(`   ✅ Missions: ${vpsMissions.length} importées`);

    // Import quiz questions
    const quizQuestions = parseCopySection('quiz_questions');
    const vpsQuiz = quizQuestions.rows.filter(q => q.theme_id === '63');
    for (const q of vpsQuiz) {
      await client.query(`
        INSERT INTO quiz_questions (id, guild_id, theme_id, question_text, correct_answer, wrong_answers,
                                   hint, difficulty, created_at, updated_at, mission_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [
        q.id, GUILD_ID, 63, q.question_text, q.correct_answer, q.wrong_answers,
        q.hint, q.difficulty, q.created_at, q.updated_at, q.mission_id
      ]);
    }
    console.log(`   ✅ Quiz questions: ${vpsQuiz.length} importées`);

    // Import mission keywords
    const keywords = parseCopySection('mission_keywords');
    const missionIdsVps = vpsMissions.map(m => m.id);
    const vpsKw = keywords.rows.filter(k => missionIdsVps.includes(k.mission_id));
    for (const kw of vpsKw) {
      await client.query(`
        INSERT INTO mission_keywords (id, mission_id, keyword, created_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `, [kw.id, kw.mission_id, kw.keyword, kw.created_at]);
    }
    console.log(`   ✅ Mission keywords: ${vpsKw.length} importés`);

    await client.query('COMMIT');

    // 3. Mettre à jour les séquences
    console.log('\n🔧 MISE À JOUR SÉQUENCES:');
    const sequences = [
      'themes_id_seq',
      'collectibles_id_seq',
      'traps_id_seq',
      'missions_id_seq',
      'quiz_questions_id_seq',
      'mission_keywords_id_seq'
    ];

    for (const seq of sequences) {
      const tableName = seq.replace('_id_seq', '');
      try {
        await pool.query(`SELECT setval('${seq}', (SELECT COALESCE(MAX(id), 1) FROM ${tableName}))`);
        console.log(`   ✅ ${seq} mis à jour`);
      } catch (e) {
        console.log(`   ⚠️  ${seq}: ${e.message.substring(0, 50)}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ REMPLACEMENT TERMINÉ!');

    // Vérification finale
    console.log('\n📊 VÉRIFICATION:');
    const checkTheme = await pool.query('SELECT id, name FROM themes WHERE id = 63');
    console.log(`   Theme: ${checkTheme.rows[0]?.name || 'NOT FOUND'}`);

    const checkCols = await pool.query('SELECT COUNT(*) FROM collectibles WHERE theme_id = 63');
    console.log(`   Collectibles: ${checkCols.rows[0].count}`);

    const checkTraps = await pool.query('SELECT COUNT(*) FROM traps WHERE theme_id = 63');
    console.log(`   Traps: ${checkTraps.rows[0].count}`);

    const checkMissions = await pool.query('SELECT COUNT(*) FROM missions WHERE theme_id = 63');
    console.log(`   Missions: ${checkMissions.rows[0].count}`);

    const checkQuiz = await pool.query('SELECT COUNT(*) FROM quiz_questions WHERE theme_id = 63 AND mission_id IS NOT NULL');
    console.log(`   Quiz questions (liées): ${checkQuiz.rows[0].count}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

replaceTheme();
