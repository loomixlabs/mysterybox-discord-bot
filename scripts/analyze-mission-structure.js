require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function analyzeMissionStructure() {
  console.log('🔍 ANALYSE DE LA STRUCTURE DES MISSIONS\n');
  console.log('━'.repeat(80));

  try {
    // 1. Structure de la table mission_progress
    console.log('📊 ÉTAPE 1: Structure de la table mission_progress\n');

    const tableInfo = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'mission_progress'
      ORDER BY ordinal_position
    `);

    console.log('Colonnes de mission_progress:\n');
    tableInfo.forEach(col => {
      console.log(`  - ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n' + '━'.repeat(80));
    console.log('📊 ÉTAPE 2: Exemple de missions actives\n');

    // 2. Récupérer quelques missions actives avec tous les détails
    const activeMissions = await db.query(`
      SELECT
        mp.id,
        mp.player_id,
        mp.mission_id,
        mp.thread_id,
        mp.status,
        mp.target_keyword,
        mp.target_channel_id,
        mp.created_at,
        mp.completed_at,
        p.username,
        p.discord_id,
        m.name as mission_name,
        m.type as mission_type
      FROM mission_progress mp
      JOIN players p ON mp.player_id = p.id
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1
      ORDER BY mp.created_at DESC
      LIMIT 10
    `, [GUILD_ID]);

    console.log(`Dernières missions (${activeMissions.length}):\n`);

    activeMissions.forEach((m, i) => {
      console.log(`[${i + 1}] Mission ID: ${m.id}`);
      console.log(`    Joueur: ${m.username} (player_id: ${m.player_id})`);
      console.log(`    Mission: ${m.mission_name} (${m.mission_type})`);
      console.log(`    Thread: ${m.thread_id || 'N/A'}`);
      console.log(`    Mot-clé: ${m.target_keyword || 'N/A'}`);
      console.log(`    Canal: ${m.target_channel_id || 'N/A'}`);
      console.log(`    Statut: ${m.status}`);
      console.log(`    Créée: ${m.created_at.toLocaleString()}`);
      console.log(`    Complétée: ${m.completed_at ? m.completed_at.toLocaleString() : 'N/A'}`);
      console.log('');
    });

    console.log('━'.repeat(80));
    console.log('📊 ÉTAPE 3: Vérification des doublons de mots-clés\n');

    // 3. Vérifier s'il y a des missions avec le même mot-clé actives en même temps
    const duplicateKeywords = await db.query(`
      SELECT
        target_keyword,
        COUNT(*) as count,
        STRING_AGG(DISTINCT p.username, ', ') as players
      FROM mission_progress mp
      JOIN players p ON mp.player_id = p.id
      WHERE mp.guild_id = $1
        AND mp.status = 'in_progress'
        AND mp.target_keyword IS NOT NULL
      GROUP BY target_keyword
      HAVING COUNT(*) > 1
    `, [GUILD_ID]);

    if (duplicateKeywords.length > 0) {
      console.log('⚠️  DOUBLONS DE MOTS-CLÉS ACTIFS DÉTECTÉS:\n');
      duplicateKeywords.forEach(d => {
        console.log(`   Mot "${d.target_keyword}": ${d.count} missions actives`);
        console.log(`   Joueurs: ${d.players}\n`);
      });
    } else {
      console.log('✅ Aucun doublon de mot-clé actif détecté\n');
    }

    console.log('━'.repeat(80));
    console.log('📊 ÉTAPE 4: Joueurs avec plusieurs missions actives\n');

    // 4. Trouver les joueurs avec plusieurs missions en cours
    const playersMultipleMissions = await db.query(`
      SELECT
        p.username,
        p.discord_id,
        COUNT(*) as active_missions,
        STRING_AGG(mp.target_keyword, ', ') as keywords,
        STRING_AGG(mp.thread_id, ', ') as thread_ids
      FROM mission_progress mp
      JOIN players p ON mp.player_id = p.id
      WHERE mp.guild_id = $1
        AND mp.status = 'in_progress'
      GROUP BY p.id, p.username, p.discord_id
      HAVING COUNT(*) > 1
    `, [GUILD_ID]);

    if (playersMultipleMissions.length > 0) {
      console.log('👥 Joueurs avec plusieurs missions en cours:\n');
      playersMultipleMissions.forEach(p => {
        console.log(`   ${p.username}:`);
        console.log(`      Missions actives: ${p.active_missions}`);
        console.log(`      Mots-clés: ${p.keywords}`);
        console.log(`      Threads: ${p.thread_ids}`);
        console.log('');
      });
    } else {
      console.log('✅ Aucun joueur n\'a plusieurs missions en cours\n');
    }

    console.log('━'.repeat(80));
    console.log('📊 ÉTAPE 5: Missions complétées sans collectibles\n');

    // 5. Trouver les missions complétées qui n'ont pas donné de collectibles
    const completedWithoutReward = await db.query(`
      SELECT
        mp.id,
        p.username,
        m.name as mission_name,
        mp.target_keyword,
        mp.completed_at,
        mp.thread_id
      FROM mission_progress mp
      JOIN players p ON mp.player_id = p.id
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1
        AND mp.status = 'completed'
        AND mp.completed_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM collections c
          WHERE c.guild_id = mp.guild_id
            AND c.player_id = mp.player_id
            AND c.source = 'mission'
            AND c.collected_at BETWEEN mp.completed_at - INTERVAL '2 minutes'
                                   AND mp.completed_at + INTERVAL '2 minutes'
        )
      ORDER BY mp.completed_at DESC
      LIMIT 10
    `, [GUILD_ID]);

    if (completedWithoutReward.length > 0) {
      console.log(`⚠️  ${completedWithoutReward.length} missions complétées SANS collectible:\n`);
      completedWithoutReward.forEach(m => {
        console.log(`   Mission ${m.id} - ${m.username}`);
        console.log(`      Mission: ${m.mission_name}`);
        console.log(`      Mot-clé: ${m.target_keyword || 'N/A'}`);
        console.log(`      Complétée: ${m.completed_at.toLocaleString()}`);
        console.log(`      Thread: ${m.thread_id || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('✅ Toutes les missions complétées ont donné un collectible\n');
    }

    console.log('━'.repeat(80));
    console.log('📊 ÉTAPE 6: Statistiques globales\n');

    // 6. Statistiques globales
    const stats = await db.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM mission_progress
      WHERE guild_id = $1
      GROUP BY status
      ORDER BY count DESC
    `, [GUILD_ID]);

    console.log('Répartition par statut:\n');
    stats.forEach(s => {
      console.log(`   ${s.status.padEnd(15)}: ${s.count} missions`);
    });

    console.log('\n' + '━'.repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

analyzeMissionStructure();
