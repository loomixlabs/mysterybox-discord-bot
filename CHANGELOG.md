# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

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
