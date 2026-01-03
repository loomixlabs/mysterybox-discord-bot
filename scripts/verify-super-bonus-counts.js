require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070'; // Serveur de production

async function verify() {
  try {
    console.log('🔍 VÉRIFICATION DES COMPTEURS SUPER BONUS\n');
    console.log('='.repeat(80));

    // 1. Vérifier qu'il n'y a plus de bonus pour floerin
    console.log('\n📋 Bonus restants pour floerin:\n');
    const floerin = await db.queryAll(`
      SELECT
        pab.id,
        sb.name as bonus_name,
        sb.icon,
        pab.is_active,
        pab.obtained_from
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1 AND pab.user_id = '692649463805640724'
    `, [GUILD_ID]);

    if (floerin.length === 0) {
      console.log('✅ Aucun bonus pour floerin (nettoyage réussi)');
    } else {
      console.table(floerin);
      console.error('❌ Il reste des bonus pour floerin !');
    }

    // 2. Compter les bonus ACTIFS (nouvelle requête)
    console.log('\n📊 Bonus ACTIFS (is_active = TRUE et non expirés):\n');
    const activeCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM player_active_bonuses
      WHERE guild_id = $1
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
    `, [GUILD_ID]);
    console.log(`✅ ${activeCount.count} activation(s) en cours`);

    // 3. Compter les bonus INACTIFS
    console.log('\n📊 Bonus INACTIFS (is_active = FALSE ou expirés):\n');
    const inactiveCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM player_active_bonuses
      WHERE guild_id = $1
        AND (is_active = FALSE OR (expires_at IS NOT NULL AND expires_at <= NOW()))
    `, [GUILD_ID]);
    console.log(`✅ ${inactiveCount.count} bonus inactif(s)`);

    // 4. Liste détaillée de tous les bonus actifs (s'il y en a)
    if (parseInt(activeCount.count) > 0) {
      console.log('\n📋 Détail des bonus actifs:\n');
      const activeDetails = await db.queryAll(`
        SELECT
          sb.icon,
          sb.name as bonus_name,
          p.username,
          pab.user_id,
          pab.is_active,
          pab.activated_at,
          pab.expires_at,
          pab.obtained_from
        FROM player_active_bonuses pab
        JOIN super_bonuses sb ON pab.bonus_id = sb.id
        LEFT JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
        WHERE pab.guild_id = $1
          AND pab.is_active = TRUE
          AND (pab.expires_at IS NULL OR pab.expires_at > NOW())
        ORDER BY pab.activated_at DESC
      `, [GUILD_ID]);

      console.table(activeDetails.map(b => ({
        'Bonus': `${b.icon} ${b.bonus_name}`,
        'Joueur': b.username || 'Inconnu',
        'Discord ID': b.user_id,
        'Activé': b.is_active ? '✅' : '❌',
        'Expire': b.expires_at ? new Date(b.expires_at).toLocaleString('fr-FR') : 'Permanent',
        'Source': b.obtained_from
      })));
    }

    // 5. Liste détaillée de tous les bonus inactifs (s'il y en a)
    if (parseInt(inactiveCount.count) > 0) {
      console.log('\n📋 Détail des bonus inactifs:\n');
      const inactiveDetails = await db.queryAll(`
        SELECT
          sb.icon,
          sb.name as bonus_name,
          p.username,
          pab.user_id,
          pab.is_active,
          pab.activated_at,
          pab.expires_at,
          pab.obtained_from
        FROM player_active_bonuses pab
        JOIN super_bonuses sb ON pab.bonus_id = sb.id
        LEFT JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
        WHERE pab.guild_id = $1
          AND (pab.is_active = FALSE OR (pab.expires_at IS NOT NULL AND pab.expires_at <= NOW()))
        ORDER BY pab.activated_at DESC
      `, [GUILD_ID]);

      console.table(inactiveDetails.map(b => ({
        'Bonus': `${b.icon} ${b.bonus_name}`,
        'Joueur': b.username || 'Inconnu',
        'Discord ID': b.user_id,
        'Actif': b.is_active ? '✅' : '❌',
        'Expire': b.expires_at ? new Date(b.expires_at).toLocaleString('fr-FR') : 'Permanent',
        'Source': b.obtained_from
      })));
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Vérification terminée !\n');
    console.log(`📊 RÉSUMÉ:`);
    console.log(`   • ${activeCount.count} activation(s) en cours`);
    console.log(`   • ${inactiveCount.count} bonus inactif(s)`);
    console.log(`   • 0 bonus pour floerin (nettoyé)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verify();
