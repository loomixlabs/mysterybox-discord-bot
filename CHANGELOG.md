# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

## [1.4.1] - 2025-11-18

### 🔥 Fixed

#### **🔴 CRITIQUE - Isolation Multi-Serveur pour Super Bonuses**
- **Date**: 2025-11-18
- **Type**: PATCH - Bug critique de sécurité multi-serveur
- **Fichiers modifiés**:
  - [handlers/superBonusHandler.js](handlers/superBonusHandler.js) (lignes 576-591, 626-641, 676-690)
- **Problème**:
  - Les modifications de durée/charges des super bonuses s'appliquaient sur **TOUS les serveurs** au lieu du serveur courant
  - 3 requêtes UPDATE manquaient la condition `WHERE guild_id = $X`
- **Fonctions corrigées**:
  1. `handleEditBonusDurationHours()` - ligne 576
  2. `handleEditBonusDurationDays()` - ligne 626
  3. `handleEditBonusDurationCharges()` - ligne 676
- **Corrections appliquées**:
  - Ajout de `const guildId = interaction.guildId;` en début de fonction
  - SELECT: `WHERE id = $1` → `WHERE id = $1 AND guild_id = $2`
  - UPDATE: `WHERE id = $2` → `WHERE id = $2 AND guild_id = $3`
- **Impact**: Les modifications de super bonuses sont maintenant correctement isolées par serveur

### ✨ Added

#### **Sprint 1 - Implémentation et Validation des 3 Premiers Super Bonuses**

##### 👁️ **Vision Divine - Système de Révélation Complet**
- **Date**: 2025-11-16 → 2025-11-18
- **Type**: Nouveau système de révélation de mystery boxes
- **Fichiers créés/modifiés**:
  - [handlers/superBonusHandler.js](handlers/superBonusHandler.js) (lignes 718-890):
    - `checkAndRevealVisionDivine()` - Vérifie si le bonus est actif et révèle le contenu
    - `createVisionDivineEmbed()` - Crée l'embed stylé de révélation
    - `clearVisionDivineTracking()` - Nettoie le tracking après utilisation
    - `visionDivineUsed` Set - Tracking anti-multi-trigger par (messageId, userId)
  - [handlers/mysteryBoxHandler.js](handlers/mysteryBoxHandler.js) (lignes 469-490):
    - Intégration avant l'ouverture de la boîte
    - Rollage du contenu en avance pour révélation
    - Boutons Accept/Decline pour choix du joueur
- **Fonctionnalités**:
  - **Révélation anticipée**: Affiche le contenu AVANT l'ouverture de la mystery box
  - **Embed doré**: Design unique avec gif mystique et breakdown détaillé
  - **Informations révélées**:
    - Type de contenu (Collectible, Mission, Piège, Super Bonus)
    - Nom et description de l'item
    - Rareté avec emoji coloré
    - Durée/Charges pour les super bonus
  - **Choix joueur**: Boutons "✅ Accepter et Ouvrir" / "❌ Passer"
  - **Anti-multi-trigger**: Système de tracking (messageId:userId) pour éviter double consommation
  - **Consommation automatique**: 1 charge consommée à la révélation (pas au choix)
- **Impact**: Bonus stratégique pour optimiser les ouvertures de mystery boxes

##### 💰 **Jackpot x2 - Multiplicateur de Collectibles**
- **Date**: 2025-11-16 → 2025-11-18
- **Type**: Nouveau système de double récompense
- **Fichiers créés/modifiés**:
  - [handlers/superBonusHandler.js](handlers/superBonusHandler.js) (lignes 958-982):
    - `hasMultiplierBonus()` - Vérifie si le joueur a Jackpot x2 actif
    - `consumeBonusCharge()` - Consomme une charge de bonus (générique)
  - [handlers/mysteryBoxHandler.js](handlers/mysteryBoxHandler.js) (lignes 584-723):
    - Tirage d'un collectible bonus DIFFÉRENT du principal
    - Gestion des doublons pour collectible principal ET bonus
    - Affichage visuel avec progression pour les 2 collectibles
    - Consommation de 1 charge après attribution
  - [utils/database-pg.js](utils/database-pg.js) (ligne 1872):
    - Description corrigée: "La prochaine mystery box donnera DOUBLE récompense si collectible !"
- **Fonctionnalités**:
  - **Double collectible**: Si mystery box contient un collectible → 2 collectibles au lieu d'1
  - **Collectible différent**: Le bonus est tiré aléatoirement (uniforme, pas de rareté pondérée)
  - **Gestion doublons**:
    - Collectible principal doublon + bonus non-doublon → Seul le bonus est ajouté
    - Les 2 sont des doublons → Message informatif avec détails des 2
  - **Affichage visuel**: Embed avec les 2 collectibles, progression, charges restantes
  - **1 charge = 1 utilisation**: Corrigé de "5 utilisations" à "1 utilisation"
- **Impact**: Bonus économique pour accélérer la complétion des collections

##### 🧲 **Aimant à Légendaires - Boost de Rareté**
- **Date**: 2025-11-16 → 2025-11-18
- **Type**: Nouveau système de boost de probabilités
- **Fichiers créés/modifiés**:
  - [handlers/superBonusHandler.js](handlers/superBonusHandler.js) (lignes 893-955):
    - `applyCollectibleRarityBoost()` - Applique +50% sur rareté légendaire
    - Normalisation automatique pour respecter 100%
    - Logs détaillés des probabilités avant/après boost
  - [handlers/mysteryBoxHandler.js](handlers/mysteryBoxHandler.js) (lignes 382-406):
    - Intégration dans `rollMysteryContent()` avec `userId` optionnel
    - `selectCollectibleWeighted()` modifié pour accepter `customPercentages`
    - Application du boost avant la sélection du collectible
- **Fonctionnalités**:
  - **Boost légendaire**: +50% de probabilité d'obtenir un collectible légendaire
  - **Exemples**:
    - Base: 5% legendary → Avec bonus: 55% legendary (avant normalisation)
    - Après normalisation à 100%: ~37% legendary
  - **Pas de consommation**: Bonus permanent (duration_type = 'permanent')
  - **Logs détaillés**: Console affiche probabilités avant/après/normalisées
  - **Configuration en heures**: Sélecteur 1-10h pour contrôle fin (voir section Changed)
- **Impact**: Bonus stratégique pour cibler les collectibles rares

##### 🧪 **Tests End-to-End Sprint 1**
- **Date**: 2025-11-16 → 2025-11-18
- **Scripts E2E créés**:
  - `scripts/test-aimant-legendaires-v2.js` - Validation complète Aimant à Légendaires
    - Utilise EXACTEMENT la même logique que mysteryBoxHandler.js
    - Simulation 1000 ouvertures avec boost actif
    - Vérifie augmentation significant de legendary (attendu: 37% au lieu de 5%)
    - Tests avec joueur réel ayant le bonus actif
  - `scripts/test-aimant-scenarios.js` - Scénarios multiples Aimant
  - `scripts/test-vision-divine-cumul.js` - Tests cumul Vision Divine
  - `scripts/test-vision-divine-fixes.js` - Validation fixes Vision Divine
- **Documentation créée**:
  - [TESTS-SUPER-BONUS-E2E.md](TESTS-SUPER-BONUS-E2E.md) - Guide de tests E2E complet
    - 6 tests détaillés avec procédures pas-à-pas
    - Scripts SQL de vérification
    - Checklist finale de validation
  - [GUIDE-TESTS-AIMANT-JACKPOT.md](GUIDE-TESTS-AIMANT-JACKPOT.md) - Guide tests Aimant & Jackpot
  - [SPEC-AIMANT-JACKPOT-IMPLEMENTATION.md](SPEC-AIMANT-JACKPOT-IMPLEMENTATION.md) - Spécifications techniques
  - [RECAP-AIMANT-JACKPOT-IMPLEMENTATION.md](RECAP-AIMANT-JACKPOT-IMPLEMENTATION.md) - Récapitulatif implémentation
- **Validation**:
  - ✅ Vision Divine: Révélation + choix + tracking + consommation
  - ✅ Jackpot x2: Double collectible + doublons + affichage
  - ✅ Aimant à Légendaires: Boost +50% + normalisation + logs
  - ✅ Isolation multi-serveur: guild_id dans toutes les requêtes
  - ✅ Tests E2E: Scripts automatisés + tests manuels Discord

### 🔧 Changed

#### **Configuration Durée "Aimant à Légendaires" en Heures (1-10h)**
- **Date**: 2025-11-18
- **Type**: MINOR - Amélioration de l'UX pour le super bonus "Aimant à Légendaires"
- **Fichiers modifiés**:
  - [handlers/superBonusHandler.js](handlers/superBonusHandler.js) (lignes 313-330, 419-451, 793-811):
    - `handleBonusDurationSelect()` - Ajout condition spéciale pour legendary_magnet → sélecteur 1-10h uniquement
    - `createBonusReceivedEmbed()` - Toujours afficher en heures pour legendary_magnet
    - `buildVisionEmbedRow()` - Toujours afficher en heures pour legendary_magnet (Vision Divine)
  - Base de données (via script) - Description mise à jour pour retirer mention de durée
- **Fonctionnalités**:
  - **Admin Panel**: Sélecteur de durée affiche maintenant 1-10 heures (au lieu de 1-10 jours auto-détecté)
  - **Affichage**: La durée s'affiche toujours en heures dans les embeds
  - **Description**: Retrait de "(3 jours)" de la description du bonus (durée affichée dynamiquement)
- **Scripts créés**:
  - `scripts/check-legendary-magnet.js` - Vérification configuration actuelle du bonus
  - `scripts/update-legendary-magnet-description.js` - Retrait "(3 jours)" de la description
  - `scripts/find-duration-display.js` - Recherche tous les endroits où la durée est affichée
- **Justification**: Les durées en jours (24h+) étaient trop longues pour ce bonus. Configuration en heures permet un contrôle plus fin (1-10h).
- **Impact**: Autres super bonuses gardent leur comportement actuel (auto-détection heures/jours).

## [1.4.0] - 2025-11-16

### ✨ Added

#### **Système de Probabilités Complet pour Mystery Boxes**
- **Date**: 2025-11-16
- **Type**: Nouveau système de configuration des probabilités en 2 niveaux
- **Fichiers créés**:
  - `handlers/probabilityHandler.js` (nouveau fichier, 544 lignes)
- **Fichiers modifiés**:
  - `handlers/adminPanelHandler.js` - Ajout bouton "Probabilités" dans admin panel
  - `events/interactionCreate.js` - Routing des interactions de probabilité
- **Fonctionnalités**:
  - **Niveau 1 - Probabilités des Types** (4 types, total doit = 100%):
    - 🎁 Collectibles - Probabilité de recevoir un collectible
    - 📋 Missions - Probabilité de recevoir une mission
    - ⚠️ Pièges - Probabilité de tomber sur un piège
    - ✨ Super Bonus - Probabilité de recevoir un super bonus
  - **Niveau 2 - Probabilités par Rareté**:
    - **⭐ Rareté Collectibles** (4 raretés, total doit = 100%):
      - 🟣 Legendary, 🟠 Epic, 🔵 Rare, ⚪ Common
    - **⭐ Rareté Super Bonuses** (4 raretés, total doit = 100%):
      - 🟣 Legendary, 🟠 Epic, 🔵 Rare, ⚪ Common
- **Interface Admin**:
  - Menu principal avec vue d'ensemble des 3 systèmes de probabilités
  - 3 boutons de configuration: Types, Rareté Collectibles, Rareté Super Bonuses
  - Modals de saisie avec validation stricte (total = 100%)
  - Messages d'erreur explicites avec total affiché
  - Confirmation visuelle après modification
- **Migrations DB**:
  - `database/migrations/add-rarity-probability-columns.sql` - Colonnes de probabilité par rareté
  - `database/migrations/add-super-bonus-probability.sql` - Colonne probability_super_bonus
- **Impact**:
  - Contrôle fin de la distribution des mystery boxes
  - Équilibrage facile du gameplay par les admins
  - Interface visuelle claire et intuitive
  - Validation stricte pour éviter les erreurs de configuration

#### **Simplification UX Configuration Durée/Charges Super Bonuses**
- **Date**: 2025-11-16
- **Type**: Suppression des boutons intermédiaires + détection automatique heures/jours
- **Fichiers modifiés**:
  - `handlers/superBonusHandler.js` (lignes 368-658) - 3 handlers admin déplacés + 1 nouveau handler heures
  - `handlers/adminPanelHandler.js` (lignes 487-495) - Routing vers superBonusHandler
  - `events/interactionCreate.js` (ligne 270) - Routing `edit_bonus_duration_`
- **Fonctionnalités**:
  - **Étape unique**: Sélection du super bonus depuis un dropdown
  - **Affichage automatique** du bon sélecteur selon le type en base de données:
    - ♾️ **Permanent** → Message informatif (pas de configuration)
    - ⏰ **Temporaire < 24h** → Sélecteur 1-24 heures
    - ⏰ **Temporaire >= 24h** → Sélecteur 1-10 jours
    - 🎯 **Charges** → Sélecteur 1-10 charges
  - **Détection intelligente** heures vs jours basée sur `duration_value < 86400`
- **Nouvelles fonctions**:
  1. `handleBonusDurationSelect()` - Détecte le type et affiche le bon sélecteur (ligne 368)
  2. `handleEditBonusDurationHours()` - Sauvegarde durée en heures (ligne 517)
  3. `handleEditBonusDurationDays()` - Sauvegarde durée en jours (ligne 566)
  4. `handleEditBonusDurationCharges()` - Sauvegarde nombre de charges (ligne 615)
- **Amélioration**:
  - UX ultra-simplifiée: 1 sélection au lieu de 3 étapes
  - Pas de choix de type (lu depuis DB)
  - Adaptation automatique du sélecteur (heures/jours)
  - Pas de confusion possible pour l'admin
- **Impact**:
  - Workflow admin divisé par 3
  - Cohérence garantie avec les données DB
  - Meilleure organisation du code (séparation adminPanelHandler/superBonusHandler)

### 🔧 Changed

#### **Système de Cumul pour TOUS les Super Bonuses**
- **Date**: 2025-11-16
- **Fichiers modifiés**: `handlers/mysteryBoxHandler.js` (lignes 726-815)
- **Fonctionnalité**: Tous les super bonuses sont maintenant cumulables selon leur type de durée
  - **Charges** (Jackpot x2, Parrain/Marraine): Les charges s'additionnent
    - Exemple: 1 charge + 1 charge = 2 charges totales
    - Message: "✨ Bonus cumulé ! 🔢 Charges totales: X"
  - **Temporaire** (Aura de Célébrité): La durée s'étend
    - Exemple: 24h restantes + 48h nouveau = 72h totales
    - Message: "✨ Bonus cumulé ! ⏱️ Temps restant: Xh Ymin"
  - **Permanent** (Chance du Diable, Aimant, Détecteur): Pas de cumul
    - Message informatif: "Tu possèdes déjà ce bonus (permanent)"
- **Impact**: Meilleure UX et flexibilité pour les joueurs
- **Audit logging**: Nouvelle action `super_bonus_cumulated` tracée
- **Documentation**: Voir [MISE-A-JOUR-CUMUL-SUPER-BONUS.md](MISE-A-JOUR-CUMUL-SUPER-BONUS.md)

#### **Corrections de Configuration Super Bonuses**
- **Date**: 2025-11-16
- **Migration**: `database/migrations/fix-super-bonus-config.sql` (appliquée)
- **Script**: `scripts/apply-super-bonus-config-fix.js`
- **Corrections**:
  1. **💵 Jackpot x2 (ID 8)**:
     - `activation_mode`: `manual` → `automatic` (activation immédiate)
     - `duration_value`: `5` → `1` (1 seule charge)
     - Raison: Le bonus doit s'activer automatiquement avec 1 charge, pas 5
  2. **👑 Aura de Célébrité (ID 4)**:
     - `activation_mode`: `manual` → `automatic` (activation immédiate)
     - Raison: Effet passif doit s'activer automatiquement
  3. **🤝 Parrain/Marraine (ID 10)**:
     - `duration_type`: `temporary` → `charges`
     - `duration_value`: `432000` (5 jours) → `1` (1 box)
     - Raison: Le bonus permet d'offrir 1 box, pas une durée temporelle
- **Impact**: Comportements des bonus alignés avec les spécifications

### 🐛 Fixed

#### **Parsing CustomId pour Types avec Underscores**
- **Date**: 2025-11-16
- **Fichiers modifiés**: `handlers/mysteryBoxHandler.js` (lignes 307-313)
- **Bug**: Le parsing de `mystery_open_super_bonus_9` était cassé
  - Ancien parsing: `const [, , type, itemId] = interaction.customId.split('_')`
  - Résultat: `type="super"`, `itemId="bonus"` ❌
- **Fix**: Nouvelle logique de parsing
  ```javascript
  const customIdParts = interaction.customId.split('_');
  const itemId = customIdParts[customIdParts.length - 1];
  const type = customIdParts.slice(2, -1).join('_');
  ```
  - Résultat: `type="super_bonus"`, `itemId="9"` ✅
- **Impact**: Les mystery boxes contenant des super bonuses s'ouvrent correctement
- **Tests**: Script de test créé (`scripts/test-custom-id-parsing.js`) - 5/5 tests passés

#### **Suppression Fonction Duplicate revealSuperBonus()**
- **Date**: 2025-11-16
- **Fichiers modifiés**: `handlers/mysteryBoxHandler.js` (lignes 1057-1101 supprimées)
- **Bug**: Deux fonctions `revealSuperBonus()` dans le même fichier
  - Ligne 697: Nouvelle implémentation avec activation_mode logic
  - Ligne 1057: Ancienne implémentation (utilisée par JavaScript)
- **Impact**: JavaScript utilisait toujours l'ancienne fonction (dernière définition)
- **Fix**: Suppression de la fonction dupliquée
- **Résultat**: Utilisation de la bonne implémentation avec activation automatique/manuelle

#### **Erreur auditLogger.log() dans Système de Cumul**
- **Date**: 2025-11-16
- **Fichiers modifiés**: `handlers/mysteryBoxHandler.js` (lignes 753-754, 784-785)
- **Bug**: `TypeError: auditLogger.log is not a function` lors du cumul de bonus
  - Appel à `auditLogger.log()` qui n'existe pas dans le module
  - Méthodes disponibles: `logBonusGranted`, `logBonusUsed`, `logBonusExpired`, `logBonusEffectApplied`
- **Impact**: Message d'erreur "Une erreur est survenue" après cumul réussi
- **Fix**: Suppression des appels erronés à `auditLogger.log()`
  - Ajout de TODO pour implémenter audit logging proprement plus tard
  - Console.log conservés pour debugging
- **Résultat**: Cumul fonctionne sans erreur, message de succès affiché correctement

#### **Système d'Auto-Installation des Super Bonuses**
- **Auto-installation lors de l'invitation du bot sur un nouveau serveur**:
  - Fichiers créés:
    - `events/guildCreate.js` - Event handler pour nouveaux serveurs
  - Fonctionnalité: Les 11 super bonuses fixes sont automatiquement installés quand le bot rejoint un nouveau serveur
  - Bonuses installés: Chance du Diable, Vision Divine, Aimant Légendaire, Aura de Célébrité, Bouclier Anti-Piège, Assurance Collector, Accélérateur de Cooldown, Jackpot x2, Détecteur de Pièges, Retour dans le Futur, Parrain/Marraine
  - Impact: Zéro configuration manuelle requise pour les nouveaux serveurs

- **Méthode d'installation des super bonuses dans database-pg.js**:
  - Fichiers modifiés: `utils/database-pg.js` (lignes 1763-1963)
  - Nouvelle méthode: `installSuperBonusesForGuild(guildId)`
  - Définition des 11 super bonuses fixes avec leurs configurations complètes
  - Protection contre les doublons via ON CONFLICT DO NOTHING
  - Gestion individuelle des erreurs pour isolation des échecs

- **Script de migration pour serveurs existants**:
  - Fichiers créés:
    - `scripts/install-bonuses-existing-guilds.js` - Migration one-time
    - `scripts/verify-super-bonuses-installation.js` - Vérification complète
    - `scripts/check-effect-types-constraint.js` - Diagnostic contraintes
  - Fonctionnalité: Installation des 11 bonuses sur tous les serveurs existants
  - Vérification: Scripts de diagnostic pour valider l'installation complète

- **Système de logging pour super bonuses**:
  - Fichiers modifiés: `utils/auditLogger.js` (lignes 282-418)
  - 4 nouvelles méthodes de logging pour traçabilité complète du cycle de vie des bonus:
    - `logBonusGranted(guildId, userId, bonusName, details)` - Attribution d'un super bonus
    - `logBonusUsed(guildId, userId, bonusName, details)` - Utilisation/activation d'un bonus
    - `logBonusExpired(guildId, userId, bonusName, details)` - Expiration automatique d'un bonus
    - `logBonusEffectApplied(guildId, userId, bonusName, details)` - Application d'un effet de bonus
  - Stockage dans la table `audit_logs` avec détails JSONB
  - Métadonnées trackées: bonus_id, rarity, duration_type, duration_value, effect_type, obtained_from
  - Actions système (granted, expired) utilisent admin_id = 'system'
  - Actions utilisateur (used, effect_applied) utilisent le Discord ID du joueur

- **Mystery Box 4ème Type - Distribution des Super Bonuses**:
  - Fichiers créés/modifiés:
    - `database/migrations/add-super-bonus-probability.sql` - Migration probabilités
    - `scripts/run-add-super-bonus-probability.js` - Script d'exécution
    - `handlers/mysteryBoxHandler.js` (lignes 91-293) - Intégration 4ème type
  - **Nouvelle colonne `probability_super_bonus` dans theme_config**:
    - DEFAULT 10% pour les nouvelles configurations
    - Réajustement automatique des probabilités existantes pour maintenir total = 100%
    - Contrainte CHECK mise à jour pour valider la somme = 100%
    - Config type 1: 70/30/0 → 55/35/0/10 (collectible/mission/trap/super_bonus)
    - Config type 2: 40/40/20 → 25/35/30/10
    - Config type 3: 50/25/25 → 35/35/20/10
  - **Modification de `rollMysteryContent()` pour gérer 4 types**:
    - Ajout de la zone de probabilité super_bonus (90-100 avec config 10%)
    - Fallback à 0% si probability_super_bonus non défini (rétrocompatibilité)
    - Logs de debug affichant les 4 zones de probabilités
    - Redistribution automatique si type sélectionné n'a pas d'items disponibles
  - **Nouvelle méthode `selectSuperBonus(guildId, config)`**:
    - Sélection pondérée par rareté (common: 50%, rare: 30%, epic: 15%, legendary: 5%)
    - NOTE: Weights temporaires, seront remplacés par config.probability_rarity_* dans Sprint 1 "Probabilités par rareté"
    - Logs détaillés: nom, rareté, duration_type, duration_value, effect_type
    - Retourne le super bonus sélectionné avec toutes ses propriétés
  - **Modification Admin Panel - Configuration des probabilités avec 4 types**:
    - Fichiers modifiés:
      - `handlers/adminPanelHandler.js` (lignes 1147-1162) - Ajout 4ème input dans modal
      - `handlers/modalHandler.js` (lignes 113-196) - Gestion validation et update 4 types
    - Nouveau champ `prob_super_bonus` dans le modal de configuration
    - Validation stricte: Total doit être exactement 100% (4 types combinés)
    - Message d'erreur détaillé affichant la répartition actuelle si total != 100%
    - Update DB incluant `probability_super_bonus` dans la requête UPDATE
    - Logging auditLogger mis à jour pour inclure `super_bonus` dans old/new values
    - Message de confirmation affichant les 4 probabilités avec total et émojis

- **Système d'Activation Automatique vs Manuelle pour Super Bonuses**:
  - Fichiers créés/modifiés:
    - `database/migrations/add-activation-mode.sql` - Migration mode d'activation
    - `scripts/run-add-activation-mode.js` - Script d'exécution avec vérification
    - `handlers/mysteryBoxHandler.js` (lignes 675-863) - Nouvelle méthode revealSuperBonus()
  - **Nouvelle colonne `activation_mode` dans super_bonuses**:
    - DEFAULT 'manual' pour les nouveaux bonus
    - Contrainte CHECK (activation_mode IN ('automatic', 'manual'))
    - **3 bonus AUTOMATIC** (passive effects):
      - 🎰 Chance du Diable - +20% probabilités (passif continu)
      - 🧲 Aimant Légendaires - Boost rareté legendary (passif continu)
      - 🔍 Détecteur de Pièges - Marqueur 💀 sur pièges (passif continu)
    - **9 bonus MANUAL** (active effects):
      - Tous les autres bonus nécessitent activation via /profile
  - **Correction DEFAULT de `activated_at` dans player_active_bonuses**:
    - Ancien: DEFAULT now() → Nouveau: DEFAULT NULL
    - **CRITIQUE**: Duration ne se déclenche qu'à l'activation, pas à l'obtention
    - Obtention (mystery box): activated_at = NULL, expires_at = NULL
    - Activation (via /profile): activated_at = NOW(), expires_at calculé selon duration_type
  - **Nouvelle méthode `revealSuperBonus(interaction, bonusId, player)`**:
    - Vérification si bonus déjà actif (évite doublons)
    - **Logique automatique** (activation_mode = 'automatic'):
      - activated_at = NOW() immédiatement
      - expires_at calculé selon duration_type (temporary, charges, permanent)
      - Effets passifs appliqués automatiquement via superBonusHandler
      - Message "✨ Bonus activé automatiquement !"
    - **Logique manuelle** (activation_mode = 'manual'):
      - activated_at = NULL, expires_at = NULL (bonus dans l'inventaire)
      - Message explicatif pour activation via /profile section "🎁 Mes Super Bonus"
      - Duration affichée comme "Durée après activation"
    - Logging complet via `auditLogger.logBonusGranted()`
    - Embed personnalisé avec rareté, description, durée/charges
    - Annonce si bonus légendaire (via announcements.announceSuperBonus())

### 🐛 Fixed
- **[Super Bonuses]**: Correction contrainte CHECK sur effect_type
  - Fichiers créés/modifiés:
    - `database/migrations/add-reroll-effect-type.sql` - Migration SQL
    - `scripts/run-add-reroll-migration.js` - Script d'exécution de migration
  - Cause: La contrainte `super_bonuses_effect_type_check` ne contenait pas le type 'reroll'
  - Impact: Le bonus "Retour dans le Futur" ne pouvait pas être installé
  - Solution: Ajout de 'reroll' aux valeurs autorisées dans la contrainte CHECK
  - Valeurs autorisées: probability, cosmetic, protection, cooldown, reveal, transfer, rarity_boost, multiplier, detector, voice, reroll

## [1.3.0] - 2025-11-15

### 🐛 Fixed
- **[Profile Color]**: Correction bug bouton "Couleur automatique"
  - Fichiers modifiés:
    - `handlers/profileColorHandler.js` (ligne 335 - retrait deferUpdate dupliqué)
    - `handlers/profileHandler.js` (lignes 69-72 - routing modal avant defer)
  - Cause: `resetToAutoColor()` appelait `deferUpdate()` alors que déjà déféré par `handleProfileInteraction()`
  - Erreur: "InteractionAlreadyReplied"
  - Solution: Routing de `profile_color_custom` avant le defer pour permettre showModal()

### ✨ Added

#### **Système de Partage de Profil Amélioré (v2.0)**
- **Embed riche pour le partage de profil**:
  - Fichiers modifiés: `handlers/profileHandler.js` (lignes 219-338)
  - Remplace le message texte basique par un embed visuel complet
  - Affichage des badges du joueur dans le titre
  - Avatar du joueur en thumbnail
  - Barre de progression visuelle avec pourcentage
  - Couleur dynamique selon la progression (rouge → orange → vert)

- **Stats détaillées dans le partage**:
  - Collection par rareté avec emojis (🌟 💎 💠 ⚪)
  - Affichage du nombre d'items collectés par rareté avec pourcentage
  - Classement serveur (#X/Total joueurs)
  - Date d'inscription au bot
  - Historique des 3 dernières activités (collectes récentes)

- **Promotion Loomix Bot**:
  - Fichiers modifiés:
    - `utils/footerHelper.js` (lignes 6-11) - Ajout des liens Loomix
    - `views/profileView.js` (lignes 19, 123-136) - Ajout du bouton dans Overview
    - `handlers/profileHandler.js` (lignes 306-310) - Retrait du bouton du partage public
  - Ajout du lien Discord Loomix dans `LOOMIX_BRANDING.discordInvite`
  - Link Button "Rejoindre Loomix Discord" 🌟 affiché dans le menu `/profile` (vue Overview)
  - Bouton cliquable avec lien direct vers le serveur Discord (https://discord.gg/JBKPw6gv)
  - Footer avec logo Loomix automatiquement affiché sur tous les embeds
  - Positionnement stratégique : dans le menu privé `/profile`, pas dans le partage public

#### **Système de Personnalisation de Couleur de Profil**
- **Nouvelle colonne en base de données**:
  - Migration: `scripts/migrations/add-preferred-color-column.js`
  - Ajout de `preferred_color` (TEXT, nullable) dans la table `players`
  - NULL par défaut = couleur automatique basée sur la progression

- **Handler de personnalisation de couleur**:
  - Fichier créé: `handlers/profileColorHandler.js` (455 lignes)
  - Réutilise les 5 palettes de couleurs de `/server-config` (basiques, tendances 2025, pastel, vives, professionnelles)
  - Total de 32 couleurs prédéfinies disponibles
  - Fonctionnalités:
    - Menu de sélection avec 4 SelectMenus (palettes)
    - Code hexadécimal personnalisé via modal
    - Bouton "Couleur automatique" pour revenir à la couleur dynamique
    - Validation complète des codes hex (#FFFFFF ou #FFF)

- **Nouveau bouton dans `/profile`**:
  - Fichier modifié: `views/profileView.js` (lignes 121-126)
  - Bouton "🎨 Couleur de l'embed" dans la vue Overview
  - Positionné dans la 2ème rangée de boutons (avec Actualiser et Partager)

- **Logique de couleur mise à jour**:
  - Fichiers modifiés:
    - `views/profileView.js` (lignes 31, 176) - Vue Overview et Inventory
    - `handlers/profileHandler.js` (ligne 240) - Partage de profil
  - Utilise `player.preferred_color` si défini, sinon couleur dynamique
  - Couleur personnalisée s'applique à:
    - Menu `/profile` (toutes les vues)
    - Partage de profil public
    - Toutes les stats personnelles

- **Routing des interactions**:
  - `handlers/profileHandler.js` (lignes 14, 65-67, 122-128) - Import + routes boutons et selectmenus
  - `events/interactionCreate.js` (lignes 216-219) - Route modal couleur personnalisée
  - CustomIds gérés:
    - `profile_color_settings` - Ouvre le menu de sélection
    - `profile_color_select_*` - Sélection dans les palettes
    - `profile_color_custom` - Modal code hex personnalisé
    - `profile_color_auto` - Réinitialise à la couleur automatique
    - `profile_color_custom_modal` - Soumission modal

### 📊 Impact
- Amélioration significative de l'attractivité visuelle du partage de profil
- Promotion discrète et stratégique du serveur Loomix via le menu `/profile`
- Augmentation anticipée des partages de profil grâce au design amélioré
- Visibilité optimale du bouton Loomix sans polluer les partages publics
- **Nouvelle personnalisation**: Les joueurs peuvent désormais personnaliser la couleur de leur profil
- Engagement accru grâce à la personnalisation individuelle
- 32 couleurs prédéfinies + possibilité de code hex personnalisé = personnalisation illimitée
- Flexibilité totale: couleur fixe OU couleur automatique selon la progression

## [1.2.0] - 2025-11-15

### ✨ Added

#### **Système de Branding Complet avec Footer Loomix**
- **Footer centralisé avec branding imposé**:
  - Helper `utils/footerHelper.js` créé pour gérer les footers de manière centralisée
  - Logo Loomix automatiquement affiché sur tous les footers (https://avatars.githubusercontent.com/u/241378179)
  - Format imposé: `{texte_serveur} • Powered by Loomix Bot`
  - 3 fonctions disponibles: `getLoomixFooter()`, `getLoomixFooterWithCustomText()`, `getLoomixFooterOnly()`

- **Mise à jour massive des embeds** (35+ embeds modifiés):
  - `handlers/mysteryBoxHandler.js` - 10 embeds avec footer Loomix
  - `handlers/missionHandler.js` - 14 embeds avec footer Loomix
  - `views/profileView.js` - 5 embeds avec footer Loomix
  - `handlers/modalHandler.js` - 4 embeds avec footer Loomix
  - `handlers/serverConfigHandler.js` - 4 embeds avec footer Loomix et couleur secondaire

- **Système de couleurs amélioré**:
  - 32 couleurs ajoutées dans la base de données (table `colors`)
  - Sélecteurs de palette corrigés: 5 menus distincts (Basiques+Tendances, Pastel, Vives, Professionnelles)
  - Affichage des noms de couleurs avec emoji au lieu du code hexadécimal
  - Script `scripts/verify-palette-colors.js` créé pour vérifier et ajouter les couleurs manquantes
  - Script `scripts/add-missing-colors.js` créé pour ajouter 18 couleurs couramment utilisées

#### **Fonctionnalités de personnalisation `/server-config`**
- **Labels clarifiés**:
  - "Couleur principale" → "Couleur du bot" (🤖)
  - "Couleur secondaire" → "Couleur des embeds" (📋)

- **Embeds de configuration**:
  - Tous les embeds utilisent maintenant `secondary_color` pour cohérence visuelle
  - Footer Loomix appliqué à tous les menus de configuration
  - Gestion améliorée des erreurs d'interaction Discord

### 🔧 Changed

#### **Architecture des footers**
- Remplacement de `branding.embed_footer_text` et `branding.embed_footer_icon_url` par appels à `getLoomixFooter()`
- Footers dynamiques préservés pour les infos importantes (rareté, date de collecte, etc.)
- Footers combinés: `${info_dynamique} • Powered by Loomix Bot`

#### **Sélecteurs de couleurs**
- Séparation des sélecteurs "Vives" et "Professionnelles" (auparavant combinés)
- Combinaison de "Basiques" et "Tendances 2025" pour respecter la limite Discord (5 ActionRows max)
- Description dans la palette mise à jour pour refléter les 5 catégories disponibles

#### **Couleurs des embeds**
- Menu principal: `primary_color` → `secondary_color`
- Menu branding: `primary_color` → `secondary_color`
- Menu paramètres: `primary_color` → `secondary_color`
- Menu modules: `primary_color` → `secondary_color`
- Couleurs dynamiques conservées pour les aperçus de sélection

### 📊 Database

#### **Nouvelles tables et migrations**
- 32 couleurs ajoutées à la table `colors` (noms, codes hex, emojis, catégories)
- Fonction `db.getColorByHex()` utilisée pour récupération des noms de couleurs
- Catégories: red, orange, yellow, green, blue, purple, pink, neutral, gold

#### **Couleurs ajoutées**
- **Basiques**: Bleu Ciel (#0099FF)
- **Tendances 2025**: Bleu Océan (#1ABC9C)
- **Pastel**: Rose, Bleu, Violet, Vert, Pêche, Lavande (6 couleurs)
- **Vives**: Vert Néon, Cyan Néon, Orange Fluo (3 couleurs)
- **Professionnelles**: Or Premium (#D4AF37)
- **Communes**: Rouge Alizarine, Rouge Brique, Orange Carotte, Vert Émeraude, Bleu Rivière, Violet Améthyste, Jaune Tournesol, et plus (18 au total)

### 📝 Files Modified
- `utils/footerHelper.js` - **CRÉÉ** - Helper centralisé pour les footers Loomix
- `handlers/mysteryBoxHandler.js` - 10 embeds mis à jour
- `handlers/missionHandler.js` - 14 embeds mis à jour
- `views/profileView.js` - 5 embeds mis à jour
- `handlers/modalHandler.js` - 4 embeds mis à jour (+ fix erreur syntaxe double déclaration)
- `handlers/serverConfigHandler.js` - 4 embeds + sélecteurs de couleurs corrigés
- `scripts/verify-palette-colors.js` - **CRÉÉ** - Vérification des couleurs des palettes
- `scripts/add-missing-colors.js` - **CRÉÉ** - Ajout de 18 couleurs manquantes
- `package.json` - Version mise à jour à 1.2.0

### 🎨 Visual Improvements
- Interface `/server-config` plus claire avec labels explicites
- Footers uniformes sur l'ensemble du bot avec branding Loomix
- Affichage des couleurs avec noms lisibles au lieu de codes hexadécimaux
- Cohérence visuelle améliorée avec utilisation de `secondary_color` pour tous les embeds de configuration

### 📊 Statistics
- **35+ embeds** mis à jour avec footer Loomix
- **32 couleurs** ajoutées à la base de données
- **5 sélecteurs** de couleurs distincts disponibles
- **4 fichiers handlers** modifiés
- **1 helper centralisé** créé pour les footers
- **2 scripts** de maintenance créés pour les couleurs

## [1.1.3] - 2025-11-14

### ✨ Added

#### **Nouveau Piège: "Perdre TOUS les Collectibles"**
- **Type**: `lose-all-collectibles` (6ème type de piège)
- **Description**: Un piège catastrophique qui fait perdre TOUS les collectibles d'un joueur en une seule fois
- **Personnalisation Blanche-Neige**: "Le Sortilège Ultime de la Reine" - La Reine jalouse lance son sortilège le plus puissant et efface toute la collection
- **Fonctionnalités**:
  - Retire tous les collectibles du joueur avec soft delete (préservation de l'historique)
  - Remet le compteur `collected_count` à 0
  - Annonce publique de la catastrophe avec nombre d'objets perdus
  - Message personnalisé avec la liste complète des objets perdus
- **Fichiers modifiés**:
  - `utils/trapDefaults.js` - Ajout du 6ème piège par défaut
  - `handlers/mysteryBoxHandler.js` - Ajout du case et méthode `applyTrapLoseAllCollectibles()`
  - `utils/announcements.js` - Ajout de la méthode `announceTrapLoseAllCollectiblesTriggered()`

#### **Scripts de migration**
- `scripts/migrations/update-traps-type-constraint.js` - Mise à jour de la contrainte CHECK pour autoriser le nouveau type
- `scripts/migrations/add-lose-all-trap.js` - Ajout automatique du piège à tous les thèmes (personnalisé pour Blanche-Neige)

### 🔧 Changed
- Contrainte CHECK sur `traps.type` mise à jour pour inclure `'lose-all-collectibles'`
- Template d'annonce `trap_lose_all_collectibles` créé en base de données

### 📊 Database
- 1 nouveau piège ajouté au thème Blanche-Neige
- 1 nouveau template d'annonce créé

## [1.1.2] - 2025-11-14

### 🐛 Fixed

#### **[CRITIQUE] Bug #1: Collectibles non attribués lors de la complétion de missions**
- **Problème**: Les missions complétées ne donnaient aucun collectible au joueur
- **Cause**: Appel à `db.addCollectible()` sans le 4ème paramètre obligatoire `source`
- **Impact**: 59 missions complétées sans récompense depuis le dernier reset
- **Solution**: Ajout du paramètre `source: 'mission'` à l'appel de `addCollectible()` (ligne 214)
- **Fichiers modifiés**: `events/messageCreate.js` (ligne 214)
- **Compensation**: 4 joueurs compensés manuellement (joris0237, pop_corn.1203, mimie34110)
- **Note**: olympe34370 avait déjà tous les collectibles du thème

#### **Bug #2: Messages de succès envoyés dans le mauvais thread**
- **Problème**: Quand un joueur avait plusieurs missions, le message de succès était envoyé dans le mauvais thread
- **Cause**: Fonction `findMissionThread()` cherchait par nom de joueur au lieu d'utiliser `thread_id` de la DB
- **Impact**: Confusion pour les joueurs (thread 1 affichait succès mais DB montrait échec, et vice-versa)
- **Exemple**: _so_fine_ avec 2 missions simultanées - threads 1438873799436013694 et 1438873923877077062
- **Solution**: Remplacement de la recherche par nom par fetch direct via `missionProgress.thread_id`
- **Fichiers modifiés**: `events/messageCreate.js` (lignes 327-350)
- **Bénéfice**: Code simplifié (40 lignes → 20 lignes) et 100% fiable

#### **Bug #3: Multiples missions validées pour un même mot-clé**
- **Problème**: Quand un joueur avait plusieurs missions avec le même mot-clé, toutes se validaient simultanément
- **Cause**: Boucle traitait TOUTES les missions correspondantes sans s'arrêter après la première
- **Impact**: Race conditions et états de DB incohérents
- **Solution**: Ajout de `break` statements après traitement de chaque mission (lignes 48, 53)
- **Fichiers modifiés**: `events/messageCreate.js` (lignes 48, 53)
- **Note**: Limite maintenant à UNE SEULE mission validée par mot-clé prononcé

### 📝 Added

#### Scripts de diagnostic et compensation
- `scripts/read-thread-messages.js` - Lecture complète d'un thread Discord avec embeds et boutons
- `scripts/check-second-mission-thread.js` - Analyse du second thread de mission pour debugging
- `scripts/analyze-double-mission-bug.js` - Diagnostic approfondi des missions simultanées avec même mot-clé
- `scripts/analyze-mission-structure.js` - Analyse complète de la structure des missions en DB
- `scripts/check-already-compensated.js` - Vérification des compensations déjà effectuées (évite doublons)
- `scripts/compensate-missing-missions.js` - Attribution intelligente avec vérification de collection complète

### 📊 Statistics
- **59 missions** affectées par Bug #1 (collectibles non donnés)
- **55 missions** déjà compensées manuellement avant le fix
- **4 joueurs** compensés par script automatique
- **3 bugs critiques** corrigés dans `events/messageCreate.js`
- **0 collections** complétées suite aux compensations (pas de rôle à attribuer)

## [1.1.1] - 2025-01-14

### 🐛 Fixed

#### **[CRITIQUE] Bug de race condition sur les boîtes mystères**
- **Problème**: Plusieurs utilisateurs pouvaient cliquer et gagner la même boîte mystère pendant le délai de traitement
- **Cause**: Aucune vérification entre `deferUpdate()` et l'attribution du gagnant dans `handleMysteryBoxOpen()`
- **Impact**: Plusieurs joueurs recevaient la récompense d'une même boîte
- **Solution**:
  - Vérification immédiate si la boîte a déjà un gagnant après `deferUpdate()` (lignes 216-228)
  - Attribution du gagnant IMMÉDIATEMENT avant le traitement de la révélation (ligne 244)
  - Message "Trop tard !" pour les clics tardifs
  - Suppression de l'appel dupliqué à `updateGiveWinner()` en fin de fonction
- **Fichiers modifiés**: `handlers/mysteryBoxHandler.js` (lignes 216-244, suppression ligne 309-310)
- **Déploiement**: Bot redémarré, annonce postée dans #discussion-blabla

#### **Bug: Disparition du bouton de boîte mystère**
- **Problème**: Le bouton "Ouvrir la boîte" disparaissait pour TOUS les utilisateurs quand un joueur sous cooldown cliquait
- **Cause**: `interaction.editReply({ components: [] })` modifiait le message original globalement
- **Impact**: Boîte mystère inutilisable pour les autres joueurs
- **Exemple**: Message ID 1438655639265087528 (contenait piège "La Sorcière Voleuse")
- **Solution**:
  - Suppression de `editReply()` qui modifiait le message global
  - Envoi uniquement d'un message éphémère (`flags: 64`) au joueur concerné
- **Fichiers modifiés**: `handlers/mysteryBoxHandler.js` (lignes 220-227)
- **Script de réparation**: `scripts/fix-missing-button.js` créé pour réparer les boîtes cassées

#### **Bug: Commande /profile après reset de base de données**
- **Problème**: Erreur `TypeError: db.createPlayer is not a function` pour tous les nouveaux joueurs
- **Cause**: Appel à une méthode inexistante `db.createPlayer()` au lieu de `db.upsertPlayer()`
- **Impact**: Commande `/profile` inutilisable pour les nouveaux joueurs après le reset
- **Solution**: Remplacement par `db.upsertPlayer()` qui existe dans le module database-pg
- **Fichiers modifiés**: `commands/player/profile.js` (lignes 30-34)
- **Note**: Bug découvert uniquement après reset car création de joueurs n'était pas testée avant

#### **Bug: Threads de mission non archivés automatiquement**
- **Problème**: Les threads Discord des missions complétées restaient ouverts au lieu d'être archivés
- **Threads affectés**:
  - `1438657149353066627` - amelie0335 (mission "prince") - Complétée 23:31:24
  - `1438649867831607316` - floerin (mission "miroir") - Complétée 23:01:53
  - `1438657495894851726` - _so_fine_ (mission "cercueil") - Complétée 23:32:52
- **Statut en DB**: Toutes marquées `status = 'completed'` avec `completed_at` renseigné
- **Solution**: Script d'archivage manuel créé et exécuté
- **Fichiers créés**: `scripts/archive-completed-threads.js`

#### **Bug: Récompenses de mission non distribuées**
- **Problème**: Les collectibles des missions "Mot Deviné" complétées n'étaient pas donnés aux joueurs
- **Missions affectées**: 3 missions du thème Blanche-Neige (theme_id: 23)
- **Joueurs concernés**:
  - **amelie0335** (ID: 310, Discord: 1202557237382479912)
  - **floerin** (ID: 313, Discord: 692649463805640724)
  - **_so_fine_** (ID: 492, Discord: 1344750102979416084)
- **Vérification**: Script de diagnostic confirmé - AUCUN collectible reçu autour de la date de complétion
- **Compensation effectuée**:
  - amelie0335 → **Dormeur** (epic) ⭐
  - floerin → **Simplet** (common)
  - _so_fine_ → **Simplet** (common)
- **Scripts créés**:
  - `scripts/check-stuck-missions.js` - Diagnostic des missions
  - `scripts/verify-mission-rewards.js` - Vérification des récompenses distribuées
  - `scripts/give-missing-rewards.js` - Attribution des compensations
  - `scripts/post-compensation-message.js` - Annonce aux joueurs
- **Annonce**: Message de compensation posté dans #discussion-blabla avec pings des joueurs

### 📝 Added

#### Scripts de diagnostic et maintenance
- `scripts/check-message.js` - Vérification du contenu d'un message de boîte mystère en base de données
- `scripts/fix-missing-button.js` - Réparation d'un message de boîte sans bouton (re-ajout du composant)
- `scripts/check-stuck-missions.js` - Diagnostic complet des missions bloquées avec détails DB
- `scripts/verify-mission-rewards.js` - Vérification de la distribution des récompenses de missions
- `scripts/archive-completed-threads.js` - Archivage manuel des threads Discord complétés
- `scripts/give-missing-rewards.js` - Attribution intelligente des récompenses manquantes (évite doublons)
- `scripts/post-compensation-message.js` - Annonce de compensation formatée avec pings
- `scripts/post-race-condition-fix.js` - Annonce de correction du bug de race condition

### 📊 Statistics
- **3 missions complétées** compensées
- **3 collectibles** distribués en compensation
- **3 progressions** mises à jour
- **3 threads** archivés manuellement
- **2 boîtes mystères** réparées (bouton re-ajouté)

## [1.1.0] - 2025-11-13

### ✨ Added
- **Système de versioning professionnel**
  - Fichier `VERSION` pour tracking de la version
  - Script `scripts/bump-version.js` pour automatisation (patch/minor/major)
  - Guide complet dans `VERSIONING_GUIDE.md`
  - Documentation rapide dans `docs/VERSIONING_QUICK_START.md`
  - Affichage de la version au démarrage du bot
  - Fichiers ajoutés: `VERSION`, `scripts/bump-version.js`, `VERSIONING_GUIDE.md`, `docs/VERSIONING_QUICK_START.md`

- **Intégration MCP (Model Context Protocol)**
  - Configuration GitHub MCP pour gestion de repos
  - Configuration N8N MCP pour automatisation
  - Configuration Hostinger MCP pour gestion VPS
  - Fichiers ajoutés: `.mcp.json`, `.mcp.json.example`

- **Documentation stratégique**
  - `docs/BRIEF_NOUVELLE_CONVERSATION.md` - Brief pour nouvelle session
  - `docs/SESSION_RECAP_2025-11-13.md` - Récapitulatif ultra-complet
  - `docs/STRATEGIE_LOOMIX_HUB.md` - Stratégie hub central et évolution modulaire
  - `docs/PLAN_RESTRUCTURATION_PROJET.md` - Plan de restructuration

- **Contexte Claude Code**
  - `.claude/context.md` - Règles et contexte pour Claude Code
  - Directives de versioning automatique
  - Instructions de maintenance du CHANGELOG

### 🔧 Changed
- **Restructuration complète du projet**
  - 197 fichiers à la racine → 9 fichiers essentiels
  - Organisation professionnelle en dossiers thématiques
  - `/archive` pour scripts événementiels (23 fichiers)
  - `/scripts` subdivisé en `/setup`, `/maintenance`, `/migrations`, `/compensation`
  - `/tools` subdivisé en `/checks`, `/analysis`, `/dev`
  - `/docs` avec sous-dossiers `/guides`, `/architecture`, `/deployment`, `/versioning`
  - Structure modulaire prête pour évolution vers Loomix Bot

- **Amélioration du .gitignore**
  - Protection des secrets (`.env`, `.mcp.json`)
  - Protection des fichiers système et cache
  - Section dédiée Claude Code
  - 130+ lignes de règles professionnelles

- **Git initialisé**
  - Repository local créé
  - Premier commit avec structure complète
  - Tag v1.0.0 créé
  - Prêt pour push vers GitHub

### 📝 Documentation
- README mis à jour avec nouvelle structure
- `.env.example` créé avec toutes les variables nécessaires
- `.mcp.json.example` créé pour template MCP
- Documentation complète de l'architecture
- Guides de déploiement actualisés

## [1.0.0] - 2025-11-13

### 🐛 Fixed
- **CRITIQUE**: Correction du bug de validation des missions
  - Le système ne pouvait pas donner de récompense aux joueurs qui avaient perdu des collectibles via un piège
  - Modification de `addCollectible()` pour utiliser `INSERT ... ON CONFLICT DO UPDATE`
  - Fichiers modifiés: `utils/database-pg.js` (lignes 727-734)

- Correction des interactions différées dans le panel admin
  - Fix de `showEditTemplateMenu()` pour gérer les états deferred/non-deferred
  - Fichiers modifiés: `handlers/adminPanelHandler.js` (lignes 4276-4281, 4436-4440)

- Correction du toggle manquant pour le piège "Boîte Vide"
  - Ajout du toggle dans le menu des annonces
  - Fichiers modifiés: `handlers/adminPanelHandler.js` (lignes 3874-3956)

### ✨ Added
- Système de pièges complet avec 6 types différents
  - Malédiction (délai d'attente)
  - Cooldown (temps avant nouvelle mission)
  - Perte de collectible
  - Honte publique (message dans le serveur)
  - Malus de points
  - Boîte vide (aucune récompense)

- Système d'annonces personnalisables pour chaque type de piège
- Templates d'annonces avec variables dynamiques
- Sélecteur multiple de pièges pour les annonces

### 🔄 Changed
- Amélioration de la gestion des collectibles perdus
- Synchronisation automatique des compteurs de progression
- Optimisation des requêtes de base de données

### 📊 Statistics
- 4 joueurs compensés pour le bug de validation
- 14 collectibles restaurés
- 13 récompenses de missions redistribuées

---

## [Non publié]

### ✨ Added
- **[Versioning]**: Système complet de versioning professionnel
  - Fichiers créés: `CHANGELOG.md`, `VERSION`, `VERSIONING_GUIDE.md`, `docs/VERSIONING_QUICK_START.md`
  - Script: `scripts/bump-version.js` pour automatiser les changements de version
  - Affichage de la version au démarrage du bot
  - Directives Claude intégrées dans `claude (Case conflict).md`

- **[GitHub]**: Préparation complète pour GitHub
  - Fichier `.gitignore` professionnel (130 lignes)
  - Template `.env.example` pour la configuration
  - Plan de restructuration détaillé: `docs/PLAN_RESTRUCTURATION_PROJET.md`
  - Guide complet architecture multi-bots: `docs/GUIDE_COMPLET_ARCHITECTURE_MULTI_BOTS.md`

### 🔄 Changed
- **[Bot]**: Affichage de la version au démarrage (📦 Version: v1.0.0)
  - Fichiers modifiés: `index.js` (lignes 8, 79)

- **[Structure]**: Restructuration complète du projet pour GitHub
  - **155 scripts JS organisés** dans une structure modulaire
  - **42 fichiers MD** classifiés et organisés
  - **Nouvelle arborescence**:
    - `tools/checks/` - 53 scripts de diagnostic (check-*, verify-*, diagnose-*)
    - `tools/analysis/` - 4 scripts d'analyse (analyze-*)
    - `tools/dev/` - 1 script de test
    - `scripts/maintenance/` - 20 scripts de maintenance (fix-*, clean-*, sync-*)
    - `scripts/migrations/` - 19 scripts de migration (run-*, migrate-*)
    - `scripts/compensation/` - 5 scripts de compensation
    - `scripts/setup/` - 28 scripts de configuration initiale
    - `archive/one-off/` - 23 scripts événementiels archivés
    - `docs/guides/` - Guides utilisateur
    - `docs/architecture/` - Documentation technique et rapports
    - `docs/deployment/` - Guides de déploiement
    - `docs/versioning/` - Documentation versioning
    - `database/schemas/` - Schémas SQL
    - `database/seeds/` - Données de test
  - **Racine propre**: Seulement 9 fichiers essentiels
  - ✅ Bot testé et fonctionnel après restructuration

### 🐛 Fixed
- **[Compensation]**: Compensation des joueurs affectés par le bug de validation
  - 4 joueurs compensés (floerin, amelie0335, sophiedg0739, xmicordix)
  - 14 collectibles restaurés
  - 13 récompenses de missions redistribuées
  - Scripts créés: `compensate-all-affected.js`, `check-over-compensation.js`

### 🗑️ Removed
- **[Cleanup]**: Suppression des fichiers obsolètes
  - Fichiers SQLite (`bot.db*`) - Migration PostgreSQL terminée
  - Backups temporaires (`*.backup.*`)
  - Fichiers temporaires (`nul`, `temp-*`)
  - Assets non utilisés (`s-l1600.webp`)

---

## [Non publié] - Prochaines versions

### 🎯 Prévu pour v1.1.0
- [ ] Système de classement avancé avec catégories
- [ ] Statistiques détaillées par joueur
- [ ] Export des données en CSV
- [ ] Notifications par email pour les administrateurs

### 🎯 Prévu pour v2.0.0
- [ ] Refonte du système de missions avec nouveaux types
- [ ] Interface web d'administration
- [ ] Support multi-langues
- [ ] API REST pour intégrations externes

---

## Format des entrées

Les types de changements utilisés :
- `Added` (✨) : Nouvelles fonctionnalités
- `Changed` (🔄) : Modifications de fonctionnalités existantes
- `Deprecated` (⚠️) : Fonctionnalités obsolètes (à retirer bientôt)
- `Removed` (🗑️) : Fonctionnalités retirées
- `Fixed` (🐛) : Corrections de bugs
- `Security` (🔒) : Corrections de vulnérabilités

---

## Liens

[1.0.0]: https://github.com/votre-repo/compare/v0.9.0...v1.0.0
