require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070'; // Serveur de production

async function analyze() {
  try {
    console.log('🔍 ANALYSE DES UTILISATEURS ACTIFS - SUPER BONUSES\n');
    console.log('='.repeat(80));

    // 1. Récupérer le schéma de la table player_active_bonuses
    console.log('\n📊 SCHÉMA DE LA TABLE player_active_bonuses:\n');
    const schema = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      ORDER BY ordinal_position
    `);
    console.table(schema);

    // 2. Compter le total d'utilisateurs actifs
    console.log('\n📈 STATISTIQUES GLOBALES:\n');
    const totalActive = await db.queryOne(`
      SELECT COUNT(*) as total_active_bonuses
      FROM player_active_bonuses
      WHERE guild_id = $1
    `, [GUILD_ID]);
    console.log(`Total d'entrées actives: ${totalActive.total_active_bonuses}`);

    // 3. Récupérer tous les bonus actifs avec détails
    console.log('\n🎁 DÉTAIL DES BONUS ACTIFS:\n');
    const activeBonuses = await db.queryAll(`
      SELECT
        pab.id,
        pab.bonus_id,
        sb.name as bonus_name,
        sb.icon,
        sb.rarity,
        pab.user_id,
        p.username,
        pab.activated_at,
        pab.expires_at,
        pab.remaining_charges,
        pab.is_active,
        pab.obtained_from,
        pab.given_by
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      LEFT JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      WHERE pab.guild_id = $1
      ORDER BY pab.activated_at DESC
    `, [GUILD_ID]);

    if (activeBonuses.length > 0) {
      console.table(activeBonuses.map(b => ({
        'Bonus': `${b.icon} ${b.bonus_name}`,
        'Rareté': b.rarity,
        'Joueur': b.username || 'Inconnu',
        'Discord ID': b.user_id,
        'Activé le': b.activated_at ? new Date(b.activated_at).toLocaleString('fr-FR') : 'N/A',
        'Expire le': b.expires_at ? new Date(b.expires_at).toLocaleString('fr-FR') : 'Permanent',
        'Charges': b.remaining_charges || 'N/A',
        'Actif': b.is_active ? '✅' : '❌',
        'Source': b.obtained_from || 'N/A',
        'Donné par': b.given_by || 'N/A'
      })));
    } else {
      console.log('❌ Aucun bonus actif trouvé dans la base de données');
    }

    // 4. Vérifier les bonus par utilisateur
    console.log('\n👥 BONUS PAR UTILISATEUR:\n');
    const bonusByUser = await db.queryAll(`
      SELECT
        pab.user_id,
        p.username,
        COUNT(*) as nombre_bonus
      FROM player_active_bonuses pab
      LEFT JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      WHERE pab.guild_id = $1
      GROUP BY pab.user_id, p.username
      ORDER BY nombre_bonus DESC
    `, [GUILD_ID]);

    if (bonusByUser.length > 0) {
      console.table(bonusByUser);
      console.log(`\n📊 Total: ${bonusByUser.length} utilisateur(s) avec des bonus actifs`);
    }

    // 5. Vérifier les bonus expirés non nettoyés
    console.log('\n⏰ VÉRIFICATION DES BONUS EXPIRÉS:\n');
    const expiredBonuses = await db.queryAll(`
      SELECT
        sb.name as bonus_name,
        p.username,
        pab.user_id,
        pab.expires_at,
        pab.is_active,
        CASE
          WHEN pab.expires_at < NOW() THEN 'Expiré'
          WHEN pab.expires_at IS NULL THEN 'Permanent'
          ELSE 'Actif'
        END as status
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      LEFT JOIN players p ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id
      WHERE pab.guild_id = $1
      ORDER BY pab.expires_at
    `, [GUILD_ID]);

    if (expiredBonuses.length > 0) {
      console.table(expiredBonuses);
    }

    // 6. Afficher le calcul utilisé dans le panneau admin
    console.log('\n🔢 CALCUL AFFICHÉ DANS LE PANNEAU ADMIN:\n');
    const adminCalc = await db.queryAll(`
      SELECT
        sb.id,
        sb.name,
        sb.icon,
        sb.rarity,
        sb.is_enabled,
        (SELECT COUNT(*) FROM player_active_bonuses pab
         WHERE pab.bonus_id = sb.id AND pab.guild_id = sb.guild_id) as active_users
      FROM super_bonuses sb
      WHERE sb.guild_id = $1
      ORDER BY active_users DESC
    `, [GUILD_ID]);

    console.table(adminCalc.map(b => ({
      'Bonus': `${b.icon} ${b.name}`,
      'Rareté': b.rarity,
      'Activé': b.is_enabled ? '✅' : '❌',
      'Utilisateurs actifs': b.active_users
    })));

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analyse terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyze();
