/**
 * Personnalisation des templates d'annonces pour les thèmes
 * - Calendrier de Noël (id 47)
 * - Poulaillier Friends (id 68)
 */
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

// ═══════════════════════════════════════════════════════════════════
// 🎄 CALENDRIER DE NOËL - Templates festifs et drôles
// ═══════════════════════════════════════════════════════════════════
const NOEL_TEMPLATES = [
  {
    type: 'legendary_collectible',
    title: '🌟 CADEAU LÉGENDAIRE DU PÈRE NOËL ! 🎅',
    description: '```\n🎄 HO HO HOOOO ! 🎄\n```\n\n**{userName}** a trouvé un cadeau **LÉGENDAIRE** sous le sapin !\n\n🎁 **{collectibleName}**\n\n*Le Père Noël a dû se tromper de cheminée... tant mieux pour toi !* 🎅✨',
    color: '#c41e3a',
    footer_text: '🎄 Joyeux Noël ! Le Père Noël approuve ce message'
  },
  {
    type: 'collection_completed',
    title: '🎄✨ LISTE DE NOËL COMPLÉTÉE ! ✨🎄',
    description: '```\n🌟 MIRACLE DE NOËL ! 🌟\n```\n\n**{userName}** a complété sa liste au Père Noël !\n\n🎁 Collection **{themeName}** terminée !\n\n👑 Tu obtiens le rôle **{roleName}** !\n\n*Tu as été très sage cette année... ou tu as soudoyé les lutins !* 🧝‍♂️',
    color: '#228b22',
    footer_text: '🎅 Le Père Noël est fier de toi !'
  },
  {
    type: 'trap_cooldown',
    title: '❄️ GELÉ PAR LE FROID DE L\'HIVER ! ❄️',
    description: '```\n🥶 BRRRRRR ! 🥶\n```\n\n**{userName}** est tombé dans **{trapName}** !\n\n❄️ Tu es gelé pendant **{duration} minutes** !\n\n*T\'aurais dû mettre ton bonnet... Même les rennes se moquent de toi !* 🦌😂',
    color: '#00bfff',
    footer_text: '❄️ Conseil : La prochaine fois, apporte du chocolat chaud'
  },
  {
    type: 'trap_lose_collectible',
    title: '🎅 LE GRINCH T\'A VOLÉ UN CADEAU ! 💚',
    description: '```\n😱 OH NON ! 😱\n```\n\n**{userName}** s\'est fait piéger par **{trapName}** !\n\n💔 Tu as perdu : **{collectible}**\n\n*Le Grinch ricane dans sa montagne... "Vous êtes sur MA liste des vilains !"* 💚',
    color: '#228b22',
    footer_text: '💚 Le Grinch : "Le Noël c\'est TERMINÉ !"'
  },
  {
    type: 'trap_lose_all_collectibles',
    title: '💀 CATASTROPHE AU PÔLE NORD ! 💀',
    description: '```\n🔥 LE TRAINEAU A PRIS FEU ! 🔥\n```\n\n**{userName}** a déclenché **{trapName}** !\n\n😱 **TOUS TES CADEAUX ONT BRÛLÉ !**\n\n*Rudolph a trébuché sur une bougie... Merci Rudolph.* 🦌🔥',
    color: '#8b0000',
    footer_text: '🦌 Rudolph : "Oups, c\'était pas mon meilleur vol..."'
  },
  {
    type: 'trap_empty_box',
    title: '📦 BOÎTE VIDE SOUS LE SAPIN ! 📦',
    description: '```\n🤷 SURPRISE... OU PAS ! 🤷\n```\n\n**{userName}** a ouvert **{trapName}**...\n\n🎁 Il n\'y avait RIEN dedans ! Juste de l\'air de Noël.\n\n*Quelqu\'un a mangé les chocolats et laissé la boîte vide. Sûrement les lutins.* 🧝‍♂️🍫',
    color: '#808080',
    footer_text: '🧝 Les lutins : "On ne voit pas de quoi tu parles..."'
  },
  {
    type: 'trap_public_shame',
    title: '📜 SUR LA LISTE DES VILAINS ! 📜',
    description: '```\n😈 NAUGHTY LIST ! 😈\n```\n\n**{userName}** a été piégé par **{trapName}** !\n\n📋 Tu es maintenant sur la **LISTE DES VILAINS** du Père Noël !\n\n*Tout le serveur peut voir ton échec... Joyeux Noël quand même !* 🎄😂',
    color: '#8b0000',
    footer_text: '🎅 Le Père Noël : "Pas de biscuits pour toi cette année !"'
  },
  {
    type: 'mission_started',
    title: '🎄 MISSION DE NOËL LANCÉE ! 🎄',
    description: '```\n🧝 LES LUTINS ONT BESOIN DE TOI ! 🧝\n```\n\n**{userName}** a accepté la mission **{missionName}** !\n\n⏱️ **Temps limite:** {timeLimit}\n\n*Le Père Noël compte sur toi ! Ne le déçois pas ou tu auras du charbon !* 🪨',
    color: '#228b22',
    footer_text: '🎅 "Ho ho ho ! Bonne chance mon enfant !"'
  },
  {
    type: 'mission_completed',
    title: '⭐ MISSION DE NOËL RÉUSSIE ! ⭐',
    description: '```\n🎉 HOURRA ! 🎉\n```\n\n**{userName}** a complété **{missionName}** !\n\n🎁 **Récompense:** {rewardName}\n\n*Les lutins applaudissent ! Le Père Noël fait une danse de la joie !* 🎅💃',
    color: '#ffd700',
    footer_text: '🧝 Les lutins : "YAYYY ! On peut enfin dormir !"'
  },
  {
    type: 'mission_failed',
    title: '❌ OH NON ! MISSION DE NOËL ÉCHOUÉE ! ❌',
    description: '```\n😢 LE PÈRE NOËL EST TRISTE... 😢\n```\n\n**{userName}** a échoué **{missionName}** !\n\n⚠️ **Raison:** {failReason}\n\n*Rudolph te regarde avec déception... Mais bon, il y aura d\'autres Noëls !* 🦌',
    color: '#c41e3a',
    footer_text: '🎅 "C\'est pas grave, l\'important c\'est de participer... enfin presque"'
  },
  {
    type: 'mission_word_guessed',
    title: '🎯 MOT DE NOËL DEVINÉ ! 🎯',
    description: '```\n🌟 MAGIE DE NOËL ! 🌟\n```\n\n**{userName}** a fait dire le mot secret **"{word}"** !\n\nMission **{missionName}** réussie !\n\n*Plus rusé qu\'un lutin qui cache les cadeaux !* 🧝‍♂️✨',
    color: '#ffd700',
    footer_text: '🧝 "Il est doué celui-là !"'
  },
  {
    type: 'legendary_super_bonus',
    title: '🎰 SUPER BONUS DE NOËL ! 🎅',
    description: '```\n✨ MIRACLE ! ✨\n```\n\n**{userName}** a obtenu un **SUPER BONUS** du calendrier de l\'avent !\n\n{bonusIcon} **{bonusName}**\n\n*Le Père Noël a glissé un cadeau spécial dans ta chaussette !* 🧦✨',
    color: '#ff00ff',
    footer_text: '🎄 "Le plus beau cadeau de Noël !"'
  },
  {
    type: 'super_bonus_joker_used',
    title: '🃏🎄 JOKER DE NOËL UTILISÉ ! 🎄🃏',
    description: '```\n🌟 VŒEU DE NOËL EXAUCÉ ! 🌟\n```\n\n**{userName}** a utilisé son **MysteryBox Joker** !\n\n🎁 Cadeau choisi:\n╭─────────────────────────╮\n│  ✨ **{collectibleName}**\n│  📊 Rareté: **{collectibleRarity}**\n╰─────────────────────────╯\n\n*Comme par magie de Noël, ton vœu a été exaucé !* ⭐',
    color: '#FFD700',
    footer_text: '🎅 "Ho ho ho ! Joyeux Noël !"'
  }
];

// ═══════════════════════════════════════════════════════════════════
// 🐔 POULAILLIER FRIENDS - Templates à base de poules et coqs !
// ═══════════════════════════════════════════════════════════════════
const POULAILLER_TEMPLATES = [
  {
    type: 'legendary_collectible',
    title: '🥚✨ ŒUF D\'OR LÉGENDAIRE ! ✨🥚',
    description: '```\n🐔 COT COT COOOOOT ! 🐔\n```\n\n**{userName}** a trouvé un collectible **LÉGENDAIRE** dans le poulailler !\n\n🥚 **{collectibleName}**\n\n*La poule qui a pondu ça mérite une médaille ! C\'est du jamais vu dans la basse-cour !* 🏆🐓',
    color: '#ffd700',
    footer_text: '🐔 La poule : "Je suis pas payée assez pour ça..."'
  },
  {
    type: 'collection_completed',
    title: '🐓🎉 COLLECTION DU POULAILLER COMPLÈTE ! 🎉🐓',
    description: '```\n👑 LE ROI DU POULAILLER ! 👑\n```\n\n**{userName}** a ramassé tous les œufs du **{themeName}** !\n\n🐔 Tu obtiens le rôle **{roleName}** !\n\n*Les poules te reconnaissent comme leur maître ! Le coq est jaloux.* 🐓😤',
    color: '#ff6b35',
    footer_text: '🐓 Le coq Maurice : "Pff, j\'aurais pu faire pareil..."'
  },
  {
    type: 'trap_cooldown',
    title: '💩 TU AS MARCHÉ DANS LA FIENTE ! 💩',
    description: '```\n🤢 BEURK BEURK BEURK ! 🤢\n```\n\n**{userName}** est tombé dans **{trapName}** !\n\n👟 Tu dois nettoyer pendant **{duration} minutes** !\n\n*Fais gaffe où tu marches dans le poulailler ! Les poules rigolent de toi.* 🐔😂',
    color: '#8b4513',
    footer_text: '🐔 Les poules : "HAHAHAHA ! IL A MARCHÉ DEDANS !"'
  },
  {
    type: 'trap_lose_collectible',
    title: '🦊 LE RENARD A VOLÉ TON ŒUF ! 🦊',
    description: '```\n😱 ALERTE RENARD ! 😱\n```\n\n**{userName}** s\'est fait avoir par **{trapName}** !\n\n🥚 Tu as perdu : **{collectible}**\n\n*Le renard s\'enfuit en ricanant... Les poules crient au scandale !* 🐔🗣️',
    color: '#d35400',
    footer_text: '🦊 Le renard : "Merci pour le dîner !"'
  },
  {
    type: 'trap_lose_all_collectibles',
    title: '🌪️ TEMPÊTE DANS LE POULAILLER ! 🌪️',
    description: '```\n💀 CATASTROPHE AVIAIRE ! 💀\n```\n\n**{userName}** a déclenché **{trapName}** !\n\n🥚💨 **TOUS TES ŒUFS SE SONT ENVOLÉS !**\n\n*Une tornade a traversé le poulailler... même le coq s\'est envolé !* 🐓💨',
    color: '#2c3e50',
    footer_text: '🐓 Le coq (au loin) : "COOOOOOT COOOOOOOOT !"'
  },
  {
    type: 'trap_empty_box',
    title: '🥚 ŒUF VIDE... COMME TA CHANCE ! 🥚',
    description: '```\n😐 COUAC... 😐\n```\n\n**{userName}** a trouvé **{trapName}**...\n\n🐣 L\'œuf était vide ! Le poussin s\'est déjà barré.\n\n*"Y\'a plus rien à voir ici, circulez !" disent les poules.* 🐔',
    color: '#bdc3c7',
    footer_text: '🐣 Le poussin (parti) : "Ciao les losers !"'
  },
  {
    type: 'trap_public_shame',
    title: '🐔 HONTE AU POULAILLER ! 🐔',
    description: '```\n😳 TOUT LE MONDE A VU ! 😳\n```\n\n**{userName}** s\'est fait piéger par **{trapName}** !\n\n📢 Toutes les poules du serveur caquètent sur ton échec !\n\n*COT COT COT ! (traduction : "LOL IL S\'EST FAIT AVOIR !")* 🐔🗣️',
    color: '#e74c3c',
    footer_text: '🐔 Conseil des poules : "On va en parler pendant des semaines"'
  },
  {
    type: 'mission_started',
    title: '🥚 MISSION AU POULAILLER LANCÉE ! 🥚',
    description: '```\n🐓 COCORICO ! 🐓\n```\n\n**{userName}** part ramasser les œufs !\n\nMission **{missionName}** commencée !\n\n⏱️ **Temps limite:** {timeLimit}\n\n*Les poules te regardent... fais pas de bêtises !* 🐔👀',
    color: '#27ae60',
    footer_text: '🐓 Le coq Maurice : "Je te surveille, petit..."'
  },
  {
    type: 'mission_completed',
    title: '🐔✨ MISSION PONDUE AVEC SUCCÈS ! ✨🐔',
    description: '```\n🎉 BRAVO FERMIER ! 🎉\n```\n\n**{userName}** a réussi **{missionName}** !\n\n🥚 **Récompense:** {rewardName}\n\n*Les poules applaudissent avec leurs ailes ! (Ça ressemble à du bruit de poulailler)* 🐔👏',
    color: '#f1c40f',
    footer_text: '🐔 "Tu es le meilleur ramasseur d\'œufs qu\'on ait jamais eu !"'
  },
  {
    type: 'mission_failed',
    title: '💔 MISSION ÉCRABOUILLÉE ! 💔',
    description: '```\n🍳 OUPS... OMELETTE ! 🍳\n```\n\n**{userName}** a échoué **{missionName}** !\n\n⚠️ **Raison:** {failReason}\n\n*T\'as cassé tous les œufs ! Le coq te fait les gros yeux.* 🐓😠',
    color: '#c0392b',
    footer_text: '🐓 Maurice : "T\'es viré de la ferme... temporairement."'
  },
  {
    type: 'mission_word_guessed',
    title: '🐔 COT COT ! MOT DEVINÉ ! 🐔',
    description: '```\n🧠 POULE INTELLIGENTE ! 🧠\n```\n\n**{userName}** a fait dire **"{word}"** !\n\nMission **{missionName}** accomplie !\n\n*Plus malin qu\'une poule qui compte ses œufs !* 🐔🧮',
    color: '#9b59b6',
    footer_text: '🐔 "Il parle le poulet couramment !"'
  },
  {
    type: 'legendary_super_bonus',
    title: '🥚🌟 SUPER BONUS DU POULAILLER ! 🌟🥚',
    description: '```\n✨ ŒUF MAGIQUE ! ✨\n```\n\n**{userName}** a trouvé un **SUPER BONUS** dans le nid !\n\n{bonusIcon} **{bonusName}**\n\n*Les poules n\'en reviennent pas ! C\'est l\'œuf du siècle !* 🐔🤯',
    color: '#ff00ff',
    footer_text: '🐓 Maurice : "Même moi je suis impressionné..."'
  },
  {
    type: 'super_bonus_joker_used',
    title: '🃏🐔 JOKER DU POULAILLER UTILISÉ ! 🐔🃏',
    description: '```\n🌟 ŒUF SURPRISE OUVERT ! 🌟\n```\n\n**{userName}** a utilisé son **MysteryBox Joker** !\n\n🥚 Œuf choisi:\n╭─────────────────────────╮\n│  ✨ **{collectibleName}**\n│  📊 Rareté: **{collectibleRarity}**\n╰─────────────────────────╯\n\n*La poule dorée a pondu spécialement pour toi !* 🐔✨',
    color: '#FFD700',
    footer_text: '🐔 La poule dorée : "C\'était mon meilleur œuf !"'
  }
];

async function personalizeTemplates() {
  console.log('\n🎨 PERSONNALISATION DES TEMPLATES D\'ANNONCES\n');
  console.log('='.repeat(70));

  try {
    // ═══════════════════════════════════════════════════════════════════
    // 🎄 MISE À JOUR CALENDRIER DE NOËL (theme_id = 47)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n🎄 1. CALENDRIER DE NOËL (theme_id = 47)');
    console.log('─'.repeat(50));

    let noelUpdated = 0;
    for (const template of NOEL_TEMPLATES) {
      await db.query(`
        UPDATE announcement_templates
        SET title = $1, description = $2, color = $3, footer_text = $4, updated_at = NOW()
        WHERE guild_id = $5 AND type = $6 AND theme_id = 47
      `, [template.title, template.description, template.color, template.footer_text, GUILD_ID, template.type]);
      noelUpdated++;
      console.log(`   ✅ ${template.type}`);
    }
    console.log(`\n   Total: ${noelUpdated} templates mis à jour pour Noël 🎄`);

    // ═══════════════════════════════════════════════════════════════════
    // 🐔 CRÉATION + MISE À JOUR POULAILLIER FRIENDS (theme_id = 68)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n🐔 2. POULAILLIER FRIENDS (theme_id = 68)');
    console.log('─'.repeat(50));

    // D'abord créer les templates s'ils n'existent pas
    const { createDefaultTemplatesForTheme } = require('../utils/announcementDefaults');
    await createDefaultTemplatesForTheme(GUILD_ID, 68);

    let poulaillerUpdated = 0;
    for (const template of POULAILLER_TEMPLATES) {
      await db.query(`
        UPDATE announcement_templates
        SET title = $1, description = $2, color = $3, footer_text = $4, updated_at = NOW()
        WHERE guild_id = $5 AND type = $6 AND theme_id = 68
      `, [template.title, template.description, template.color, template.footer_text, GUILD_ID, template.type]);
      poulaillerUpdated++;
      console.log(`   ✅ ${template.type}`);
    }
    console.log(`\n   Total: ${poulaillerUpdated} templates mis à jour pour Poulaillier 🐔`);

    // ═══════════════════════════════════════════════════════════════════
    // 📊 VÉRIFICATION FINALE
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n📊 3. VÉRIFICATION FINALE');
    console.log('─'.repeat(50));

    const counts = await db.queryAll(`
      SELECT
        theme_id,
        COUNT(*) as count,
        (SELECT name FROM themes WHERE id = announcement_templates.theme_id) as theme_name
      FROM announcement_templates
      WHERE guild_id = $1 AND theme_id IS NOT NULL
      GROUP BY theme_id
      ORDER BY theme_id
    `, [GUILD_ID]);
    console.table(counts);

    // Exemples de templates personnalisés
    console.log('\n🎄 Exemple template Noël (trap_cooldown):');
    const noelExample = await db.queryOne(`
      SELECT title, LEFT(description, 100) as description_preview
      FROM announcement_templates
      WHERE guild_id = $1 AND theme_id = 47 AND type = 'trap_cooldown'
    `, [GUILD_ID]);
    if (noelExample) {
      console.log(`   Titre: ${noelExample.title}`);
      console.log(`   Description: ${noelExample.description_preview}...`);
    }

    console.log('\n🐔 Exemple template Poulaillier (trap_cooldown):');
    const poulaillerExample = await db.queryOne(`
      SELECT title, LEFT(description, 100) as description_preview
      FROM announcement_templates
      WHERE guild_id = $1 AND theme_id = 68 AND type = 'trap_cooldown'
    `, [GUILD_ID]);
    if (poulaillerExample) {
      console.log(`   Titre: ${poulaillerExample.title}`);
      console.log(`   Description: ${poulaillerExample.description_preview}...`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ PERSONNALISATION TERMINÉE !');
    console.log('\n🎁 SURPRISE ! Les propriétaires vont adorer ces templates !');
    console.log('   🎄 Noël: Messages festifs avec le Père Noël, les lutins, Rudolph...');
    console.log('   🐔 Poulaillier: Messages drôles avec poules, coq Maurice, renard...');
    console.log('\n');
    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

personalizeTemplates();
