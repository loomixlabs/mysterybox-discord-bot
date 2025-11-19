# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### ✨ Added

#### **💫 Amélioration de l'Interface "/profile - Mes Bonus"**
- **Date**: 2025-11-19
- **Type**: MINOR - Amélioration UX
- **Description**: Refonte complète de l'affichage des super bonus dans le profil pour une meilleure lisibilité
- **Problèmes corrigés**:
  1. Duplication des statistiques en haut (supprimées)
  2. Manque de séparation visuelle entre les sections
  3. Titres peu visibles et non hiérarchisés
- **Améliorations appliquées** (Option 1):
  - ✅ Section **STATISTIQUES** en haut avec séparateur
  - ✅ Séparateurs visuels `━━━━━━━━━━━━━━━━━━━━━━━━━━` entre chaque section
  - ✅ Titres en majuscules avec compteurs: **✨ BONUS ACTIFS (4)** et **🎯 BONUS À ACTIVER (5)**
  - ✅ Descriptions complètes conservées pour chaque bonus
  - ✅ Hiérarchie claire: Statistiques → Actifs → À Activer
- **Fichiers modifiés**:
  - [views/profileView.js](views/profileView.js:645-729)
    - Ligne 650: Description simplifiée sans STATISTIQUES en haut (suppression doublon)
    - Lignes 684-695: Section "Bonus Actifs" avec séparateurs `━━━━━━━━━━━━━━━━━━━━━━━━━━`
    - Lignes 718-729: Section "Bonus à Activer" avec séparateurs et compteurs
- **Impact**: Interface beaucoup plus lisible et professionnelle avec une séparation claire entre les sections
- **Note**: Le doublon "Parrain/Marraine" signalé a été investigué et corrigé (voir section "Correction des Doublons de Super Bonus")

#### **🎯 Give Unique: Filtre des Super Bonus Actifs**
- **Date**: 2025-11-19
- **Type**: MINOR - Amélioration fonctionnelle
- **Description**: Filtrage automatique des super bonus actifs dans le Give Unique
- **Fonctionnalité**:
  - Lors de la sélection du mode "Envoyer un Super Bonus" dans Give Unique, seuls les super bonus **actifs** (is_enabled = TRUE) sont affichés
  - Message d'astuce si aucun bonus actif n'est disponible
  - Le panneau "Gérer les Super Bonuses" continue d'afficher TOUS les bonus (actifs et inactifs)
- **Fichiers modifiés**:
  - [utils/database-pg.js](utils/database-pg.js:960-980)
    - Ajout paramètre optionnel `activeOnly = false` à `getAllSuperBonuses()`
    - Filtre dynamique sur `is_enabled = TRUE` quand `activeOnly = true`
  - [handlers/giveUniqueHandler.js](handlers/giveUniqueHandler.js:260-300)
    - Appel avec `activeOnly = true` pour filtrer les bonus actifs
    - Message amélioré indiquant "X super bonus actifs" au lieu de "disponibles"
    - Description du select menu améliorée avec rareté visible
    - Message d'astuce si aucun bonus actif
  - [scripts/test-super-bonus-filter.js](scripts/test-super-bonus-filter.js) - Créé
    - Script de test pour vérifier le filtrage
- **Impact**:
  - ✅ Give Unique n'affiche que les bonus que l'admin peut effectivement envoyer
  - ✅ Évite la confusion avec des bonus désactivés
  - ✅ Panneau de gestion non affecté (continue à tout afficher)
- **Test**: 11 bonus totaux → 3 actifs affichés dans Give Unique ✅

### 🐛 Fixed

#### **📊 Correction du Comptage des Activations Super Bonuses**
- **Date**: 2025-11-19
- **Type**: PATCH - Correction de comptage et terminologie
- **Description**: Le panneau admin affichait "5 utilisateurs actifs" alors qu'aucun bonus n'avait été lancé
- **Problèmes corrigés**:
  1. Le compteur incluait les bonus inactifs (is_active = FALSE) et expirés
  2. La terminologie "utilisateurs actifs" était imprécise
  3. Présence de 5 entrées de test dans `player_active_bonuses` pour l'utilisateur 'floerin'
  4. Aucun moyen de voir le nombre de bonus inactifs
- **Fichiers modifiés**:
  - [handlers/superBonusHandler.js](handlers/superBonusHandler.js)
    - Lignes 1036-1040: Requête corrigée pour ne compter que les bonus vraiment actifs
      - Ajout filtre `is_active = TRUE`
      - Ajout filtre `expires_at IS NULL OR expires_at > NOW()`
    - Lignes 1067-1073: Ajout requête pour compter les bonus inactifs
    - Lignes 1084-1085: Statistiques affichant maintenant:
      - "X activation(s) en cours" au lieu de "X utilisateur(s) actif(s)"
      - "X bonus inactif(s)" (nouvelle métrique)
    - Ligne 1123: Footer mis à jour "👤 Activations en cours" au lieu de "Utilisateurs actifs"
  - [scripts/cleanup-floerin-test-bonuses.js](scripts/cleanup-floerin-test-bonuses.js) - Créé
    - Script de nettoyage des 5 bonus de test
- **Actions effectuées**:
  - ✅ Suppression des 5 bonus de test de 'floerin' (obtained_from = 'admin_test')
  - ✅ Compteur corrigé pour n'afficher que les activations vraiment actives
  - ✅ Ajout statistique des bonus inactifs (is_active = FALSE ou expirés)
  - ✅ Terminologie plus précise: "activations en cours" au lieu de "utilisateurs actifs"
- **Impact**: Les administrateurs voient maintenant le nombre réel de bonus actifs et peuvent aussi voir combien de bonus sont inactifs ou expirés

#### **🔧 Correction des Doublons de Super Bonus**
- **Date**: 2025-11-19
- **Type**: PATCH - Bug critique + Migration DB
- **Description**: Correction d'un bug permettant aux joueurs d'obtenir le même super bonus actif plusieurs fois simultanément
- **Problème détecté**:
  - L'utilisateur signalait "Parrain/Marraine apparaît 2 fois identique" dans `/profile - Mes Bonus`
  - Investigation révélée: **9 doublons** dans `player_active_bonuses` sur le serveur de test
  - Aucune contrainte n'empêchait les doublons lors de l'attribution via mystery boxes
- **Analyse**:
  - ✅ Aucun doublon dans `super_bonuses` (table de définition des bonus)
  - ❌ **Doublons détectés dans `player_active_bonuses`** (table d'attribution aux joueurs):
    - Vision Divine: 5 entrées (utilisateur xmicordix)
    - Jackpot x2: 5 entrées (utilisateur xmicordix)
    - Parrain/Marraine: 2 entrées (utilisateur xmicordix)
  - ✅ Serveur de production: Aucun doublon
- **Corrections appliquées**:
  1. **Nettoyage des doublons** (serveur de test):
     - ✅ 3 bonus conservés (premiers IDs)
     - ✅ 9 doublons supprimés
  2. **Migration DB** pour empêcher les doublons futurs:
     - ✅ Contrainte UNIQUE partielle ajoutée: `unique_active_bonus_per_player`
     - ✅ S'applique uniquement aux bonus actifs (`WHERE is_active = TRUE`)
     - ✅ Permet l'historique (bonus inactifs multiples autorisés)
- **Fichiers créés/modifiés**:
  - [database/migrations/add-unique-active-bonus-constraint.sql](database/migrations/add-unique-active-bonus-constraint.sql) - Créé
    - Index unique partiel sur `(guild_id, user_id, bonus_id) WHERE is_active = TRUE`
  - [scripts/check-player-bonuses-parrain.js](scripts/check-player-bonuses-parrain.js) - Créé
    - Script de diagnostic pour Parrain/Marraine spécifiquement
  - [scripts/check-all-bonus-duplicates.js](scripts/check-all-bonus-duplicates.js) - Créé
    - Script de vérification complète des doublons sur les deux serveurs
  - [scripts/cleanup-bonus-duplicates.js](scripts/cleanup-bonus-duplicates.js) - Créé
    - Script de nettoyage automatique conservant les premiers IDs
  - [scripts/run-add-unique-active-bonus-constraint.js](scripts/run-add-unique-active-bonus-constraint.js) - Créé
    - Script d'application de la migration
- **Protection ajoutée**:
  - ✅ Un joueur ne peut **PAS** avoir le même bonus actif 2 fois simultanément
  - ✅ Un joueur **PEUT** avoir plusieurs entrées inactives du même bonus (historique)
  - ✅ Protection multi-serveur via `guild_id`
- **Impact**: Le bug d'affichage de doublons dans `/profile` est corrigé et les futurs doublons sont impossible

#### **🎮 Amélioration de l'Interface Super Bonuses**
- **Date**: 2025-11-19
- **Type**: PATCH - Corrections d'interface et UX
- **Description**: Corrections multiples de l'interface de gestion des super bonuses
- **Problèmes corrigés**:
  1. Les boutons "Modifier Durée/Charges" et "Modifier Raretés" avaient disparu
  2. Le sélecteur ne fonctionnait pas (erreur de routing)
  3. Les boutons "Tout Activer/Désactiver" ne fonctionnaient pas
  4. Messages de confirmation séparés au lieu de rafraîchissement direct
  5. Erreurs de double defer causant des échecs d'interaction
- **Fichiers modifiés**:
  - [handlers/superBonusHandler.js](handlers/superBonusHandler.js) - Corrections multiples
    - Lignes 1017-1020: Vérification defer avant deferUpdate (éviter double defer)
    - Lignes 1152-1163: Ajout row3 avec les 2 boutons d'édition
    - Lignes 1145: Suppression bouton Rafraîchir (rafraîchissement auto)
    - Lignes 1206-1207, 1222-1223, 1242-1243: Suppression followUp de confirmation
  - [events/interactionCreate.js](events/interactionCreate.js)
    - Ligne 160: Ajout `super_bonus_` dans routing boutons admin
    - Ligne 283: Ajout `super_bonus_` dans routing select menus
  - [handlers/adminPanelHandler.js](handlers/adminPanelHandler.js)
    - Lignes 82-87, 92: Nettoyage routing `super_bonus_refresh`
- **Améliorations UX**:
  - ✅ Rafraîchissement automatique et instantané du panneau après chaque action
  - ✅ Plus de messages de confirmation séparés (mise à jour directe)
  - ✅ Bouton Rafraîchir supprimé (devenu inutile)
  - ✅ Expérience fluide sans erreurs d'interaction
- **Interface finale**:
  - Row 1: Sélecteur (toggle activation/désactivation instantané)
  - Row 2: 🟢 Tout Activer | 🔴 Tout Désactiver | 🔙 Retour
  - Row 3: ⏱️ Modifier Durée/Charges | 🎨 Modifier Raretés

#### **🎭 Bug Critique: Attribution Automatique des Rôles de Collection**
- **Date**: 2025-11-19
- **Type**: PATCH - Correction de bug critique
- **Severity**: 🔴 CRITIQUE - Aucun joueur ne recevait son rôle de récompense
- **Description**: Les joueurs complétant leur collection ne recevaient pas automatiquement leur rôle de récompense
- **Cause**: Le code cherchait le rôle par **nom** (`final_role_name`) au lieu de l'**ID Discord** (`final_role_discord_id`), causant des échecs silencieux
- **Impact**:
  - Affectait **3 handlers** (mysteryBoxHandler, missionHandler, giveHandler)
  - 5 joueurs ont dû recevoir manuellement leur rôle via script de correction
  - Bug présent depuis la création du système de thèmes
- **Fichiers modifiés**:
  - [utils/database-pg.js](utils/database-pg.js) (lignes 346-356) - Ajout `final_role_discord_id` dans `getCollectibleById()`
  - [handlers/mysteryBoxHandler.js](handlers/mysteryBoxHandler.js) (lignes 1410-1430) - Utilisation `.get(id)` au lieu de `.find(name)`
  - [handlers/missionHandler.js](handlers/missionHandler.js) (lignes 671-688) - Utilisation `.get(id)` au lieu de `.find(name)`
  - [handlers/giveHandler.js](handlers/giveHandler.js) (lignes 338-354) - Utilisation `.get(id)` au lieu de `.find(name)`
- **Fichiers créés**:
  - [scripts/check-aurelie0419-role.js](scripts/check-aurelie0419-role.js) - Vérification et correction du joueur initial
  - [scripts/fix-all-completed-players-roles.js](scripts/fix-all-completed-players-roles.js) - Correction des 5 joueurs affectés
  - [scripts/check-final-role-discord-id.js](scripts/check-final-role-discord-id.js) - Vérification structure DB
- **Solution**:
  ```javascript
  // ❌ AVANT (recherche par nom - échec silencieux)
  const finalRole = guild.roles.cache.find(r => r.name === theme.final_role_name);

  // ✅ APRÈS (recherche par ID Discord - fiable)
  const finalRole = guild.roles.cache.get(theme.final_role_discord_id);
  ```
- **Améliorations**:
  - Ajout de try-catch pour gestion d'erreurs
  - Logs détaillés lors de l'attribution (succès/échec)
  - Vérification existence du rôle avant attribution
  - Messages d'erreur explicites si rôle introuvable
- **Joueurs corrigés manuellement**:
  - aurelie0419 (1188059381233897534) - 19/11/2025 16:18
  - _so_fine_ (1344750102979416084) - 17/11/2025 19:35
  - floerin (692649463805640724) - 16/11/2025 22:54
  - vincent_0508 (1181345369003655168) - 14/11/2025 12:49
  - olympe34370 (1248027211689234535) - 13/11/2025 22:59

### 🔄 Changed
_(Aucune modification en attente)_

---

## [1.5.0] - 2025-11-19

### ✨ Added

#### **⭐ Système de Gestion des Super Bonuses (Activation/Désactivation)**
- **Date**: 2025-11-19
- **Type**: MINOR - Nouvelle fonctionnalité d'administration
- **Description**: Nouveau système permettant aux admins d'activer/désactiver individuellement chaque super bonus via une interface graphique moderne
- **Fichiers créés**:
  - [database/migrations/add-super-bonus-is-enabled.sql](database/migrations/add-super-bonus-is-enabled.sql) - Migration colonne `is_enabled`
  - [scripts/run-add-super-bonus-is-enabled.js](scripts/run-add-super-bonus-is-enabled.js) - Exécution migration
  - [scripts/list-super-bonuses-status.js](scripts/list-super-bonuses-status.js) - Monitoring status bonus
- **Fichiers modifiés**:
  - [handlers/superBonusHandler.js](handlers/superBonusHandler.js) (lignes 1008-1283) - 4 nouvelles fonctions admin
  - [handlers/adminPanelHandler.js](handlers/adminPanelHandler.js) (lignes 81-108, 514-518) - Routing boutons et select menu
  - [handlers/mysteryBoxHandler.js](handlers/mysteryBoxHandler.js) (lignes 105, 350) - Filtrage bonus activés uniquement
- **Fonctionnalités**:
  - **Interface admin moderne (Discord 2025)**:
    - Design sombre (#2B2D31 Onyx)
    - Statistiques ANSI colorées: 🟢 activés | 🔴 désactivés | 👥 utilisateurs actifs
    - Liste groupée par rareté (🌟💜💎⚪) avec Unicode separators (━)
    - Badges visuels: Status (🟢/🔴), Mode (⚡/🎯), Utilisateurs (👤 count)
  - **Gestion individuelle**:
    - Select menu pour toggle individuel (max 25 bonus)
    - Affichage du nom, rareté, type d'effet, mode d'activation
    - Compteur d'utilisateurs actifs en temps réel
  - **Actions globales**:
    - 🟢 Tout Activer - Active tous les bonus en un clic
    - 🔴 Tout Désactiver - Désactive tous les bonus en un clic
    - 🔄 Rafraîchir - Recharge l'interface
    - 🔙 Retour - Retour au menu Paramétrage
  - **Filtrage automatique**:
    - Mystery boxes ne distribuent QUE les bonus avec `is_enabled = TRUE`
    - Vérification à 2 niveaux: sélection (ligne 105) + count (ligne 350)
  - **Index optimisé**: `idx_super_bonuses_is_enabled` sur `(guild_id, is_enabled)`
- **Database**:
  - Nouvelle colonne `is_enabled` (BOOLEAN DEFAULT TRUE NOT NULL)
  - 23 bonus existants passés à `TRUE` par défaut lors de la migration
  - Commentaire SQL explicatif sur la colonne
- **Accès**: `/admin-panel` → Paramétrage → "⭐ Gérer les Super Bonus"
- **Impact**:
  - Contrôle fin de la distribution des super bonuses
  - Possibilité de désactiver temporairement un bonus sans le supprimer
  - Interface moderne suivant les dernières tendances Discord 2025
  - Zero impact sur les bonus déjà actifs chez les joueurs

#### **🎁 Mystery Box - Archivage Automatique des Messages de Félicitation**
- **Date**: 2025-11-18
- **Type**: MINOR - Nouvelle fonctionnalité
- **Description**: Ajout d'un toggle dans le panneau admin pour activer/désactiver la suppression automatique du message de félicitation après ouverture de mystery box (après 10 secondes)
- **Problème résolu**: Les messages de félicitation polluaient les salons quand de nombreuses mystery boxes étaient envoyées
- **Fichiers créés**:
  - [database/migrations/add-auto-delete-celebration.sql](database/migrations/add-auto-delete-celebration.sql) - Migration SQL
  - [scripts/run-add-auto-delete-celebration.js](scripts/run-add-auto-delete-celebration.js) - Script d'exécution
- **Fichiers modifiés**:
  - [handlers/mysteryBoxHandler.js](handlers/mysteryBoxHandler.js) (lignes 535-546, 1534-1545) - Logique de suppression après 10s (flow normal + Vision Divine)
  - [handlers/adminPanelHandler.js](handlers/adminPanelHandler.js) (lignes 160-161, 1039-1180, 2886) - Menu redesigné et toggle
  - [events/interactionCreate.js](events/interactionCreate.js) (ligne 160) - Routing du bouton `mystery_box_`
- **Fonctionnalités**:
  - Nouvelle colonne `auto_delete_celebration_message` dans `theme_config`
  - Menu "🎁 Gérer la Mystery Box" complètement redesigné avec :
    - Barres de progression des probabilités (collectibles, missions, pièges, super bonus)
    - Informations sur l'apparence de la mystery box
    - Statut de personnalisation du message de célébration
    - Toggle d'archivage automatique avec indicateur visuel (🟢/⚪)
  - Fonction `toggleAutoDeleteCelebration()` avec audit logging
  - Suppression automatique après 10 secondes si toggle activé
  - **Compatible avec Vision Divine** : Fonctionne aussi quand le joueur accepte une boîte après révélation
- **Usage**: `/admin-panel` → Paramétrage → "🎁 Gérer la Mystery Box" → Toggle "Archivage auto"
- **Bugs corrigés pendant l'implémentation**:
  - Routing manquant pour `mystery_box_` dans interactionCreate.js
  - Requête SQL avec colonne inexistante `updated_at`
  - Appel incorrect à `audit.logAction` au lieu de `audit.logAdminAction`

### 🐛 Fixed

#### **🔴 CRITIQUE - Mission "Mot Deviné" Bloquée (Initialisation Incomplète)**
- **Date**: 2025-11-19
- **Type**: PATCH - Réparation de mission bloquée
- **Thread affecté**: 1440615770626195498 (Monopoly Friends - Production)
- **Joueur**: alias1830 (Discord ID: 1191426533756252250)
- **Mission Progress ID**: 268
- **Problème**: Mission "Mot Deviné" créée mais jamais initialisée correctement
  - `target_keyword`: NULL (devait être "Joyeux")
  - `target_channel_id`: NULL (devait être le canal parent)
  - `expires_at`: 1970-01-01 (epoch 0 - timestamp invalide)
- **Cause**: Conséquence du race condition précédemment corrigé, mais affectant la phase d'initialisation des paramètres
- **Impact**:
  - Mission visible dans le thread mais non surveillée par le bot
  - Joueur ne pouvait pas compléter la mission car aucun mot assigné
  - Mission expirée depuis 1970 selon la base de données
- **Diagnostic créé**:
  - [scripts/analyze-stuck-mission-1440615770626195498.js](scripts/analyze-stuck-mission-1440615770626195498.js) - Analyse complète de la mission
- **Solution appliquée**:
  - [scripts/fix-mission-1440615770626195498.js](scripts/fix-mission-1440615770626195498.js) - Script de réparation
  - Assignation du keyword "Joyeux"
  - Configuration du canal cible (1420779903179292753)
  - Calcul d'une nouvelle expiration valide (22/11/2025 03:54:14)
  - Renvoi du message d'instruction dans le thread
- **Résultat**: ✅ Mission réparée avec succès - Le joueur peut maintenant la compléter

#### **🔴 CRITIQUE - Mission Progress Non Créé (Race Condition)**
- **Date**: 2025-11-18
- **Type**: PATCH - Bug critique de création de mission
- **Problème**: Lors de la révélation d'une mission depuis une mystery box, `db.createMissionProgress()` était appelé APRÈS `thread.send()`. Si `thread.send()` échouait ou timeout, l'exécution s'arrêtait avant la création du mission_progress
- **Impact**:
  - Thread créé avec bouton "Lancer la mission" visible
  - MAIS aucun mission_progress en base de données
  - Clic sur le bouton → Erreur "❌ Progression de mission introuvable"
  - Joueur bloqué, mission impossible à démarrer
- **Cause racine**: `thread.send()` (ligne 875) peut échouer (erreur réseau, timeout Discord), interrompant l'exécution avant `createMissionProgress()` (ligne 878)
- **Fichiers modifiés**:
  - [handlers/mysteryBoxHandler.js](handlers/mysteryBoxHandler.js) (lignes 871-879)
- **Solution**:
  - Déplacé `db.createMissionProgress()` AVANT `thread.send()`
  - Garantit que mission_progress existe en base AVANT d'envoyer le message au joueur
  - Si `thread.send()` échoue, on peut retrouver le mission_progress et créer un nouveau bouton
- **Résultat**: Mission progress toujours créé, même si l'envoi du message échoue

#### **🔴 CRITIQUE - Thread de Mission Non Fermé (Problème de Cache Discord.js)**
- **Date**: 2025-11-18
- **Type**: PATCH - Bug critique de cache Discord.js
- **Problème**: Quand un joueur dit lui-même le mot dans une mission "Mot Deviné", la mission échoue correctement, mais le thread privé ne se ferme pas automatiquement pour les threads créés APRÈS le redémarrage du bot
- **Impact**:
  - Thread reste ouvert indéfiniment
  - Message d'échec non envoyé dans le thread
  - Joueur ne reçoit pas la notification d'échec dans le thread
  - **ERREUR**: `⚠️ Thread XXXXXX introuvable: Unknown Channel`
- **Cause racine**: `guild.channels.fetch()` utilise le **CACHE** du guild et ne trouve PAS les threads créés après le redémarrage du bot. Discord.js ne met pas automatiquement les nouveaux threads dans le cache du guild.
- **Investigation détaillée**:
  - Thread créé AVANT redémarrage → Trouvé via `guild.channels.fetch()` ✅
  - Thread créé APRÈS redémarrage → "Unknown Channel" via `guild.channels.fetch()` ❌
  - Les deux types de threads existent toujours sur Discord
  - Le problème est uniquement lié au cache local du bot
- **Fichiers modifiés**:
  - [events/messageCreate.js](events/messageCreate.js) (ligne 345)
- **Solution**:
  - Utiliser `guild.client.channels.fetch()` au lieu de `guild.channels.fetch()`
  - `client.channels.fetch()` fait un appel API direct à Discord SANS passer par le cache
  - Ajout de commentaire explicatif sur la différence cache vs API
- **Résultat**: Thread trouvé correctement (même après redémarrage), message d'échec envoyé, thread archivé après 30 secondes
- **Note**: Le premier fix (`guild.channels.fetch()`) était INCORRECT - il a été inversé pour revenir à `guild.client.channels.fetch()`

#### **Descriptions Hardcodées des Super Bonuses**
- **Date**: 2025-11-18
- **Type**: PATCH - Correction de descriptions incohérentes
- **Problème**: Les descriptions des super bonuses contenaient des durées/charges hardcodées (ex: "pendant 7 jours", "(1 utilisation)") qui ne reflétaient pas les vraies valeurs configurables en base de données
- **Impact**:
  - Confusion pour les joueurs (description dit "48h" mais vraie valeur peut être différente)
  - Impossible de modifier durées via admin panel sans créer incohérence
  - Descriptions devenaient fausses dès qu'un admin changeait la configuration
- **Fichiers modifiés**:
  - [utils/database-pg.js](utils/database-pg.js) (lignes 1781, 1794, 1807, 1820, 1846, 1885, 1911)
  - [database/migrations/fix-super-bonus-descriptions.sql](database/migrations/fix-super-bonus-descriptions.sql) - Nouveau fichier
  - [scripts/run-fix-super-bonus-descriptions.js](scripts/run-fix-super-bonus-descriptions.js) - Nouveau script
- **Bonuses corrigés** (7/11):
  1. 🎰 **Chance du Diable**: Retiré "pendant 7 jours !"
  2. 👁️ **Vision Divine**: Retiré "(1 utilisation)"
  3. 🧲 **Aimant à Légendaires**: Retiré "(3 jours)"
  4. 👑 **Aura de Célébrité**: Retiré "(48h)"
  5. 🔍 **Détecteur de Pièges**: Retiré "pendant 48h"
  6. 🤝 **Parrain/Marraine**: Retiré "(5 jours)"
  7. 💎 **Assurance Collector**: Retiré "(1 utilisation)"
- **Solution**:
  - Migration SQL pour nettoyer les descriptions existantes en DB (7 requêtes UPDATE)
  - Modification de `installSuperBonuses()` pour futurs serveurs
  - Descriptions maintenant propres et génériques (durée/charges affichées séparément dynamiquement)
- **Résultat**:
  - Single source of truth (base de données, pas descriptions)
  - Admins peuvent modifier durées sans créer incohérence
  - Descriptions restent valides quelle que soit la configuration
- **Documentation**:
  - [ANALYSE-DESCRIPTIONS-SUPER-BONUS.md](ANALYSE-DESCRIPTIONS-SUPER-BONUS.md) - Analyse complète du problème
  - [FIX-DESCRIPTIONS-SUPER-BONUS-RESUME.md](FIX-DESCRIPTIONS-SUPER-BONUS-RESUME.md) - Résumé de la correction
- **Migration exécutée**: ✅ 7 bonus corrigés sur 2 serveurs (prod + test)

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
