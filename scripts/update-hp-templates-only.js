/**
 * Script pour mettre à jour les templates Harry Potter
 * Simplifié pour éviter le problème de type null
 */

const db = require('../utils/database-pg');

const GUILD_ID = '1182395170273099806';
const THEME_ID = 65;

const HP_TEMPLATES = [
  // Collections
  {
    type: 'legendary_collectible',
    title: '⚡ RELIQUE LÉGENDAIRE DÉCOUVERTE !',
    description: '**{userName}** a découvert une **RELIQUE LÉGENDAIRE** !\n\n🏆 **{collectibleName}**\n\n*"Les Reliques de la Mort choisissent leurs maîtres..."*\n\nQue la magie soit avec toi, jeune sorcier ! ⚡',
    color: '#FFD700',
    footer_text: '⚡ Relique Légendaire • Poudlard'
  },
  {
    type: 'collection_completed',
    title: '🏆 MAÎTRE DES RELIQUES MAGIQUES !',
    description: '**{userName}** a rassemblé toutes les Reliques Magiques ! 🧙‍♂️\n\n*"Le véritable maître de la mort accepte qu\'il doit mourir..."*\n\nTu as maintenant le rôle **{roleName}** ! 👑\n\n⚡ Tu es devenu(e) un(e) véritable Maître des Reliques !',
    color: '#9400D3',
    footer_text: '🏆 Collection Complète • Poudlard'
  },
  {
    type: 'collection_traded',
    title: '🤝 PACTE MAGIQUE SCELLÉ !',
    description: '**{user1Name}** et **{user2Name}** ont scellé un pacte magique !\n\n🪄 Un échange de reliques a été effectué pour la mission **{missionName}**\n\n*"L\'entraide entre sorciers est la plus puissante des magies"*',
    color: '#4169E1',
    footer_text: '🤝 Pacte Magique • Poudlard'
  },
  {
    type: 'collection_lost',
    title: '💀 MALÉFICE DÉVASTATEUR !',
    description: '**{userName}** a été frappé par le maléfice **{trapName}** !\n\n😱 Une relique a été arrachée de ta collection...\n\n*"Même les plus grands sorciers peuvent tomber..."*',
    color: '#8B0000',
    footer_text: '💀 Maléfice • Poudlard'
  },

  // Pièges
  {
    type: 'trap_cooldown',
    title: '⏳ SORTILÈGE DE PÉTRIFICATION !',
    description: '**{userName}** a été touché par **{trapName}** !\n\n🗿 *Petrificus Totalus !*\n\nTu es pétrifié pendant **{duration} minutes**...\n\n*"Le temps guérit toutes les pétrifications..."*',
    color: '#4A4A4A',
    footer_text: '⏳ Sortilège Temporel • Poudlard'
  },
  {
    type: 'trap_lose_collectible',
    title: '🦇 MALÉFICE DE CHAUVE-FURIE !',
    description: '**{userName}** a été attaqué par **{trapName}** !\n\n🦇 Des chauves-furies ont emporté : **{collectible}**\n\n*"Ginny Weasley serait fière de ce sortilège..."*',
    color: '#800080',
    footer_text: '🦇 Maléfice • Poudlard'
  },
  {
    type: 'trap_public_shame',
    title: '📣 BEUGLANTE REÇUE !',
    description: '**{userName}** a reçu une **BEUGLANTE** via **{trapName}** !\n\n📣 *"COMMENT AS-TU OSÉ OUVRIR CE COFFRE ?!"*\n\nTout Poudlard a entendu ta honte ! 😱\n\n*"Molly Weasley approuve ce message..."*',
    color: '#FF4500',
    footer_text: '📣 Beuglante • Poudlard'
  },
  {
    type: 'trap_empty_box',
    title: '👻 COFFRE HANTÉ !',
    description: '**{userName}** a ouvert **{trapName}**...\n\n👻 Peeves le poltergeist avait déjà tout volé !\n\n*"Hahaha ! Pauvre petit sorcier !"* - Peeves\n\n🤷 Au moins, rien n\'a été perdu !',
    color: '#708090',
    footer_text: '👻 Coffre Vide • Poudlard'
  },
  {
    type: 'trap_lose_all_collectibles',
    title: '💀 BAISER DU DÉTRAQUEUR !',
    description: '**{userName}** a subi le terrible **{trapName}** !\n\n💀 **CATASTROPHE !** Toutes tes reliques ont été aspirées...\n\n*"Le Patronus n\'a pas été assez puissant..."*\n\n⚫ Que Merlin te vienne en aide...',
    color: '#000000',
    footer_text: '💀 Détraqueur • Azkaban'
  },

  // Missions
  {
    type: 'mission_word_guessed',
    title: '🔮 SORTILÈGE DEVINÉ !',
    description: '**{userName}** a fait prononcer le mot magique **"{word}"** !\n\n🪄 Mission **{missionName}** accomplie !\n\n*"La ruse est une qualité de Serpentard..."*',
    color: '#2E8B57',
    footer_text: '🔮 Sortilège • Poudlard'
  },
  {
    type: 'mission_started',
    title: '⚔️ QUÊTE MAGIQUE LANCÉE !',
    description: '**{userName}** commence la quête **{missionName}** !\n\n⏱️ **Temps limite:** {timeLimit}\n\n🧙‍♂️ *"Le courage, ce n\'est pas l\'absence de peur..."*\n\nQue la magie guide tes pas !',
    color: '#4169E1',
    footer_text: '⚔️ Quête en Cours • Poudlard'
  },
  {
    type: 'mission_completed',
    title: '✨ QUÊTE MAGIQUE RÉUSSIE !',
    description: '**{userName}** a accompli la quête **{missionName}** !\n\n🎁 **Récompense:** {rewardName}\n\n⭐ *"10 points pour ta maison !"*',
    color: '#32CD32',
    footer_text: '✨ Quête Accomplie • Poudlard'
  },
  {
    type: 'mission_failed',
    title: '❌ QUÊTE ÉCHOUÉE...',
    description: '**{userName}** a échoué la quête **{missionName}**...\n\n⚠️ **Raison:** {failReason}\n\n*"L\'échec est le fondement de la réussite..."* - Dumbledore\n\nN\'abandonne pas, jeune sorcier !',
    color: '#DC143C',
    footer_text: '❌ Échec • Poudlard'
  },
  {
    type: 'mission_approved',
    title: '✅ MISSION VALIDÉE PAR LE MINISTÈRE !',
    description: '**{userName}** a réussi **{missionName}** !\n\n✅ Approuvé par **{adminName}** du Ministère\n🎁 **Récompense:** {rewardName}\n\n*"Le Ministère de la Magie reconnaît ton mérite !"*',
    color: '#228B22',
    footer_text: '✅ Ministère de la Magie'
  },
  {
    type: 'mission_rejected',
    title: '⛔ MISSION REJETÉE PAR LE MINISTÈRE',
    description: '**{userName}**, ta quête **{missionName}** a été rejetée.\n\n⛔ **{adminName}** du Ministère n\'a pas validé ta preuve.\n\n*"Même Hermione a dû recommencer parfois..."*',
    color: '#B22222',
    footer_text: '⛔ Ministère de la Magie'
  },

  // Thèmes
  {
    type: 'theme_expired',
    title: '🌙 FIN DE L\'ANNÉE SCOLAIRE !',
    description: 'Le thème **{themeName}** est terminé après **{durationDays} jours** !\n\n📅 **Fin:** {expirationDate}\n\n🏰 *"Une autre année se termine à Poudlard..."*\n\nMerci à tous les sorciers ! Un nouveau thème arrive ! 🧙‍♂️',
    color: '#4B0082',
    footer_text: '🌙 Fin de Thème • Poudlard'
  },
  {
    type: 'theme_expiring_soon',
    title: '⏰ FIN D\'ANNÉE APPROCHE !',
    description: '**Attention sorciers !** Le thème **{themeName}** expire dans **{daysRemaining} jours** !\n\n📅 **Expiration:** {expirationDate}\n\n🏃 *"Le Poudlard Express part bientôt..."*\n\nDépêchez-vous de compléter vos collections !',
    color: '#FF8C00',
    footer_text: '⏰ Rappel • Poudlard'
  },

  // Super Bonus
  {
    type: 'legendary_super_bonus',
    title: '⚡ POUVOIR MAGIQUE LÉGENDAIRE !',
    description: '**{userName}** a obtenu un **POUVOIR MAGIQUE LÉGENDAIRE** !\n\n{bonusIcon} **{bonusName}**\n\n✨ *"Tu as été choisi par la magie elle-même..."*\n\nUtilise ce pouvoir avec sagesse !',
    color: '#FFD700',
    footer_text: '⚡ Pouvoir Légendaire • Poudlard'
  },
  {
    type: 'super_bonus_joker_used',
    title: '🃏 FELIX FELICIS ACTIVÉ !',
    description: '╔═══════════════════════════════════════╗\n║  ⚗️ **POTION DE CHANCE UTILISÉE** ⚗️  ║\n╚═══════════════════════════════════════╝\n\n**{userName}** a bu le **Felix Felicis** !\n\n🎁 Relique choisie:\n╭─────────────────────────╮\n│  ✨ **{collectibleName}**\n│  📊 Rareté: **{collectibleRarity}**\n╰─────────────────────────╯\n\n*"La chance est de ton côté aujourd\'hui..."*',
    color: '#FFD700',
    footer_text: '🃏 Felix Felicis • Potion Légendaire'
  }
];

// Mise à jour notifications pièges existants
const HP_TRAP_NOTIFICATIONS = [
  {
    name: 'Maléfice de Chauve-Furie',
    notif_title: '🦇 MALÉFICE DE CHAUVE-FURIE !',
    notif_description: 'Des chauves-furies magiques t\'attaquent ! Une de tes reliques a été emportée dans la tourmente !',
    notif_color: '#800080'
  },
  {
    name: 'Baiser du Détraqueur',
    notif_title: '💀 BAISER DU DÉTRAQUEUR !',
    notif_description: 'Un Détraqueur t\'a trouvé ! Tu es paralysé par la peur et le froid...',
    notif_color: '#1a1a2e'
  },
  {
    name: 'Sortilège d\'Oubliettes',
    notif_title: '🧠 SORTILÈGE D\'OUBLIETTES !',
    notif_description: 'Obliviate ! Tu as tout oublié pendant un moment... Où suis-je déjà ?',
    notif_color: '#6A5ACD'
  },
  {
    name: 'Petrificus Totalus',
    notif_title: '🗿 PETRIFICUS TOTALUS !',
    notif_description: 'Tu es complètement pétrifié ! Le coffre était un piège... et il était vide !',
    notif_color: '#4A4A4A'
  },
  {
    name: 'Avada Kedavra',
    notif_title: '💀 AVADA KEDAVRA !',
    notif_description: 'Le sortilège de mort a frappé ta collection ! Toutes tes reliques ont été détruites...',
    notif_color: '#00FF00'
  },
  {
    name: 'Beuglante de Molly',
    notif_title: '📣 BEUGLANTE REÇUE !',
    notif_description: 'Une enveloppe rouge explose ! Tout Poudlard entend tes erreurs !',
    notif_color: '#FF4500'
  },
  {
    name: 'Retenue avec Rogue',
    notif_title: '🧪 RETENUE AVEC ROGUE !',
    notif_description: '"Vous êtes exactement comme votre père, arrogant !" - 5 points retirés de votre maison.',
    notif_color: '#2F4F4F'
  }
];

async function main() {
  console.log('\n' + '█'.repeat(70));
  console.log('🧙 MISE À JOUR TEMPLATES HARRY POTTER');
  console.log('█'.repeat(70));

  try {
    // 1. Mettre à jour les templates (sans image_url pour éviter le problème)
    console.log('\n📢 1. Mise à jour des templates d\'annonces...');
    let templatesUpdated = 0;

    for (const template of HP_TEMPLATES) {
      try {
        const result = await db.query(`
          UPDATE announcement_templates
          SET title = $1, description = $2, color = $3, footer_text = $4
          WHERE guild_id = $5 AND theme_id = $6 AND type = $7
        `, [
          template.title,
          template.description,
          template.color,
          template.footer_text,
          GUILD_ID,
          THEME_ID,
          template.type
        ]);

        if (result && result.rowCount > 0) {
          templatesUpdated++;
          console.log(`   ✅ ${template.type}`);
        } else {
          console.log(`   ⚠️  ${template.type} - non trouvé`);
        }
      } catch (error) {
        console.error(`   ❌ ${template.type}: ${error.message}`);
      }
    }

    console.log(`\n📊 ${templatesUpdated}/${HP_TEMPLATES.length} templates mis à jour`);

    // 2. Mettre à jour les notifications des pièges
    console.log('\n🪤 2. Mise à jour des notifications pièges...');
    let trapsUpdated = 0;

    for (const trap of HP_TRAP_NOTIFICATIONS) {
      try {
        const result = await db.query(`
          UPDATE traps
          SET notif_title = $1, notif_description = $2, notif_color = $3
          WHERE guild_id = $4 AND theme_id = $5 AND name = $6
        `, [
          trap.notif_title,
          trap.notif_description,
          trap.notif_color,
          GUILD_ID,
          THEME_ID,
          trap.name
        ]);

        if (result && result.rowCount > 0) {
          trapsUpdated++;
          console.log(`   ✅ ${trap.name}`);
        } else {
          console.log(`   ⚠️  ${trap.name} - non trouvé`);
        }
      } catch (error) {
        console.error(`   ❌ ${trap.name}: ${error.message}`);
      }
    }

    console.log(`\n📊 ${trapsUpdated}/${HP_TRAP_NOTIFICATIONS.length} pièges mis à jour`);

    // 3. Résumé final
    console.log('\n' + '█'.repeat(70));
    console.log('✅ MISE À JOUR TERMINÉE !');
    console.log('█'.repeat(70));
    console.log('\n📋 RÉSUMÉ:');
    console.log(`   ✅ ${templatesUpdated} templates d'annonces personnalisés HP`);
    console.log(`   ✅ ${trapsUpdated} pièges avec notifications HP`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

main();
