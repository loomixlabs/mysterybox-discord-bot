# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

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
