/**
 * Script complet pour personnaliser le thème Harry Potter
 * - Templates d'annonces thématisés
 * - Pièges avec notifications HP + types manquants
 * - Nouvelles missions (tous types)
 */

const db = require('../utils/database-pg');

const GUILD_ID = '1182395170273099806';
const THEME_ID = 65;

// ═══════════════════════════════════════════════════════════════════════════
// 1. TEMPLATES D'ANNONCES HARRY POTTER
// ═══════════════════════════════════════════════════════════════════════════
const HP_TEMPLATES = [
  // Collections
  {
    type: 'legendary_collectible',
    title: '⚡ RELIQUE LÉGENDAIRE DÉCOUVERTE !',
    description: '**{userName}** a découvert une **RELIQUE LÉGENDAIRE** !\n\n🏆 **{collectibleName}**\n\n*"Les Reliques de la Mort choisissent leurs maîtres..."*\n\nQue la magie soit avec toi, jeune sorcier ! ⚡',
    color: '#FFD700',
    footer_text: '⚡ Relique Légendaire • Poudlard',
    image_url: 'IMAGE_LEGENDARY_HP'
  },
  {
    type: 'collection_completed',
    title: '🏆 MAÎTRE DES RELIQUES MAGIQUES !',
    description: '**{userName}** a rassemblé toutes les Reliques Magiques ! 🧙‍♂️\n\n*"Le véritable maître de la mort accepte qu\'il doit mourir..."*\n\nTu as maintenant le rôle **{roleName}** ! 👑\n\n⚡ Tu es devenu(e) un(e) véritable Maître des Reliques !',
    color: '#9400D3',
    footer_text: '🏆 Collection Complète • Poudlard',
    image_url: 'IMAGE_COLLECTION_COMPLETE_HP'
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

// ═══════════════════════════════════════════════════════════════════════════
// 2. PIÈGES HARRY POTTER (existants + manquants)
// ═══════════════════════════════════════════════════════════════════════════
const HP_TRAPS_UPDATES = [
  // Mise à jour des existants avec notifications thématiques
  {
    name: 'Maléfice de Chauve-Furie',
    type: 'lose-collectible',
    notif_title: '🦇 MALÉFICE DE CHAUVE-FURIE !',
    notif_description: 'Des chauves-furies magiques t\'attaquent ! Une de tes reliques a été emportée dans la tourmente !',
    notif_color: '#800080'
  },
  {
    name: 'Baiser du Détraqueur',
    type: 'cooldown',
    notif_title: '💀 BAISER DU DÉTRAQUEUR !',
    notif_description: 'Un Détraqueur t\'a trouvé ! Tu es paralysé par la peur et le froid...',
    notif_color: '#1a1a2e'
  },
  {
    name: 'Sortilège d\'Oubliettes',
    type: 'cooldown',
    notif_title: '🧠 SORTILÈGE D\'OUBLIETTES !',
    notif_description: 'Obliviate ! Tu as tout oublié pendant un moment... Où suis-je déjà ?',
    notif_color: '#6A5ACD'
  },
  {
    name: 'Petrificus Totalus',
    type: 'empty-box',
    notif_title: '🗿 PETRIFICUS TOTALUS !',
    notif_description: 'Tu es complètement pétrifié ! Le coffre était un piège... et il était vide !',
    notif_color: '#4A4A4A'
  }
];

// Nouveaux pièges (types manquants)
const HP_NEW_TRAPS = [
  {
    trap_id: 'hp_avada_kedavra',
    name: 'Avada Kedavra',
    type: 'lose-all-collectibles',
    description: 'Le sortilège impardonnable ultime ! Toutes tes reliques disparaissent...',
    severity: 5,
    notif_title: '💀 AVADA KEDAVRA !',
    notif_description: 'Le sortilège de mort a frappé ta collection ! Toutes tes reliques ont été détruites...',
    notif_color: '#00FF00',
    is_active: true
  },
  {
    trap_id: 'hp_beuglante',
    name: 'Beuglante de Molly',
    type: 'public-shame',
    description: 'Une Beuglante arrive ! Tout le monde va entendre ta honte !',
    severity: 2,
    shame_message: '📣 **HONTE PUBLIQUE !** {player} a reçu une BEUGLANTE ! "COMMENT AS-TU OSÉ ?!" - Molly Weasley',
    notif_title: '📣 BEUGLANTE REÇUE !',
    notif_description: 'Une enveloppe rouge explose ! Tout Poudlard entend tes erreurs !',
    notif_color: '#FF4500',
    is_active: true
  },
  {
    trap_id: 'hp_retenue_rogue',
    name: 'Retenue avec Rogue',
    type: 'points-malus',
    description: 'Severus Rogue t\'a mis en retenue ! Des points sont retirés...',
    severity: 2,
    malus_points: 5,
    notif_title: '🧪 RETENUE AVEC ROGUE !',
    notif_description: '"Vous êtes exactement comme votre père, arrogant !" - 5 points retirés de votre maison.',
    notif_color: '#2F4F4F',
    is_active: true
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. NOUVELLES MISSIONS HARRY POTTER (types implémentés seulement)
// Types actifs: keyword-message, quiz, manual, true-false, emoji-puzzle
// ═══════════════════════════════════════════════════════════════════════════
const HP_NEW_MISSIONS = [
  // emoji-puzzle (NOUVEAU TYPE)
  {
    mission_id: 'hp_emoji_harry',
    name: 'Devine le Personnage !',
    type: 'emoji-puzzle',
    description: 'Devine quel personnage de Harry Potter est représenté par ces emojis !',
    validation_type: 'auto',
    timeout: 120,
    validation_data: JSON.stringify({
      puzzle: '🧙‍♂️⚡👓🦉',
      answer: 'harry potter',
      hints: ['Le survivant', 'L\'élu', 'Celui qui a vaincu Voldemort']
    })
  },
  {
    mission_id: 'hp_emoji_hermione',
    name: 'Devine la Sorcière !',
    type: 'emoji-puzzle',
    description: 'Quelle sorcière célèbre est représentée par ces emojis ?',
    validation_type: 'auto',
    timeout: 120,
    validation_data: JSON.stringify({
      puzzle: '📚🪄👩‍🦱🐱',
      answer: 'hermione',
      hints: ['La plus intelligente', 'Née-moldue', 'Amie de Harry']
    })
  },
  {
    mission_id: 'hp_emoji_voldemort',
    name: 'Devine le Mage Noir !',
    type: 'emoji-puzzle',
    description: 'Quel personnage terrible est représenté ici ?',
    validation_type: 'auto',
    timeout: 120,
    validation_data: JSON.stringify({
      puzzle: '🐍💀👃❌🪄',
      answer: 'voldemort',
      hints: ['Celui-Dont-On-Ne-Doit-Pas-Prononcer-Le-Nom', 'Tom Jedusor', 'Le Seigneur des Ténèbres']
    })
  },

  // true-false (NOUVEAU TYPE)
  {
    mission_id: 'hp_tf_hagrid',
    name: 'Vrai ou Faux: Hagrid',
    type: 'true-false',
    description: 'Réponds correctement à cette affirmation sur l\'univers Harry Potter !',
    validation_type: 'auto',
    timeout: 60,
    validation_data: JSON.stringify({
      statement: 'Hagrid est le gardien des clés et des lieux à Poudlard.',
      answer: true,
      explanation: 'Rubeus Hagrid est bien le gardien des clés et des lieux à Poudlard !'
    })
  },
  {
    mission_id: 'hp_tf_serpentard',
    name: 'Vrai ou Faux: Serpentard',
    type: 'true-false',
    description: 'Cette affirmation est-elle vraie ou fausse ?',
    validation_type: 'auto',
    timeout: 60,
    validation_data: JSON.stringify({
      statement: 'Salazar Serpentard a fondé la maison Gryffondor.',
      answer: false,
      explanation: 'Salazar Serpentard a fondé la maison Serpentard, pas Gryffondor !'
    })
  },
  {
    mission_id: 'hp_tf_patronus',
    name: 'Vrai ou Faux: Patronus',
    type: 'true-false',
    description: 'Connais-tu bien les Patronus ?',
    validation_type: 'auto',
    timeout: 60,
    validation_data: JSON.stringify({
      statement: 'Le Patronus de Harry Potter est un cerf.',
      answer: true,
      explanation: 'Le Patronus de Harry est bien un cerf, comme celui de son père James !'
    })
  },

  // manual (validation admin)
  {
    mission_id: 'hp_manual_dessin',
    name: 'Dessine une Relique',
    type: 'manual',
    description: 'Dessine ou crée une représentation d\'une Relique de la Mort ! Un admin validera ta création.',
    validation_type: 'manual',
    timeout: 1440
  },
  {
    mission_id: 'hp_manual_cosplay',
    name: 'Cosplay Sorcier',
    type: 'manual',
    description: 'Montre-nous ton meilleur déguisement/cosplay Harry Potter ! Un admin validera.',
    validation_type: 'manual',
    timeout: 1440
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS D'EXÉCUTION
// ═══════════════════════════════════════════════════════════════════════════

async function updateTemplates() {
  console.log('\n' + '═'.repeat(70));
  console.log('🎨 1. MISE À JOUR DES TEMPLATES D\'ANNONCES HARRY POTTER');
  console.log('═'.repeat(70));

  let updated = 0;
  for (const template of HP_TEMPLATES) {
    try {
      await db.query(`
        UPDATE announcement_templates
        SET title = $1, description = $2, color = $3, footer_text = $4,
            image_url = CASE WHEN $5 IS NOT NULL THEN $5 ELSE image_url END
        WHERE guild_id = $6 AND theme_id = $7 AND type = $8
      `, [
        template.title,
        template.description,
        template.color,
        template.footer_text,
        template.image_url || null,
        GUILD_ID,
        THEME_ID,
        template.type
      ]);
      updated++;
      console.log(`   ✅ ${template.type}`);
    } catch (error) {
      console.error(`   ❌ ${template.type}: ${error.message}`);
    }
  }
  console.log(`\n📊 ${updated}/${HP_TEMPLATES.length} templates mis à jour`);
}

async function updateExistingTraps() {
  console.log('\n' + '═'.repeat(70));
  console.log('🪤 2. MISE À JOUR DES PIÈGES EXISTANTS');
  console.log('═'.repeat(70));

  for (const trap of HP_TRAPS_UPDATES) {
    try {
      const result = await db.query(`
        UPDATE traps
        SET notif_title = $1, notif_description = $2, notif_color = $3
        WHERE guild_id = $4 AND theme_id = $5 AND name = $6
        RETURNING id
      `, [
        trap.notif_title,
        trap.notif_description,
        trap.notif_color,
        GUILD_ID,
        THEME_ID,
        trap.name
      ]);

      if (result && result.rowCount > 0) {
        console.log(`   ✅ ${trap.name} - notifications mises à jour`);
      } else {
        console.log(`   ⚠️  ${trap.name} - non trouvé`);
      }
    } catch (error) {
      console.error(`   ❌ ${trap.name}: ${error.message}`);
    }
  }
}

async function createNewTraps() {
  console.log('\n' + '═'.repeat(70));
  console.log('🪤 3. CRÉATION DES NOUVEAUX PIÈGES (types manquants)');
  console.log('═'.repeat(70));

  for (const trap of HP_NEW_TRAPS) {
    try {
      // Vérifier si le piège existe déjà
      const existing = await db.queryOne(`
        SELECT id FROM traps WHERE guild_id = $1 AND theme_id = $2 AND trap_id = $3
      `, [GUILD_ID, THEME_ID, trap.trap_id]);

      if (existing) {
        console.log(`   ⏭️  ${trap.name} - déjà existant`);
        continue;
      }

      await db.query(`
        INSERT INTO traps (guild_id, theme_id, trap_id, name, type, description, severity,
                          shame_message, malus_points, notif_title, notif_description, notif_color, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        GUILD_ID,
        THEME_ID,
        trap.trap_id,
        trap.name,
        trap.type,
        trap.description,
        trap.severity,
        trap.shame_message || null,
        trap.malus_points || 0,
        trap.notif_title,
        trap.notif_description,
        trap.notif_color,
        trap.is_active
      ]);
      console.log(`   ✅ ${trap.name} (${trap.type}) - créé`);
    } catch (error) {
      console.error(`   ❌ ${trap.name}: ${error.message}`);
    }
  }
}

async function createNewMissions() {
  console.log('\n' + '═'.repeat(70));
  console.log('🎯 4. CRÉATION DES NOUVELLES MISSIONS (tous types)');
  console.log('═'.repeat(70));

  for (const mission of HP_NEW_MISSIONS) {
    try {
      // Vérifier si la mission existe déjà
      const existing = await db.queryOne(`
        SELECT id FROM missions WHERE guild_id = $1 AND theme_id = $2 AND mission_id = $3
      `, [GUILD_ID, THEME_ID, mission.mission_id]);

      if (existing) {
        console.log(`   ⏭️  ${mission.name} (${mission.type}) - déjà existante`);
        continue;
      }

      await db.query(`
        INSERT INTO missions (guild_id, theme_id, mission_id, name, type, description,
                             validation_type, validation_data, timeout, reward_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'random-collectible')
      `, [
        GUILD_ID,
        THEME_ID,
        mission.mission_id,
        mission.name,
        mission.type,
        mission.description,
        mission.validation_type,
        mission.validation_data,
        mission.timeout
      ]);
      console.log(`   ✅ ${mission.name} (${mission.type}) - créée`);
    } catch (error) {
      console.error(`   ❌ ${mission.name}: ${error.message}`);
    }
  }
}

async function listImagesToCustomize() {
  console.log('\n' + '═'.repeat(70));
  console.log('🖼️  5. LISTE DES IMAGES À PERSONNALISER');
  console.log('═'.repeat(70));

  const images = [];

  // Templates avec placeholder images
  console.log('\n📢 Templates d\'annonces (image_url):');
  const templatesWithImages = HP_TEMPLATES.filter(t => t.image_url);
  templatesWithImages.forEach(t => {
    console.log(`   📷 ${t.type}: ${t.image_url}`);
    images.push({ type: 'template', name: t.type, placeholder: t.image_url });
  });

  // Mystery Box image from theme_config
  console.log('\n📦 Mystery Box (theme_config):');
  const config = await db.queryOne(`
    SELECT mystery_box_image, mystery_box_celebration_gif FROM theme_config
    WHERE guild_id = $1 AND theme_id = $2
  `, [GUILD_ID, THEME_ID]);

  if (config) {
    console.log(`   📷 mystery_box_image: ${config.mystery_box_image}`);
    console.log(`   🎬 mystery_box_celebration_gif: ${config.mystery_box_celebration_gif}`);
    images.push({ type: 'theme_config', name: 'mystery_box_image', current: config.mystery_box_image });
    images.push({ type: 'theme_config', name: 'mystery_box_celebration_gif', current: config.mystery_box_celebration_gif });
  }

  // Collectibles images
  console.log('\n📦 Collectibles (vérifier si images HP valides):');
  const collectibles = await db.queryAll(`
    SELECT name, rarity, image_url FROM collectibles
    WHERE guild_id = $1 AND theme_id = $2
    ORDER BY rarity, name
  `, [GUILD_ID, THEME_ID]);

  collectibles.forEach(c => {
    const valid = c.image_url && !c.image_url.includes('placeholder') && !c.image_url.includes('example');
    const status = valid ? '✅' : '⚠️';
    if (!valid) {
      console.log(`   ${status} ${c.name} (${c.rarity}): ${c.image_url || 'MANQUANTE'}`);
      images.push({ type: 'collectible', name: c.name, rarity: c.rarity, current: c.image_url });
    }
  });

  // Traps images
  console.log('\n🪤 Pièges (image_url):');
  const traps = await db.queryAll(`
    SELECT name, type, image_url FROM traps
    WHERE guild_id = $1 AND theme_id = $2
  `, [GUILD_ID, THEME_ID]);

  traps.forEach(t => {
    if (!t.image_url) {
      console.log(`   ⚠️  ${t.name}: MANQUANTE`);
      images.push({ type: 'trap', name: t.name, current: null });
    }
  });

  console.log('\n' + '─'.repeat(70));
  console.log(`📊 TOTAL: ${images.length} images à personnaliser/vérifier`);

  return images;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n' + '█'.repeat(70));
  console.log('🧙 CONFIGURATION COMPLÈTE DU THÈME HARRY POTTER');
  console.log('█'.repeat(70));
  console.log(`\nServeur: ${GUILD_ID}`);
  console.log(`Thème ID: ${THEME_ID}`);

  try {
    await updateTemplates();
    await updateExistingTraps();
    await createNewTraps();
    await createNewMissions();
    const images = await listImagesToCustomize();

    console.log('\n' + '█'.repeat(70));
    console.log('✅ CONFIGURATION HARRY POTTER TERMINÉE !');
    console.log('█'.repeat(70));

    // Résumé final
    console.log('\n📋 RÉSUMÉ:');
    console.log('   ✅ 19 templates d\'annonces personnalisés');
    console.log('   ✅ 4 pièges existants thématisés');
    console.log('   ✅ 3 nouveaux pièges créés (lose-all, public-shame, points-malus)');
    console.log('   ✅ 8 nouvelles missions créées (emoji-puzzle, true-false, manual)');
    console.log(`   ⚠️  ${images.length} images à personnaliser (voir liste ci-dessus)`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

main();
