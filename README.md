# 🎁 MysteryBox Discord Bot

**Bot Discord multi-serveur avec système de collectibles, missions et pièges thématiques**

[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](https://github.com/loomixlabs/mysterybox-discord-bot)
[![Discord.js](https://img.shields.io/badge/discord.js-v14.16-blue.svg)](https://discord.js.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/node.js-20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 📋 Table des Matières

- [Fonctionnalités](#-fonctionnalités)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Commandes](#-commandes)
- [Structure de la Base de Données](#️-base-de-données)
- [Développement](#-développement)
- [Déploiement](#-déploiement)

---

## ✨ Fonctionnalités

### 🎮 Système de Jeu

- **Collectibles avec Raretés**
  - 5 niveaux de rareté (Common → Legendary)
  - Collection progressive avec objectifs
  - Système de perte/récupération via pièges

- **Système de Missions**
  - Missions à mots-clés (détection automatique dans les messages)
  - Quiz interactifs avec réponses multiples
  - Challenges avec validation manuelle
  - Threads privés pour chaque mission
  - Timeouts configurables
  - Difficulté ajustable (facile, moyen, difficile)

- **Système de Pièges** (6 types)
  - 🔮 Malédiction (délai d'attente)
  - ⏰ Cooldown (temps avant nouvelle mission)
  - 💔 Perte de collectible
  - 😳 Honte publique (annonce dans le serveur)
  - 📉 Malus de points
  - 📦 Boîte vide (aucune récompense)

### 🏆 Progression et Compétition

- **Profils Joueurs Interactifs**
  - Statistiques détaillées
  - Collection complète avec preview
  - Historique des acquisitions
  - **Interface "Mes Bonus" redesignée** avec séparateurs visuels clairs
  - Distinction bonus automatiques vs manuels
  - Boutons d'activation pour bonus manuels

- **Leaderboard en Temps Réel**
  - Classement par nombre de collectibles
  - Tri par rareté
  - Mise à jour automatique

- **Système de Super Bonus** (11 bonus uniques)
  - **👁️ Vision Divine** - Révèle le contenu d'une mystery box avant ouverture
  - **💰 Jackpot x2** - Double les collectibles lors de l'ouverture
  - **🧲 Aimant à Légendaires** - +50% de chance d'obtenir des légendaires
  - Bonus automatiques (activation instantanée) vs manuels (activation au choix)
  - Système de charges et de durées configurables
  - Interface `/profile → Mes Bonus` pour gérer tous les bonus
  - Activation/désactivation par les admins
  - Système de cumul pour bonus multiples

### 🎯 Système de Campagnes

- **Campagnes Programmées**
  - Planification avec dates de début/fin
  - Gestion automatique des mystery boxes
  - Probabilités personnalisables (collectibles, missions, pièges)
  - Initialisation et nettoyage automatiques

### 🎨 Thèmes Personnalisables

- **Gestion des Thèmes**
  - Thèmes avec durée limitée ou illimitée
  - Expiration automatique avec notifications
  - Rôle final personnalisé (nom, couleur)
  - Configuration complète via interface

### 🛠️ Administration

- **Panel Admin Complet** (`/admin-panel`)
  - Gestion des collectibles (création, modification, suppression)
  - Gestion des pièges
  - **Gestion des Super Bonus** (activation/désactivation, modification durées/charges/raretés)
  - Configuration des annonces personnalisées
  - Gestion des campagnes
  - **Archivage automatique** des messages de félicitation Mystery Box
  - Templates d'annonces avec variables dynamiques
  - Interface moderne avec rafraîchissement automatique

- **Setup Wizard** (`/setup`)
  - Configuration initiale guidée du serveur
  - Création automatique des structures de base
  - Vérification des permissions

- **Super Admin Panel** (`/super-admin-panel`)
  - Gestion multi-serveur
  - Statistiques globales
  - Audit logs complets
  - Administration des guilds

### 🔒 Sécurité et Traçabilité

- **Audit Logs**
  - Tracking de toutes les actions admin
  - Historique des modifications
  - Traçabilité complète

- **Permissions Granulaires**
  - Rôles Co-Fondateurs pour les admins
  - Super Admins pour la gestion globale
  - Protection des commandes sensibles

### 🌐 Multi-Serveur

- **Support Multi-Guild**
  - Isolation complète des données par serveur
  - Configuration indépendante par guild
  - Statistiques par serveur
  - Gestion centralisée via super admin panel

---

## 🏗️ Architecture

### Structure du Projet

```
mysterybox-discord-bot/
├── 📁 commands/              # Commandes slash Discord
│   ├── admin/               # Commandes administrateur
│   │   ├── admin-panel.js  # Panel d'administration complet
│   │   └── setup.js        # Wizard de configuration
│   ├── player/             # Commandes joueur
│   │   ├── profile.js      # Profil interactif
│   │   ├── leaderboard.js  # Classement
│   │   └── my-bonuses.js   # Super bonus actifs
│   └── superadmin/         # Commandes super admin
│       └── super-admin-panel.js
│
├── 📁 events/               # Événements Discord.js
│   ├── ready.js            # Bot prêt
│   ├── interactionCreate.js # Gestion des interactions
│   ├── messageCreate.js    # Détection missions mots-clés
│   └── messageReactionAdd.js # Jeu de la pomme enchantée
│
├── 📁 handlers/             # Logique métier
│   ├── adminPanelHandler.js      # Interface admin
│   ├── campaignHandler.js        # Gestion campagnes
│   ├── campaignAdminHandler.js   # Admin campagnes
│   ├── giveHandler.js            # Système de give
│   ├── giveUniqueHandler.js      # Give unique
│   ├── missionHandler.js         # Missions
│   ├── modalHandler.js           # Modals Discord
│   ├── mysteryBoxHandler.js      # Mystery boxes
│   ├── profileHandler.js         # Profils joueurs
│   ├── setupHandler.js           # Setup wizard
│   ├── superAdminHandler.js      # Super admin
│   ├── superBonusHandler.js      # Super bonus
│   ├── themeExpirationHandler.js # Expiration thèmes
│   └── trapAdminHandler.js       # Admin pièges
│
├── 📁 database/             # Base de données
│   ├── migrations/         # Migrations SQL
│   ├── schemas/            # Schémas et updates
│   └── schema-v3-multiserver-postgresql.sql # Schéma complet
│
├── 📁 scripts/             # Scripts utilitaires
│   ├── setup/             # Scripts de setup (28 fichiers)
│   ├── maintenance/       # Scripts de maintenance (20 fichiers)
│   ├── migrations/        # Scripts de migration (19 fichiers)
│   ├── compensation/      # Scripts de compensation (5 fichiers)
│   └── bump-version.js    # Gestion des versions
│
├── 📁 tools/               # Outils de diagnostic
│   ├── checks/            # Scripts de vérification (53 fichiers)
│   ├── analysis/          # Scripts d'analyse (4 fichiers)
│   └── dev/               # Scripts de développement
│
├── 📁 utils/               # Utilitaires
│   ├── database-pg.js     # Connexion PostgreSQL
│   ├── permissions.js     # Gestion permissions
│   ├── guildConfig.js     # Configuration guild
│   ├── auditLogger.js     # Logs d'audit
│   ├── announcements.js   # Système d'annonces
│   └── ...
│
├── 📁 views/               # Templates UI
│   └── profileView.js     # Vue du profil
│
├── 📁 archive/             # Scripts événementiels
│   └── one-off/           # Scripts ponctuels (23 fichiers)
│
├── 📄 index.js             # Point d'entrée
├── 📄 package.json         # Dépendances
├── 📄 VERSION              # Version actuelle
├── 📄 CHANGELOG.md         # Historique des versions
├── 📄 VERSIONING_GUIDE.md  # Guide de versioning
├── 📄 .env.example         # Template configuration
├── 📄 .gitignore           # Fichiers ignorés
├── 🐳 Dockerfile           # Image Docker
└── 🐳 docker-compose.yml   # Composition Docker
```

### Technologies Utilisées

| Composant | Technologie | Version |
|-----------|-------------|---------|
| **Runtime** | Node.js | 20+ |
| **Bot Framework** | Discord.js | 14.16.3 |
| **Base de Données** | PostgreSQL | 16+ |
| **Scheduling** | node-cron | 3.0.3 |
| **Environment** | dotenv | 16.4.5 |

---

## 🚀 Installation

### Prérequis

- **Node.js** 20+ ([télécharger](https://nodejs.org/))
- **PostgreSQL** 16+ ([télécharger](https://www.postgresql.org/download/))
- **Git** ([télécharger](https://git-scm.com/))
- **Compte Discord Developer** ([créer](https://discord.com/developers/applications))

### 1. Cloner le Projet

```bash
git clone https://github.com/loomixlabs/mysterybox-discord-bot.git
cd mysterybox-discord-bot
```

### 2. Installer les Dépendances

```bash
npm install
```

### 3. Configuration PostgreSQL

#### Windows (avec PostgreSQL installé)

```powershell
# Se connecter à PostgreSQL
psql -U postgres

# Créer la base de données et l'utilisateur
CREATE DATABASE botdb;
CREATE USER botuser WITH ENCRYPTED PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE botdb TO botuser;

# Se connecter à la nouvelle base
\c botdb

# Importer le schéma
\i database/schema-v3-multiserver-postgresql.sql
```

#### Linux/Mac

```bash
# Créer la base et l'utilisateur
sudo -u postgres psql

CREATE DATABASE botdb;
CREATE USER botuser WITH ENCRYPTED PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE botdb TO botuser;
\q

# Importer le schéma
psql -U botuser -d botdb -f database/schema-v3-multiserver-postgresql.sql
```

### 4. Configuration du Bot Discord

1. Aller sur https://discord.com/developers/applications
2. Créer une nouvelle application
3. Onglet "Bot" → Créer un bot
4. Copier le **Token**
5. Onglet "OAuth2" → Copier **Application ID**
6. Activer les **Intents** nécessaires:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent

### 5. Inviter le Bot

URL d'invitation (remplacer `APPLICATION_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=APPLICATION_ID&permissions=8&scope=bot%20applications.commands
```

### 6. Configuration Environnement

Copier le template:
```bash
cp .env.example .env
```

Éditer `.env` avec vos valeurs:
```env
# Discord
DISCORD_TOKEN=votre_token_bot
APPLICATION_ID=votre_app_id
GUILD_ID=id_serveur_test

# PostgreSQL
DATABASE_URL=postgresql://botuser:votre_password@localhost:5432/botdb

# Permissions
CO_FOUNDER_ROLE_ID=id_role_cofondateur

# Salons
ANNOUNCE_CHANNEL_ID=id_salon_annonces
GIVE_CATEGORY_ID=id_categorie_gives

# Super Admin
OWNER_DISCORD_ID=votre_discord_id
```

### 7. Déployer les Commandes Slash

```bash
# Déployer sur un serveur spécifique (rapide, pour test)
node scripts/setup/deploy-commands-guild.js

# OU déployer globalement (lent, 1h de propagation)
node scripts/setup/deploy-commands.js
```

### 8. Lancer le Bot

```bash
npm start
```

Vous devriez voir:
```
🤖 Bot connecté à Discord !
📦 Version: v1.1.0
✅ Database connected: 2025-11-13T...
✅ Bot prêt ! Connecté en tant que BotName#1234
🚀 Le bot est opérationnel !
```

---

## ⚙️ Configuration

### Configuration Initiale du Serveur

Utiliser la commande `/setup` pour configurer automatiquement le serveur:

1. Créer les rôles de base
2. Configurer les salons
3. Initialiser le premier thème
4. Configurer les permissions

### Configuration Avancée via `/admin-panel`

Le panel admin permet de:
- Gérer les collectibles (créer, modifier, supprimer)
- Configurer les pièges
- Personnaliser les annonces
- Gérer les campagnes
- Voir les statistiques

---

## 📱 Commandes

### 👥 Commandes Joueur

| Commande | Description | Utilisation |
|----------|-------------|-------------|
| `/profile` | Voir sa progression et statistiques | Interface interactive avec boutons |
| `/leaderboard` | Classement des meilleurs chasseurs | Affichage du top joueurs |
| `/my-bonuses` | Voir les super bonus actifs | Liste des bonus temporaires |

### 🔧 Commandes Admin (Co-Fondateurs)

| Commande | Description | Permissions Requises |
|----------|-------------|---------------------|
| `/admin-panel` | Panel d'administration complet | Rôle Co-Fondateur |
| `/setup` | Configuration initiale du serveur | Rôle Co-Fondateur |

**Fonctionnalités du `/admin-panel`**:
- 📦 Gestion des Collectibles
- 🎯 Gestion des Pièges
- 📢 Configuration des Annonces
- 📅 Gestion des Campagnes
- 📊 Statistiques du Serveur

### 👑 Commandes Super Admin

| Commande | Description | Permissions Requises |
|----------|-------------|---------------------|
| `/super-admin-panel` | Gestion multi-serveur | Super Admin uniquement |

**Fonctionnalités**:
- 🌐 Vue globale de tous les serveurs
- 📊 Statistiques agrégées
- 📝 Audit logs complets
- ⚙️ Configuration des guilds

---

## 🗄️ Base de Données

### Schéma PostgreSQL Multi-Serveur

Le bot utilise PostgreSQL avec isolation complète des données par serveur Discord.

### Tables Principales

#### Gestion Multi-Serveur
- `super_admins` - Super administrateurs du bot
- `guild_config` - Configuration par serveur Discord
- `guild_stats` - Statistiques par serveur
- `guild_admin_roles` - Rôles admin par guild

#### Système de Thèmes
- `themes` - Thèmes de jeu
- `theme_config` - Probabilités et configuration
- `theme_messages` - Messages personnalisables

#### Collectibles et Missions
- `collectibles` - Items à collecter
- `missions` - Missions disponibles
- `mission_keywords` - Mots-clés pour détection auto
- `quiz_questions` - Questions pour quiz

#### Pièges
- `traps` - Pièges disponibles
- `trap_messages` - Messages personnalisables

#### Joueurs et Progression
- `players` - Joueurs enregistrés
- `collections` - Items collectés par joueur
- `player_progress` - Progression par thème
- `mission_progress` - Suivi des missions
- `player_bonuses` - Super bonus actifs

#### Campagnes
- `campaigns` - Campagnes programmées
- `campaign_messages` - Messages de campagne

#### Historique et Logs
- `give_logs` - Historique des gives
- `give_channels` - Salons de give
- `super_admin_logs` - Logs d'audit

#### Annonces
- `announcement_templates` - Templates d'annonces
- `announcement_messages` - Messages d'annonces

#### Événements
- `apple_game_winners` - Gagnants jeu de la pomme

### Relations

```
guild_config (serveur Discord)
  ├── themes
  │   ├── collectibles
  │   ├── missions
  │   ├── traps
  │   └── theme_config
  │
  ├── players
  │   ├── collections → collectibles
  │   ├── player_progress → themes
  │   ├── mission_progress → missions
  │   └── player_bonuses
  │
  └── campaigns
      └── campaign_messages
```

---

## 🛠️ Développement

### Scripts NPM

```bash
# Démarrer le bot
npm start

# Développement
npm run dev

# Déployer commandes (global)
npm run deploy

# Déployer commandes (guild)
npm run deploy-guild
```

### Gestion des Versions

Le projet utilise Semantic Versioning (MAJOR.MINOR.PATCH):

```bash
# Bump patch (1.1.0 → 1.1.1) - Corrections de bugs
node scripts/bump-version.js patch

# Bump minor (1.1.0 → 1.2.0) - Nouvelles fonctionnalités
node scripts/bump-version.js minor

# Bump major (1.1.0 → 2.0.0) - Breaking changes
node scripts/bump-version.js major
```

Le script met automatiquement à jour:
- `package.json`
- `VERSION`

Pensez à mettre à jour `CHANGELOG.md` manuellement.

### Structure d'une Commande

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ma-commande')
    .setDescription('Description de la commande'),

  async execute(interaction) {
    // Logique de la commande
    await interaction.reply('Réponse !');
  }
};
```

### Ajouter une Commande

1. Créer le fichier dans `commands/[admin|player|superadmin]/ma-commande.js`
2. Implémenter la logique
3. Redéployer les commandes: `npm run deploy-guild`
4. Redémarrer le bot

### Debugging

Le bot log automatiquement:
- Connexion à Discord
- Connexion à PostgreSQL
- Commandes chargées
- Événements chargés
- Erreurs non capturées

Activer les logs détaillés:
```javascript
// Dans index.js
console.log('Debug:', variableADebugger);
```

---

## 🐳 Déploiement

### Docker (Recommandé)

#### Build l'image

```bash
docker build -t mysterybox-bot .
```

#### Lancer avec Docker Compose

```bash
# Créer .env avec vos variables
cp .env.example .env
nano .env

# Lancer
docker-compose up -d

# Voir les logs
docker-compose logs -f bot

# Arrêter
docker-compose down
```

### VPS (Ubuntu/Debian)

#### 1. Installer les Dépendances

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt install postgresql postgresql-contrib

# PM2 (process manager)
sudo npm install -g pm2
```

#### 2. Configurer PostgreSQL

```bash
sudo -u postgres psql

CREATE DATABASE botdb;
CREATE USER botuser WITH ENCRYPTED PASSWORD 'votre_password';
GRANT ALL PRIVILEGES ON DATABASE botdb TO botuser;
\q
```

#### 3. Déployer le Code

```bash
# Cloner
git clone https://github.com/loomixlabs/mysterybox-discord-bot.git
cd mysterybox-discord-bot

# Installer dépendances
npm install --production

# Configuration
cp .env.example .env
nano .env

# Importer le schéma
psql -U botuser -d botdb -f database/schema-v3-multiserver-postgresql.sql
```

#### 4. Lancer avec PM2

```bash
# Démarrer
pm2 start index.js --name mysterybox-bot

# Sauvegarder la config PM2
pm2 save

# Auto-démarrage au boot
pm2 startup

# Voir les logs
pm2 logs mysterybox-bot

# Redémarrer
pm2 restart mysterybox-bot
```

### Railway / Heroku

#### Railway

1. Connecter votre repo GitHub
2. Créer une nouvelle base PostgreSQL
3. Ajouter les variables d'environnement
4. Railway déploie automatiquement

#### Heroku

```bash
# Installer Heroku CLI
# Créer app
heroku create mysterybox-bot

# Ajouter PostgreSQL
heroku addons:create heroku-postgresql:essential-0

# Configurer les variables
heroku config:set DISCORD_TOKEN=votre_token
heroku config:set APPLICATION_ID=votre_app_id
# ... autres variables

# Déployer
git push heroku main

# Importer le schéma
heroku pg:psql < database/schema-v3-multiserver-postgresql.sql
```

---

## 📊 Monitoring et Maintenance

### Vérifier l'État du Bot

```bash
# Logs en direct
pm2 logs mysterybox-bot

# Statut
pm2 status

# Consommation ressources
pm2 monit
```

### Maintenance de la Base de Données

```bash
# Backup
pg_dump -U botuser botdb > backup_$(date +%Y%m%d).sql

# Restore
psql -U botuser botdb < backup_20251113.sql

# Nettoyer les logs anciens
DELETE FROM give_logs WHERE created_at < NOW() - INTERVAL '90 days';
```

### Scripts de Diagnostic

Le bot inclut 53 scripts de vérification dans `tools/checks/`:

```bash
# Vérifier la base de données
node tools/checks/check-db.js

# Vérifier les missions
node tools/checks/verify-mission-system.js

# Vérifier les pièges
node tools/checks/check-traps-structure.js

# Diagnostiquer un joueur
node tools/checks/diagnose-player-missions.js
```

---

## 🐛 Dépannage

### Le bot ne se connecte pas

**Problème**: `Invalid Token` ou connexion impossible

**Solutions**:
1. Vérifier le token dans `.env`
2. Régénérer le token sur Discord Developer Portal
3. Vérifier que les Intents sont activés

### La base de données ne se connecte pas

**Problème**: `Connection refused` ou erreur PostgreSQL

**Solutions**:
```bash
# Tester la connexion
psql postgresql://botuser:password@localhost:5432/botdb

# Vérifier que PostgreSQL tourne
sudo systemctl status postgresql

# Redémarrer PostgreSQL
sudo systemctl restart postgresql
```

### Les commandes n'apparaissent pas

**Problème**: Commandes non visibles dans Discord

**Solutions**:
1. Redéployer les commandes: `npm run deploy-guild`
2. Attendre 5-10 minutes (cache Discord)
3. Vérifier les permissions du bot
4. Kick/Réinviter le bot avec la bonne URL

### Erreurs de permissions

**Problème**: "Missing Permissions" ou "Forbidden"

**Solutions**:
1. Vérifier que le bot a les permissions administrateur
2. Vérifier que le rôle du bot est au-dessus des rôles à gérer
3. Réinviter avec le lien d'invitation complet

---

## 🔄 Migration et Mise à Jour

### Mise à Jour du Bot

```bash
# Sauvegarder la base de données
pg_dump -U botuser botdb > backup_avant_maj.sql

# Arrêter le bot
pm2 stop mysterybox-bot

# Mettre à jour le code
git pull origin master

# Installer nouvelles dépendances
npm install

# Lancer les migrations si nécessaire
# (voir scripts/migrations/)

# Redémarrer
pm2 restart mysterybox-bot

# Vérifier les logs
pm2 logs mysterybox-bot
```

### Migration SQLite → PostgreSQL

Si vous utilisez une ancienne version avec SQLite:

```bash
node scripts/migrate-sqlite-to-postgres.js
```

---

## 📚 Documentation Additionnelle

- [CHANGELOG.md](CHANGELOG.md) - Historique des versions
- [VERSIONING_GUIDE.md](VERSIONING_GUIDE.md) - Guide de gestion des versions
- Documentation complète dans `docs/` (non versionnée)

---

## 🤝 Contribution

Les contributions sont les bienvenues !

### Processus

1. **Fork** le projet
2. Créer une branche feature (`git checkout -b feature/ma-feature`)
3. Commit les changements (`git commit -m 'feat: ajout feature X'`)
4. Push vers la branche (`git push origin feature/ma-feature`)
5. Ouvrir une **Pull Request**

### Conventions de Commits

Utiliser les préfixes suivants:
- `feat:` - Nouvelle fonctionnalité
- `fix:` - Correction de bug
- `docs:` - Documentation
- `chore:` - Tâches maintenance
- `refactor:` - Refactoring
- `test:` - Tests
- `perf:` - Performance

### Directives

- Tester localement avant de commit
- Mettre à jour le CHANGELOG.md
- Documenter les nouvelles features
- Suivre le style de code existant

---

## 📄 Licence

Ce projet est sous licence **MIT**. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 🌟 Remerciements

- **Discord.js** - Framework bot Discord
- **PostgreSQL** - Base de données robuste
- **Communauté Discord** - Retours et suggestions

---

## 📧 Support

### Pour toute question ou problème

- 🐛 **Bugs**: Ouvrir une [issue](https://github.com/loomixlabs/mysterybox-discord-bot/issues)
- 💡 **Suggestions**: Ouvrir une [discussion](https://github.com/loomixlabs/mysterybox-discord-bot/discussions)
- 📧 **Contact**: Via le serveur Discord du projet

---

## 🔗 Liens Utiles

- **Repository**: https://github.com/loomixlabs/mysterybox-discord-bot
- **Discord.js Guide**: https://discordjs.guide/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Discord Developer Portal**: https://discord.com/developers

---

**Made with ❤️ by LoomixLabs**

Version 1.5.0 - Dernière mise à jour: 19 novembre 2025
