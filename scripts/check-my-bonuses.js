const db = require('../utils/database-pg');

async function checkMyBonuses() {
  try {
    const guildId = '1248028543389143070'; // Serveur de test
    const userId = '692649463805640724'; // CharlotteGND

    console.log('🔍 VÉRIFICATION DES BONUS ACTIFS\n');
    console.log('='.repeat(80));

    // Récupérer tous les bonus actifs du joueur
    const bonuses = await db.query(
      `SELECT
        pab.id,
        pab.activated_at,
        pab.expires_at,
        pab.remaining_charges,
        pab.is_active,
        pab.obtained_from,
        sb.bonus_id,
        sb.name,
        sb.description,
        sb.icon,
        sb.effect_type,
        sb.duration_type,
        sb.duration_value,
        sb.activation_mode
       FROM player_active_bonuses pab
       JOIN super_bonuses sb ON pab.bonus_id = sb.id
       WHERE pab.user_id = $1 AND pab.guild_id = $2
       ORDER BY pab.activated_at DESC NULLS LAST, pab.id DESC`,
      [userId, guildId]
    );

    if (bonuses.length === 0) {
      console.log('❌ Aucun bonus trouvé pour ce joueur\n');
      process.exit(0);
    }

    console.log(`✅ ${bonuses.length} bonus trouvé(s)\n`);

    // Séparer les bonus actifs et en attente
    const activeBonuses = bonuses.filter(b => b.activated_at !== null);
    const pendingBonuses = bonuses.filter(b => b.activated_at === null);

    // Afficher les bonus actifs
    if (activeBonuses.length > 0) {
      console.log('✨ BONUS ACTIFS (' + activeBonuses.length + ')');
      console.log('-'.repeat(80));

      activeBonuses.forEach((bonus, index) => {
        console.log(`\n${index + 1}. ${bonus.icon || '✨'} ${bonus.name} (ID: ${bonus.id})`);
        console.log(`   Description: ${bonus.description}`);
        console.log(`   Type d'effet: ${bonus.effect_type}`);
        console.log(`   Type de durée: ${bonus.duration_type}`);
        console.log(`   Mode d'activation: ${bonus.activation_mode}`);
        console.log(`   Activé le: ${new Date(bonus.activated_at).toLocaleString('fr-FR')}`);

        if (bonus.duration_type === 'permanent') {
          console.log(`   ♾️  Durée: PERMANENT`);
        } else if (bonus.duration_type === 'charges') {
          console.log(`   🔢 Charges restantes: ${bonus.remaining_charges}`);
        } else if (bonus.duration_type === 'temporary' && bonus.expires_at) {
          const now = new Date();
          const expiresAt = new Date(bonus.expires_at);
          const timeLeft = expiresAt - now;

          if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            console.log(`   ⏱️  Expire dans: ${hours}h ${minutes}min`);
            console.log(`   ⏱️  Date d'expiration: ${expiresAt.toLocaleString('fr-FR')}`);
          } else {
            console.log(`   ⏱️  EXPIRÉ depuis ${Math.abs(Math.floor(timeLeft / (1000 * 60)))} minutes`);
          }
        }

        console.log(`   Obtenu via: ${bonus.obtained_from}`);
        console.log(`   Statut: ${bonus.is_active ? '🟢 ACTIF' : '🔴 INACTIF'}`);
      });
    }

    // Afficher les bonus en attente
    if (pendingBonuses.length > 0) {
      console.log('\n\n🎯 BONUS EN ATTENTE D\'ACTIVATION (' + pendingBonuses.length + ')');
      console.log('-'.repeat(80));

      pendingBonuses.forEach((bonus, index) => {
        console.log(`\n${index + 1}. ${bonus.icon || '🎯'} ${bonus.name} (ID: ${bonus.id})`);
        console.log(`   Description: ${bonus.description}`);
        console.log(`   Type d'effet: ${bonus.effect_type}`);
        console.log(`   Mode d'activation: ${bonus.activation_mode}`);

        if (bonus.duration_type === 'permanent') {
          console.log(`   ♾️  Durée après activation: PERMANENT`);
        } else if (bonus.duration_type === 'charges') {
          // Utiliser remaining_charges (valeur réelle) au lieu de duration_value (valeur par défaut)
          const charges = bonus.remaining_charges !== null ? bonus.remaining_charges : bonus.duration_value;
          console.log(`   🔢 Charges disponibles: ${charges}`);
        } else if (bonus.duration_type === 'temporary') {
          const hours = Math.floor(bonus.duration_value / 3600);
          const minutes = Math.floor((bonus.duration_value % 3600) / 60);
          console.log(`   ⏱️  Durée après activation: ${hours}h ${minutes}min`);
        }

        console.log(`   Obtenu via: ${bonus.obtained_from}`);
        console.log(`   💡 À activer via /profile → Mes Bonus`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Vérification terminée\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkMyBonuses();
