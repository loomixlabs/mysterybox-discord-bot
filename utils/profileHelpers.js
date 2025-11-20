const db = require('./database-pg');

/**
 * 🎨 Obtenir l'emoji correspondant à une rareté
 */
function getRarityEmoji(rarity) {
  const emojis = {
    'Légendaire': '🌟',
    'Épique': '💎',
    'Rare': '💠',
    'Commun': '⚪'
  };
  return emojis[rarity] || '❓';
}

/**
 * 🎨 Obtenir la couleur correspondant à une rareté
 */
function getRarityColor(rarity) {
  const colors = {
    'Légendaire': '#FFD700', // Or
    'Épique': '#9B59B6',     // Violet
    'Rare': '#3498DB',       // Bleu
    'Commun': '#95A5A6'      // Gris
  };
  return colors[rarity] || '#95A5A6';
}

/**
 * 🎨 Obtenir une couleur dynamique basée sur la progression
 */
function getDynamicColor(collected, required) {
  const percentage = (collected / required) * 100;

  if (percentage >= 100) return '#FFD700'; // Or - Complet
  if (percentage >= 90) return '#FF6B35';  // Orange vif - Presque complet
  if (percentage >= 75) return '#9B59B6';  // Violet - Avancé
  if (percentage >= 50) return '#3498DB';  // Bleu - À mi-chemin
  if (percentage >= 30) return '#2ECC71';  // Vert - Bon départ
  if (percentage >= 10) return '#F39C12';  // Orange - Début
  return '#E74C3C';                        // Rouge - Tout début
}

/**
 * 📊 Créer une barre de progression graphique
 */
function createProgressBar(current, total, length = 20) {
  const percentage = Math.min((current / total) * 100, 100);
  const filledLength = Math.round((percentage / 100) * length);
  const emptyLength = length - filledLength;

  const filled = '🟦'; // Bleu rempli
  const empty = '⬜';  // Blanc vide
  const end = filledLength === length ? '✅' : '🔹';

  return `${filled.repeat(filledLength)}${empty.repeat(emptyLength)} ${end}`;
}

/**
 * ⏰ Formater un temps relatif (ex: "il y a 2 heures")
 */
function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'il y a quelques secondes';
  if (diffMin < 60) return `il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
  if (diffHour < 24) return `il y a ${diffHour} heure${diffHour > 1 ? 's' : ''}`;
  if (diffDay < 7) return `il y a ${diffDay} jour${diffDay > 1 ? 's' : ''}`;
  if (diffWeek < 4) return `il y a ${diffWeek} semaine${diffWeek > 1 ? 's' : ''}`;
  if (diffMonth < 12) return `il y a ${diffMonth} mois`;

  const diffYear = Math.floor(diffMonth / 12);
  return `il y a ${diffYear} an${diffYear > 1 ? 's' : ''}`;
}

/**
 * ⏳ Formater un temps restant (ex: "dans 2 heures")
 */
function formatTimeAgo(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = then - now;

  // Si déjà expiré
  if (diffMs <= 0) return 'Expiré';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  return `${diffDay}j`;
}

/**
 * 🏅 Calculer les badges du joueur
 */
async function calculateBadges(playerId, guildId, themeId) {
  const badges = [];

  try {
    // Récupérer la progression du joueur
    const progress = await db.queryOne(`
      SELECT collected_count, is_completed
      FROM player_progress
      WHERE player_id = $1 AND guild_id = $2 AND theme_id = $3
    `, [playerId, guildId, themeId]);

    if (!progress) {
      return ['🔰']; // Débutant par défaut
    }

    // Récupérer le thème pour calculer le pourcentage
    const theme = await db.queryOne(`
      SELECT required_items FROM themes WHERE id = $1
    `, [themeId]);

    if (!theme) return ['🔰'];

    const percentage = (progress.collected_count / theme.required_items) * 100;

    // Attribution des badges basée sur la progression
    if (percentage === 0) {
      badges.push('🔰'); // Débutant
    } else if (percentage === 100 || progress.is_completed) {
      badges.push('👑'); // Légende - Collection 100%
    } else if (percentage >= 90) {
      badges.push('🏆'); // Maître - 90%+
    } else if (percentage >= 75) {
      badges.push('💫'); // Expert - 75%+
    } else if (percentage >= 50) {
      badges.push('⭐'); // Chasseur - 50%+
    } else {
      badges.push('🎯'); // Collectionneur - Au moins 1 item
    }

    // Badge Perfectionniste - Toutes les collections complètes
    const allCompleted = await db.queryOne(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed
      FROM player_progress
      WHERE player_id = $1 AND guild_id = $2
    `, [playerId, guildId]);

    if (allCompleted && allCompleted.total > 0 && allCompleted.total === parseInt(allCompleted.completed)) {
      badges.push('🌟'); // Perfectionniste
    }

    // Badge Rapide - Collection complète en moins de 7 jours
    if (progress.is_completed && progress.completed_at) {
      const player = await db.queryOne(`
        SELECT created_at FROM players WHERE id = $1
      `, [playerId]);

      if (player) {
        const startDate = new Date(player.created_at);
        const endDate = new Date(progress.completed_at);
        const diffDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));

        if (diffDays <= 7) {
          badges.push('⚡'); // Rapide
        }
      }
    }

    // Badge Chanceux - A obtenu au moins 3 légendaires
    const legendaryCount = await db.queryOne(`
      SELECT COUNT(DISTINCT c.collectible_id) as count
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1
        AND c.guild_id = $2
        AND col.theme_id = $3
        AND col.rarity = 'Légendaire'
    `, [playerId, guildId, themeId]);

    if (legendaryCount && parseInt(legendaryCount.count) >= 3) {
      badges.push('🍀'); // Chanceux
    }

    // Badge Indestructible - A bloqué au moins 10 pièges avec le Bouclier Anti-Piège
    const trapsBlocked = await db.queryOne(`
      SELECT traps_blocked FROM players WHERE id = $1
    `, [playerId]);

    if (trapsBlocked && parseInt(trapsBlocked.traps_blocked) >= 10) {
      badges.push('🛡️'); // Indestructible
    }

    return badges.length > 0 ? badges : ['🔰'];

  } catch (error) {
    console.error('🔴 Erreur calculateBadges:', error);
    return ['🔰'];
  }
}

/**
 * 📦 Obtenir l'emoji de source
 */
function getSourceEmoji(source) {
  const emojis = {
    'mystery_box': '📦',
    'give': '🎁',
    'mission': '🎯',
    'campaign': '📢',
    'bonus': '✨',
    'admin': '👑'
  };
  return emojis[source] || '❓';
}

/**
 * 📊 Formater un grand nombre avec séparateurs
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * 🎨 Obtenir l'emoji de rang
 */
function getRankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank <= 10) return '🏅';
  if (rank <= 50) return '⭐';
  return '🔹';
}

/**
 * 📈 Calculer le taux de réussite aux missions
 */
function calculateSuccessRate(completed, failed) {
  const total = completed + failed;
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * 🎯 Obtenir le statut de progression
 */
function getProgressStatus(percentage) {
  if (percentage === 100) return { emoji: '✅', text: 'COMPLÉTÉ' };
  if (percentage >= 90) return { emoji: '🔥', text: 'PRESQUE FINI' };
  if (percentage >= 75) return { emoji: '💪', text: 'EXCELLENT' };
  if (percentage >= 50) return { emoji: '👍', text: 'BON PROGRÈS' };
  if (percentage >= 30) return { emoji: '📈', text: 'EN COURS' };
  if (percentage >= 10) return { emoji: '🌱', text: 'DÉMARRÉ' };
  return { emoji: '🔰', text: 'DÉBUTANT' };
}

/**
 * 🎨 Obtenir la couleur d'un pourcentage
 */
function getPercentageColor(percentage) {
  if (percentage >= 90) return '#FFD700'; // Or
  if (percentage >= 70) return '#9B59B6'; // Violet
  if (percentage >= 50) return '#3498DB'; // Bleu
  if (percentage >= 30) return '#2ECC71'; // Vert
  return '#E74C3C'; // Rouge
}

/**
 * 📅 Formater une date complète
 */
function formatFullDate(date) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 🔢 Obtenir le suffixe ordinal (1er, 2ème, 3ème...)
 */
function getOrdinalSuffix(num) {
  if (num === 1) return `${num}er`;
  return `${num}ème`;
}

module.exports = {
  getRarityEmoji,
  getRarityColor,
  getDynamicColor,
  createProgressBar,
  formatRelativeTime,
  formatTimeAgo,
  calculateBadges,
  getSourceEmoji,
  formatNumber,
  getRankEmoji,
  calculateSuccessRate,
  getProgressStatus,
  getPercentageColor,
  formatFullDate,
  getOrdinalSuffix
};
