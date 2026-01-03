/**
 * Corriger les variables des templates d'annonces du serveur de production
 * Remplace les anciens noms de variables par les nouveaux
 */
const db = require('../utils/database-pg');

const PRODUCTION_GUILD_ID = '297309737135898624';

// Mapping des variables à remplacer
const VARIABLE_REPLACEMENTS = {
  '{player}': '{userName}',
  '{user}': '{userName}',
  '{mission_name}': '{missionName}',
  '{trap_name}': '{trapName}',
  '{reward}': '{rewardName}',
  '{reveal_message}': '', // Supprimer car pas utilisé
  '{item}': '{collectibleName}',
  '{role}': '{roleName}',
  '{days}': '{daysRemaining}',
  '{items_collected}': '', // Supprimer
  '{items_required}': '', // Supprimer
  '{rarity}': '', // Supprimer
  '{progress}': '' // Supprimer
};

// Templates corrects à utiliser (depuis announcementTemplates.js)
const CORRECT_TEMPLATES = [
  {
    type: 'legendary_collectible',
    title: '🌟 Collectible Légendaire Trouvé !',
    description: '**{userName}** vient de trouver un collectible **LÉGENDAIRE** !\n\n✨ **{collectibleName}**\n\n🎉 Félicitations pour cette trouvaille exceptionnelle !',
    color: '#ffd700',
    footer_text: 'Collection Légendaire'
  },
  {
    type: 'collection_completed',
    title: '🏆 Collection Complétée !',
    description: '**{userName}** a complété la collection **{themeName}** !\n\n🎖️ **Nouveau rôle débloqué:** {roleName}\n\n👏 Bravo pour cette réussite !',
    color: '#00ff00',
    footer_text: 'Collection Complète'
  },
  {
    type: 'collection_traded',
    title: '🔄 Échange de Collection',
    description: '**{user1Name}** et **{user2Name}** ont échangé des collectibles de la mission **{missionName}** !\n\n🤝 Belle collaboration !',
    color: '#3498db',
    footer_text: 'Système d\'Échanges'
  },
  {
    type: 'mission_word_guessed',
    title: '🎯 Mot-Clé Trouvé !',
    description: '**{userName}** a trouvé le mot-clé **{word}** de la mission **{missionName}** !\n\n💡 Bravo pour cette découverte !',
    color: '#9b59b6',
    footer_text: 'Missions'
  },
  {
    type: 'mission_started',
    title: '🎯 Mission Commencée !',
    description: '**{userName}** a commencé une nouvelle mission !\n\n📋 **Mission:** {missionName}\n⏱️ **Temps limite:** {timeLimit}\n\n💪 Bonne chance !',
    color: '#3498db',
    footer_text: 'Système de Missions'
  },
  {
    type: 'mission_completed',
    title: '✅ Mission Réussie !',
    description: '**{userName}** a terminé une mission !\n\n📋 **Mission:** {missionName}\n🎁 **Récompense:** {rewardName}\n\n🎉 Félicitations !',
    color: '#2ecc71',
    footer_text: 'Système de Missions'
  },
  {
    type: 'mission_failed',
    title: '❌ Mission Échouée',
    description: '**{userName}** n\'a pas pu terminer la mission à temps\n\n📋 **Mission:** {missionName}\n⚠️ **Raison:** {failReason}\n\n💡 Réessaye une prochaine fois !',
    color: '#e74c3c',
    footer_text: 'Système de Missions'
  },
  {
    type: 'mission_approved',
    title: '✅ Mission Approuvée !',
    description: '**{userName}** a vu sa mission approuvée par un admin !\n\n📋 **Mission:** {missionName}\n👤 **Approuvée par:** {adminName}\n🎁 **Récompense:** {rewardName}\n\n🎉 Félicitations !',
    color: '#27ae60',
    footer_text: 'Système de Missions'
  },
  {
    type: 'mission_rejected',
    title: '❌ Mission Rejetée',
    description: '**{userName}** a vu sa mission rejetée\n\n📋 **Mission:** {missionName}\n👤 **Rejetée par:** {adminName}\n\n💡 Vérifie les critères et réessaye !',
    color: '#c0392b',
    footer_text: 'Système de Missions'
  },
  {
    type: 'trap_cooldown',
    title: '⏱️ Piège de Cooldown Déclenché !',
    description: '**{userName}** est tombé dans un piège !\n\n🎯 **Piège:** {trapName}\n⏱️ **Effet:** Cooldown de **{cooldownMinutes} minutes**\n\n💡 Il ne pourra pas ouvrir de boîtes mystère pendant un moment...',
    color: '#f39c12',
    footer_text: 'Système de Pièges'
  },
  {
    type: 'trap_lose_collectible',
    title: '💀 Piège Voleur Activé !',
    description: '**{userName}** a perdu un collectible !\n\n🎯 **Piège:** {trapName}\n🎁 **Objet perdu:** {collectibleLost}\n\n⚠️ Un piège vicieux lui a volé un objet de sa collection !',
    color: '#e74c3c',
    footer_text: 'Système de Pièges'
  },
  {
    type: 'trap_public_shame',
    title: '😱 Piège de la Honte !',
    description: '**{userName}** est tombé dans le piège de la honte !\n\n🎯 **Piège:** {trapName}\n\n🤡 {shameMessage}',
    color: '#9b59b6',
    footer_text: 'Système de Pièges'
  },
  {
    type: 'trap_empty_box',
    title: '📦 Coffre Vide !',
    description: '**{userName}** a ouvert un coffre vide !\n\n🎯 **Piège:** {trapName}\n📭 **Effet:** Pas de récompense cette fois...\n\n💡 Pas de chance, réessaye !',
    color: '#95a5a6',
    footer_text: 'Système de Pièges'
  },
  {
    type: 'trap_lose_all_collectibles',
    title: '☠️ Piège Dévastateur !',
    description: '**{userName}** a tout perdu !\n\n🎯 **Piège:** {trapName}\n💀 **Effet:** Tous les collectibles ont été perdus !\n\n⚠️ Un piège terrible a vidé toute la collection...',
    color: '#c0392b',
    footer_text: 'Système de Pièges'
  },
  {
    type: 'collection_lost',
    title: '😱 Collection Perdue !',
    description: '**{userName}** a perdu un objet à cause d\'un piège !\n\n🎯 **Piège:** {trapName}\n\n⚠️ Fais attention la prochaine fois !',
    color: '#e74c3c',
    footer_text: 'Système de Pièges'
  },
  {
    type: 'theme_expired',
    title: '🔴 THÈME EXPIRÉ !',
    description: 'Le thème **{themeName}** a expiré après **{durationDays} jours** !\n\n📅 **Date d\'expiration:** {expirationDate}\n\n⚠️ Contactez un admin pour activer un nouveau thème.',
    color: '#e74c3c',
    footer_text: 'Système de Thèmes'
  },
  {
    type: 'theme_expiring_soon',
    title: '⏰ THÈME EXPIRE BIENTÔT !',
    description: 'Le thème **{themeName}** expire dans **{daysRemaining} jour(s)** !\n\n📅 **Date d\'expiration:** {expirationDate}\n\n💡 Dépêchez-vous de compléter votre collection !',
    color: '#f39c12',
    footer_text: 'Système de Thèmes'
  }
];

async function fix() {
  try {
    console.log('🔧 CORRECTION DES TEMPLATES PRODUCTION\n');
    console.log('='.repeat(80));
    console.log(`\nServeur: ${PRODUCTION_GUILD_ID}\n`);

    let updatedCount = 0;

    for (const template of CORRECT_TEMPLATES) {
      console.log(`\n📝 ${template.type}...`);

      // Utiliser UPSERT (INSERT ... ON CONFLICT UPDATE)
      await db.query(`
        INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (guild_id, type)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          color = EXCLUDED.color,
          footer_text = EXCLUDED.footer_text
      `, [PRODUCTION_GUILD_ID, template.type, template.title, template.description, template.color, template.footer_text]);

      console.log(`   ✅ Mis à jour`);
      updatedCount++;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ ${updatedCount} templates corrigés/créés`);
    console.log('\nLes annonces devraient maintenant fonctionner correctement !');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fix();
