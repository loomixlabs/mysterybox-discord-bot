# Claude Code - Directives pour Bot Discord Multi-Serveur

> **Projet**: Bot Discord gamifié pour giveaways thématiques
> **Stack**: Node.js 20+ | Discord.js v14.16.3 (STABLE) | PostgreSQL | node-cron
> **Architecture**: Multi-serveur (guild_id requis partout)
>
> ⚠️ **IMPORTANT Discord.js**: Rester sur v14.x - v15 est en développement (pas de release stable)

---

## 🎯 Vue d'Ensemble du Projet

Bot Discord permettant de créer des giveaways gamifiés où les joueurs collectent des items thématiques pour débloquer des rôles. Supporte plusieurs serveurs simultanément avec isolation des données par `guild_id`.

### Systèmes Principaux

1. **Give System** - Distribution d'items (collectibles, mystery boxes, traps)
2. **Mission System** - Validations (quiz, keywords, channel-based)
3. **Campaign System** - Gives programmés avec cron
4. **Theme System** - Thématiques à durée limitée
5. **Announcement System** - Templates d'annonces personnalisables
6. **Super Admin System** - Gestion multi-serveur et bonus

---

## 📁 Architecture du Projet

```
bot-discord/
├── index.js                    # Point d'entrée
├── deploy-commands.js          # Déploiement slash commands
│
├── commands/
│   ├── admin/                  # Commandes admin (co-fondateurs)
│   ├── player/                 # Commandes joueurs
│   └── superadmin/             # Commandes super-admin
│
├── events/
│   ├── ready.js                # Bot ready event
│   └── interactionCreate.js   # Router principal des interactions
│
├── handlers/
│   ├── giveHandler.js          # Logique gives normaux
│   ├── giveUniqueHandler.js    # Logique Give Unique (admin panel)
│   ├── missionHandler.js       # Logique missions
│   ├── mysteryBoxHandler.js    # Logique mystery boxes
│   ├── campaignHandler.js      # Logique campagnes programmées
│   ├── adminPanelHandler.js    # Panel admin (routeur)
│   ├── modalHandler.js         # Gestion modals Discord
│   ├── themeExpirationHandler.js # Expiration auto des thèmes
│   └── superAdminHandler.js    # Gestion super-admins
│
├── utils/
│   ├── database-pg.js          # Wrapper PostgreSQL (PRINCIPAL)
│   ├── announcements.js        # Système d'annonces
│   └── guildConfig.js          # Configuration par serveur
│
└── database/
    ├── schema.sql              # Schéma PostgreSQL initial
    └── migrations/             # Migrations SQL versionnées
```

### Fichiers Clés

- **[index.js](index.js)** - Initialisation du bot, chargement commandes/événements
- **[events/interactionCreate.js](events/interactionCreate.js)** - Routeur principal (boutons, modals, selects)
- **[utils/database-pg.js](utils/database-pg.js)** - Wrapper PostgreSQL multi-serveur
- **[handlers/giveUniqueHandler.js](handlers/giveUniqueHandler.js)** - Wizard Give Unique (4 étapes)
- **[handlers/adminPanelHandler.js](handlers/adminPanelHandler.js)** - Routeur admin panel

---

## 🚀 Commandes Bash Courantes

```bash
# Démarrage
node index.js                   # Lancer le bot
node deploy-commands.js         # Déployer commandes globales
node deploy-commands-guild.js   # Déployer commandes serveur

# Vérification base de données (TOUJOURS utiliser Node.js)
node verify-db.js               # Vérification complète DB
node list-tables.js             # Lister toutes les tables
node check-active-theme.js      # Vérifier thème actif

# Migrations
node run-mission-migration.js   # Exécuter migration missions
node database/migrations/[fichier].sql  # ❌ NE JAMAIS FAIRE - Utiliser Node.js

# Diagnostic
node diagnostic-database-giveunique.js  # Diagnostic Give Unique
node diagnostic-interaction-routing.js  # Diagnostic routing interactions
node verify-mission-system.js           # Vérification système missions
```

---

## 🚀 DÉPLOIEMENT VPS - PROCÉDURE OBLIGATOIRE

> **RÈGLE IMPÉRATIVE**: TOUJOURS rebuild le container Docker après avoir copié des fichiers sur le VPS.
> **NE JAMAIS** juste copier les fichiers sans rebuild - les changements ne seront PAS appliqués !

### Procédure complète de déploiement (3 étapes OBLIGATOIRES)

**Étape 1 - Copier les fichiers modifiés sur le VPS :**
```bash
scp -i ~/.ssh/id_rsa_vps_hostinger "c:\ia mogo\bot discord\[fichier]" root@72.60.185.62:/root/bot-mysterybox/[chemin]/
```

**Étape 2 - Rebuild et redémarrer le container (OBLIGATOIRE) :**
```bash
ssh -i ~/.ssh/id_rsa_vps_hostinger root@72.60.185.62 'cd /root/bot-mysterybox && docker compose down && docker compose build --no-cache bot && docker compose up -d'
```

**Étape 3 - Vérifier que le bot a bien démarré :**
```bash
ssh -i ~/.ssh/id_rsa_vps_hostinger root@72.60.185.62 'docker logs bot-mysterybox --tail 30'
```

### ❌ MÉTHODES INTERDITES

```bash
# ❌ NE JAMAIS FAIRE - Les fichiers sont copiés mais le container utilise toujours l'ancienne image
scp fichier.js root@vps:/root/bot-mysterybox/
# FIN - SANS REBUILD !

# ❌ NE JAMAIS FAIRE - docker restart ne rebuild pas l'image
docker restart bot-mysterybox
```

### ✅ Chemins importants sur le VPS

| Local | VPS |
|-------|-----|
| `c:\ia mogo\bot discord\` | `/root/bot-mysterybox/` |
| `handlers/` | `/root/bot-mysterybox/handlers/` |
| `utils/` | `/root/bot-mysterybox/utils/` |
| `events/` | `/root/bot-mysterybox/events/` |
| `scripts/` | `/root/bot-mysterybox/scripts/` |

### Container Docker

- **Nom du container**: `bot-mysterybox`
- **Nom de l'image**: `bot-mysterybox-bot`
- **Container DB**: `bot-mysterybox-db`

**CETTE RÈGLE EST NON-NÉGOCIABLE. Tout déploiement sans rebuild est INTERDIT.**

---

## 🔴 REDÉMARRAGE DU BOT - MÉTHODE OBLIGATOIRE

> **RÈGLE IMPÉRATIVE**: TOUJOURS utiliser PowerShell avec l'ID du processus pour arrêter le bot.
> **NE JAMAIS** utiliser `taskkill /F /IM node.exe` ou autres méthodes génériques.

### Procédure de redémarrage en 2 étapes :

**Étape 1 - Trouver et tuer le processus existant :**
```powershell
# Lister les processus node.exe avec leur PID
powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, StartTime"

# Tuer le processus par son PID (remplacer XXXX par le PID réel)
powershell -Command "Stop-Process -Id XXXX -Force"
```

**Étape 2 - Relancer le bot :**
```bash
cd "c:\ia mogo\bot discord" && node index.js
```

### ❌ MÉTHODES INTERDITES

```bash
# ❌ NE JAMAIS FAIRE - Tue TOUS les processus Node.js
taskkill /F /IM node.exe

# ❌ NE JAMAIS FAIRE - Syntaxe Windows incorrecte
cmd /c taskkill /F /IM node.exe

# ❌ NE JAMAIS FAIRE - Timeout Windows dans bash
timeout /t 2 /nobreak
```

### ✅ EXEMPLE COMPLET DE REDÉMARRAGE

```powershell
# 1. Trouver le PID du bot
powershell -Command "Get-Process node | Select-Object Id, StartTime"

# 2. Tuer le processus (exemple avec PID 12345)
powershell -Command "Stop-Process -Id 12345 -Force"

# 3. Attendre 2 secondes
powershell -Command "Start-Sleep -Seconds 2"

# 4. Relancer le bot (en background)
node index.js
```

**CETTE RÈGLE EST NON-NÉGOCIABLE. Toute autre méthode de redémarrage est interdite.**

---

## ⚠️ LACUNES & PRÉVENTION (LECTURE OBLIGATOIRE)

> **DOCUMENTATION CRITIQUE**: Voir [LACUNES-ET-AMELIORATIONS.md](LACUNES-ET-AMELIORATIONS.md)

**Basé sur l'analyse complète de toutes nos conversations depuis le début du projet.**

Ce fichier documente les **7 lacunes récurrentes** qui ont fait perdre 4-8h par session:

1. 🔴 **Modification DB sans consulter schéma** → 2-4h perdues
2. 🔴 **Oubli `guild_id` (bug multi-serveur critique)** → 1-3h + bug prod
3. 🟠 **Interaction timeout (Code 10062)** → 1-2h
4. 🟠 **Routing incomplet** → 1-2h
5. 🟡 **Sous-estimation du travail** → 30min-1h
6. 🟡 **Tests E2E manquants** → Bugs tardifs
7. 🟡 **Documentation tardive** → Perte de contexte

**✅ CHECKLIST UNIVERSELLE - À CONSULTER AVANT TOUTE TÂCHE**:

```
□ J'ai lu DATABASE-SCHEMA.md pour les tables concernées
□ J'ai vérifié l'existence de TOUTES les colonnes mentionnées
□ J'extrais guildId = interaction.guildId en PREMIÈRE ligne
□ Je défère l'interaction IMMÉDIATEMENT (deferUpdate/deferReply)
□ Toutes mes requêtes SQL incluent WHERE guild_id = $X
□ Je crée un script de test E2E après implémentation
□ Je mets à jour CHANGELOG.md immédiatement
□ Je route TOUS les types d'interactions (buttons, selects, modals)
```

**Si UNE SEULE étape manque: ARRÊTER et compléter avant de continuer.**

---

## 📊 Référence Base de Données

> **DOCUMENTATION COMPLÈTE**: Voir [DATABASE-SCHEMA.md](../DATABASE-SCHEMA.md)

Le fichier DATABASE-SCHEMA.md contient:
- ✅ Structure exhaustive de **33 tables**
- ✅ Types de colonnes, contraintes, index
- ✅ Clés étrangères et relations
- ✅ Contraintes CHECK et UNIQUE détaillées
- ✅ Catégorisation par système (Configuration, Thèmes, Missions, Super Bonus, etc.)
- ✅ Exemples de requêtes correctes vs incorrectes
- ✅ Règles critiques d'isolation multi-serveur

**IMPORTANT**: TOUJOURS consulter DATABASE-SCHEMA.md AVANT de manipuler la DB pour:
1. Vérifier l'existence des colonnes
2. Comprendre les relations entre tables
3. Respecter les contraintes CHECK
4. Utiliser les bons types de données

---

## 💾 Base de Données PostgreSQL

### RÈGLE IMPÉRATIVE: Toujours utiliser Node.js

**IMPORTANT**: Ne JAMAIS utiliser `psql` directement en ligne de commande. TOUJOURS créer un script Node.js.

#### Raisons:
1. ✅ `psql` via Bash ne retourne pas toujours les résultats dans Claude Code
2. ✅ Node.js garantit une sortie fiable (console.table, console.log)
3. ✅ Cohérence avec le codebase qui utilise `utils/database-pg.js`
4. ✅ Support multi-serveur automatique (guild_id)

#### Template de script de vérification:

```javascript
const db = require('./utils/database-pg');

async function verify() {
  try {
    console.log('🔍 VÉRIFICATION [NOM]\n');
    console.log('='.repeat(80));

    const result = await db.queryAll(`
      SELECT * FROM ma_table
      WHERE guild_id = $1
    `, [process.env.GUILD_ID]);

    console.table(result);
    console.log(`✅ ${result.length} résultat(s)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verify();
```

### Architecture Multi-Serveur

**TOUTES les requêtes SQL doivent inclure `guild_id`:**

```javascript
// ✅ CORRECT
const theme = await db.getActiveTheme(guildId);
const collectibles = await db.queryAll(
  'SELECT * FROM collectibles WHERE guild_id = $1 AND theme_id = $2',
  [guildId, themeId]
);

// ❌ INCORRECT - Manque guild_id
const theme = await db.queryOne('SELECT * FROM themes WHERE is_active = TRUE');
```

**Fallback automatique:** Si `guild_id` n'est pas fourni, le wrapper utilise `process.env.GUILD_ID` avec un warning.

### Tables Principales (28 tables)

```
Configuration:
  - themes                      # Thèmes par serveur
  - collectibles                # Items à collecter
  - traps                       # Pièges
  - theme_messages              # Messages personnalisables
  - theme_config                # Config thème
  - guild_config                # Config par serveur
  - announcement_settings       # Toggles annonces
  - announcement_templates      # Templates annonces

Joueurs:
  - players                     # Joueurs
  - player_progress             # Progression par thème
  - collections                 # Items collectés
  - player_active_bonuses       # Bonus actifs
  - player_cooldowns            # Cooldowns
  - player_malus_points         # Malus

Missions:
  - missions                    # Définitions missions
  - mission_progress            # Progression missions
  - mission_keywords            # Keywords validation

Campagnes:
  - give_campaigns              # Campagnes programmées
  - give_channels               # Canaux par campagne
  - give_logs                   # Historique gives

Super Admin:
  - super_admins                # Super admins
  - super_bonuses               # Bonus système
  - super_admin_logs            # Audit logs

Autres:
  - audit_logs                  # Actions admin
  - trap_triggered              # Pièges activés
```

---

## 🎨 Conventions de Code

### Style et Nommage

```javascript
// ✅ Nommage en français pour logique métier
async function handleGiveUniqueModeSelect(interaction) { ... }
const themeActif = await db.getActiveTheme(guildId);

// ✅ Emojis dans les logs (convention du projet)
console.log('✅ Opération réussie');
console.error('🔴 Erreur critique');
console.warn('⚠️  Attention');
console.log('🔍 Debug info');

// ✅ CustomIds structurés: action_type_id
customId: 'give_collectible_123'
customId: 'mission_approve_456'
customId: 'give_unique_launch:mode:itemId:channelType:timing'
```

### Gestion des Interactions Discord

**CRITIQUE**: Toujours déférer les interactions avant toute opération async.

```javascript
// ✅ CORRECT - Defer IMMÉDIATEMENT
async handleButtonClick(interaction) {
  await interaction.deferUpdate();  // PREMIÈRE LIGNE

  // Ensuite faire les requêtes DB, logique, etc.
  const data = await db.query(...);
  await interaction.editReply({ content: 'Done!' });
}

// ✅ CORRECT - Modal submit
async handleModalSubmit(interaction) {
  await interaction.deferReply({ flags: 64 }); // EPHEMERAL

  const result = await processData();
  await interaction.editReply({ content: result });
}

// ❌ INCORRECT - Timeout garanti
async handleButtonClick(interaction) {
  const data = await db.query(...);  // Peut prendre 2-3 secondes
  await interaction.update({ ... }); // ERREUR 10062 - Unknown interaction
}
```

**Règles:**
- Button/SelectMenu → `await interaction.deferUpdate()`
- Modal submit → `await interaction.deferReply({ flags: 64 })`
- Après defer → Utiliser `editReply()` jamais `update()` ou `reply()`
- `showModal()` ne nécessite PAS de defer (réponse immédiate)

### Gestion d'Erreurs

```javascript
try {
  await operation();
} catch (error) {
  console.error('🔴 Erreur:', error);

  // Ignorer si interaction expirée (Code 10062)
  if (error.code === 10062) {
    console.error('⏱️  Interaction expirée - Timeout dépassé');
    return;
  }

  // Répondre si possible
  const errorMsg = { content: '❌ Erreur', flags: 64 };
  if (interaction.deferred) {
    await interaction.editReply(errorMsg);
  } else {
    await interaction.reply(errorMsg);
  }
}
```

---

## 🔧 Patterns Architecturaux

### 1. Handler Delegation Pattern

```
User Interaction
    ↓
events/interactionCreate.js (Router)
    ↓
    ├─→ giveHandler.handleGiveClick()
    ├─→ missionHandler.handleMissionStart()
    ├─→ adminPanelHandler.handleAdminInteraction()
    │       ↓
    │   giveUniqueHandler.handleInteraction()
    └─→ mysteryBoxHandler.handleMysteryBoxOpen()
```

### 2. Database Wrapper Pattern

Toutes les opérations DB passent par [utils/database-pg.js](utils/database-pg.js):

```javascript
const db = require('./utils/database-pg');

// Wrapper methods (guild_id auto-géré)
await db.getActiveTheme(guildId);
await db.getAllThemes(guildId);
await db.setActiveTheme(guildId, themeId);

// Raw queries (guild_id manuel)
await db.queryOne('SELECT ...', [guildId, param]);
await db.queryAll('SELECT ...', [guildId]);
```

### 3. Multi-Step Wizard Pattern (Give Unique)

Le Give Unique suit un wizard en 4 étapes via [handlers/giveUniqueHandler.js](handlers/giveUniqueHandler.js):

```
Étape 1: Sélection Mode (Tous, Légendaire, Épique, Rare, Commun)
    ↓ handleGiveUniqueModeSelect()
Étape 2: Sélection Item (Liste items selon mode)
    ↓ handleGiveUniqueItemSelect()
Étape 3: Sélection Canaux (Random ou Spécifiques)
    ↓ handleGiveUniqueChannelRandom() / handleGiveUniqueChannelsSelect()
Étape 4: Options de lancement (Now/Scheduled, Default/Custom message)
    ↓ handleGiveUniqueLaunch()
```

Chaque handler DOIT avoir `await interaction.deferUpdate()` en première ligne.

---

## 📚 Guide Complet des Handlers

> **DOCUMENTATION EXHAUSTIVE**: Voir [HANDLERS.md](HANDLERS.md)

Le bot contient **12 handlers** qui forment le cœur de la logique métier. Chaque handler a été auditionné et documenté en détail.

### Quick Reference

| Handler | Responsabilité | Fichier |
|---------|---------------|---------|
| 🎁 mysteryBoxHandler | Système principal de mystery boxes | [handlers/mysteryBoxHandler.js](handlers/mysteryBoxHandler.js) |
| 🎯 giveUniqueHandler | Wizard admin 4 étapes Give Unique | [handlers/giveUniqueHandler.js](handlers/giveUniqueHandler.js) |
| 📋 missionHandler | Validation missions (quiz, keywords) | [handlers/missionHandler.js](handlers/missionHandler.js) |
| 📢 campaignHandler | Exécution campagnes (burst/scheduled) | [handlers/campaignHandler.js](handlers/campaignHandler.js) |
| ⚙️ campaignAdminHandler | Interface admin campagnes | [handlers/campaignAdminHandler.js](handlers/campaignAdminHandler.js) |
| 🎛️ adminPanelHandler | Routeur principal admin | [handlers/adminPanelHandler.js](handlers/adminPanelHandler.js) |
| 📝 modalHandler | Router pour tous les modals | [handlers/modalHandler.js](handlers/modalHandler.js) |
| ⏰ themeExpirationHandler | Expiration automatique thèmes | [handlers/themeExpirationHandler.js](handlers/themeExpirationHandler.js) |
| 👑 superAdminHandler | Interface multi-serveur | [handlers/superAdminHandler.js](handlers/superAdminHandler.js) |
| ✨ superBonusHandler | Gestion super bonus | [handlers/superBonusHandler.js](handlers/superBonusHandler.js) |
| ⚠️ giveHandler | DÉPRÉCIÉ - Remplacé par mysteryBoxHandler | [handlers/giveHandler.js](handlers/giveHandler.js) |

### Patterns Universels des Handlers

#### ✅ Pattern 1: Toujours déférer IMMÉDIATEMENT

```javascript
// ✅ CORRECT - Button/SelectMenu
async handleButtonClick(interaction) {
  await interaction.deferUpdate(); // PREMIÈRE LIGNE
  // ... logique
  await interaction.editReply({ content: 'Done!' });
}

// ✅ CORRECT - Modal submit
async handleModalSubmit(interaction) {
  await interaction.deferReply({ flags: 64 }); // EPHEMERAL
  // ... logique
  await interaction.editReply({ content: 'Done!' });
}

// ❌ INCORRECT - Timeout garanti
async handleButtonClick(interaction) {
  const data = await db.query(...); // Peut prendre 2-3s
  await interaction.update({ ... }); // ERREUR 10062
}
```

#### ✅ Pattern 2: Pas de defer avant `showModal()`

```javascript
// ✅ CORRECT - Modal répond immédiatement
if (action === 'custom_message') {
  return interaction.showModal(modal);
}

// ❌ INCORRECT
await interaction.deferUpdate();
return interaction.showModal(modal); // Erreur
```

#### ✅ Pattern 3: Délégation sans defer

```javascript
// ✅ CORRECT - adminPanelHandler
if (customId.startsWith('give_unique_')) {
  return giveUniqueHandler.handleInteraction(interaction); // Déléguer IMMÉDIATEMENT
}

// ❌ INCORRECT
if (customId.startsWith('give_unique_')) {
  await interaction.deferUpdate(); // ❌ Le handler délégué va déférer
  return giveUniqueHandler.handleInteraction(interaction);
}
```

**📖 Pour plus de détails**: Consulter [HANDLERS.md](HANDLERS.md) pour:
- Documentation complète de chaque handler
- Flow détaillés avec exemples de code
- Patterns critiques par handler
- Dépendances et intégrations
- Cas d'usage concrets

---

## 🧪 Testing et Vérification

### Workflow de Test

1. **Avant tout changement**: Lire les fichiers concernés
2. **Après modification**: Créer un script Node.js de vérification
3. **Red red bot**: `node index.js`
4. **Tester sur Discord**: Vérifier le flow complet
5. **Vérifier logs**: Chercher 🔴 ou ❌

### Scripts de Vérification Disponibles

```bash
# Base de données
node verify-db.js                    # Vérif complète
node list-tables.js                  # Liste tables
node verify-mission-database.js      # Système missions

# Systèmes spécifiques
node verify-mission-system.js        # Missions + templates
node check-announcement-templates.js # Templates annonces
node analyze-campaigns-db.js         # Campagnes

# Diagnostic
node diagnostic-database-giveunique.js       # Performance DB Give Unique
node diagnostic-interaction-routing.js       # Routing interactions
```

---

## 📝 Historique des Problèmes Résolus

### 2025-11-08 (B): Bug de Routing Give Unique dans Select Menu

**Problème**: Erreur "Unknown interaction" (Code 10062) lors de la sélection du mode dans Give Unique via le StringSelectMenu.

**Cause**: Le `handleSelectMenu()` dans adminPanelHandler ne routait pas les interactions `give_unique_` vers `giveUniqueHandler`.
- Flow cassé: interaction → interactionCreate → adminPanelHandler.handleSelectMenu() → **AUCUNE RÉPONSE** → timeout 3s → erreur 10062
- Les boutons `give_unique_` étaient correctement routés dans `handleAdminInteraction()`, mais pas les select menus dans `handleSelectMenu()`

**Solution**:
Ajout de la délégation manquante dans [handlers/adminPanelHandler.js](handlers/adminPanelHandler.js):
```javascript
// Give Unique - Déléguer à giveUniqueHandler
else if (customId.startsWith('give_unique_')) {
  return giveUniqueHandler.handleInteraction(interaction);
}
```

**Leçon apprise**:
- Toujours vérifier que TOUS les types d'interactions (buttons, select menus, modals) sont routés correctement
- Les select menus passent par `handleSelectMenu()`, pas `handleAdminInteraction()`
- Pattern de délégation : return IMMÉDIATEMENT sans defer (le handler délégué s'en charge)

### 2025-11-08 (A): Discord Interaction Timeout dans Give Unique

**Problème**: Erreur "Unknown interaction" (Code 10062) lors de la sélection du mode dans Give Unique.

**Cause**: Plusieurs handlers manquaient `await interaction.deferUpdate()` au début, causant un timeout (>3 secondes).

**Solution**:
1. Ajout de `deferUpdate()` dans 6 handlers:
   - `handleGiveUniqueModeSelect()` - ligne 117
   - `handleGiveUniqueChannelRandom()` - ligne 452
   - `handleGiveUniqueChannelSpecific()` - ligne 465
   - `handleGiveUniqueChannelsSelect()` - ligne 533
   - `handleGiveUniqueLaunch()` - ligne 684 (conditionnel)
   - `handleGiveUniqueAnnouncementModal()` - ligne 867 (deferReply)
2. Retrait du `deferUpdate()` dupliqué dans `launchGiveUniqueNow()`

**Leçon apprise**: TOUJOURS déférer les interactions Discord en PREMIÈRE ligne avant toute opération async (DB query, calculs, etc.).

### 2025-11-06: Colonnes missions manquantes dans announcement_settings

**Problème**: Les toggles des 5 nouveaux types de missions ne changeaient pas d'état visuellement (⬜ ne devenait pas ✅).

**Cause**: Les colonnes `mission_started`, `mission_completed`, `mission_failed`, `mission_approved`, `mission_rejected` n'existaient pas dans la table `announcement_settings`. Seule `mission_word_guessed` existait.

**Solution**:
1. Création du fichier de migration [database/migrations/add-mission-announcement-columns.sql](database/migrations/add-mission-announcement-columns.sql)
2. Exécution via Node.js avec `run-mission-migration.js`
3. Vérification avec `verify-db.js`

**Leçon apprise**: Toujours vérifier que les colonnes de la base de données existent avant d'implémenter l'UI qui les utilise.

---

## 📦 Système de Versioning (OBLIGATOIRE)

### RÈGLE IMPÉRATIVE: Mise à jour systématique du versioning

**Après CHAQUE modification de code, Claude DOIT**:

1. ✅ **Évaluer le type de changement**:
   - 🐛 **PATCH** (1.0.0 → 1.0.1) : Correction de bug, fix mineur, optimisation
   - ✨ **MINOR** (1.0.0 → 1.1.0) : Nouvelle fonctionnalité, ajout sans breaking change
   - ❌ **MAJOR** (1.0.0 → 2.0.0) : Breaking change, refonte majeure

2. ✅ **Mettre à jour CHANGELOG.md** IMMÉDIATEMENT:
   ```markdown
   ## [Non publié]

   ### Added (si MINOR ou MAJOR)
   - Description de la nouvelle fonctionnalité

   ### Fixed (si PATCH)
   - Description du bug corrigé

   ### Changed (si modification)
   - Description du changement
   ```

3. ✅ **Proposer un bump de version** à la fin de la session:
   ```bash
   # Suggérer la commande appropriée
   node scripts/bump-version.js patch
   # ou
   node scripts/bump-version.js minor
   # ou
   node scripts/bump-version.js major
   ```

### Checklist Obligatoire Après Chaque Modification

```
□ Le code est testé et fonctionne
□ CHANGELOG.md est mis à jour avec le changement
□ Le type de version est identifié (MAJOR/MINOR/PATCH)
□ Une suggestion de bump est donnée à l'utilisateur
□ Les fichiers modifiés sont listés avec leurs lignes
```

### Format de Documentation dans CHANGELOG.md

```markdown
### Fixed (pour PATCH)
- **[Module]**: Description du bug corrigé
  - Fichiers modifiés: `path/to/file.js` (lignes X-Y)
  - Impact: Description de l'impact
  - Cause: Explication brève

### Added (pour MINOR)
- **[Module]**: Description de la nouvelle fonctionnalité
  - Fichiers créés/modifiés: Liste des fichiers
  - Usage: Comment utiliser la nouvelle fonctionnalité
  - Dépendances: Nouvelles dépendances si applicable

### Changed (pour modifications)
- **[Module]**: Description du changement
  - Fichiers modifiés: Liste des fichiers
  - Migration: Étapes nécessaires si applicable
```

### Exemples de Classification

#### PATCH (Bug Fix)
```
❌ Bug: Validation des missions échoue pour collectibles perdus
✅ Fix: Modification de addCollectible() avec UPSERT
📝 CHANGELOG:
   ### Fixed
   - **[Missions]**: Correction du bug de validation pour collectibles perdus
     - Fichiers: `utils/database-pg.js` (lignes 727-734)
     - Cause: INSERT échouait sur contrainte unique
     - Solution: INSERT ... ON CONFLICT DO UPDATE
```

#### MINOR (Nouvelle Fonctionnalité)
```
✨ Ajout: Système de badges pour joueurs actifs
📝 CHANGELOG:
   ### Added
   - **[Badges]**: Nouveau système de récompenses par badges
     - Fichiers créés: `handlers/badgeHandler.js`
     - Commandes: `/badges` pour voir ses badges
     - Base de données: Nouvelle table `player_badges`
```

#### MAJOR (Breaking Change)
```
❌ Breaking: Migration PostgreSQL 14 → 16
📝 CHANGELOG:
   ### Changed
   - **[Database]**: Migration vers PostgreSQL 16
     - BREAKING: Nécessite PostgreSQL 16+
     - Migration: Voir MIGRATION_GUIDE.md
     - Fichiers modifiés: `utils/database-pg.js`
```

### Workflow Automatique de Claude

**À chaque fin de session**, Claude DOIT:

```
1. Lister TOUS les changements effectués
2. Vérifier si CHANGELOG.md a été mis à jour
3. Suggérer le type de version approprié
4. Générer la commande de bump
5. Rappeler de redémarrer le bot pour voir la nouvelle version
```

### Template de Fin de Session

```markdown
## 📊 Résumé de la Session

### Modifications Effectuées
1. [Module] - Description
   - Fichiers: `path/to/file.js` (lignes X-Y)
   - Type: Fix/Feature/Refactor

### Mise à Jour du Versioning
✅ CHANGELOG.md mis à jour
✅ Type de version: PATCH/MINOR/MAJOR

### Prochaines Étapes
1. Tester les modifications: `node index.js`
2. Bumper la version: `node scripts/bump-version.js <type>`
3. Commiter: `git add . && git commit -m "fix: description"`
4. Tagger: `git tag -a v1.0.1 -m "Release v1.0.1"`
```

---

## 🏆 Système de Badges (OBLIGATOIRE)

### RÈGLE IMPÉRATIVE: Maintenance des badges à chaque ajout

**Après CHAQUE ajout/modification de badge, Claude DOIT**:

1. ✅ **Suivre le process complet** (4 étapes obligatoires):
   ```
   ÉTAPE 1: DÉFINITION     → Créer l'entrée du badge avec tous les champs
   ÉTAPE 2: SEEDING        → Script de seeding + exécution + vérification
   ÉTAPE 3: TRACKING       → Hook fonction + intégration handler
   ÉTAPE 4: DOCUMENTATION  → Mettre à jour GUIDE-INTEGRATION-BADGES.md
   ```

2. ✅ **Mettre à jour GUIDE-INTEGRATION-BADGES.md** IMMÉDIATEMENT:
   - Section **[HISTORIQUE DES BADGES]** avec tableau détaillé
   - Fichiers modifiés (handlers, mappings, hooks)
   - Script de seeding créé
   - Intégration dans handlers existants

3. ✅ **Mettre à jour CHANGELOG.md** avec les nouveaux badges:
   ```markdown
   ### Added
   - **[Badges]**: Nouveau système de badges [Catégorie]
     - Ajout de X badges pour [catégorie]
     - Hook: badgeHandler.onNouvelEvenement()
     - Integration dans [handler]
     - Script de seed: scripts/seed-[category]-badges.js
   ```

4. ✅ **Vérifier la conformité**:
   - Code unique respecte le format `CATEGORY_NAME_TIER`
   - Couleur correspond à la rareté (voir GUIDE-INTEGRATION-BADGES.md)
   - Emojis composés (ex: 👁️✨, 🛡️⚡, 💰👑)
   - Mapping ajouté dans badgeHandler.js (lignes 40-135)

### Checklist Obligatoire Après Chaque Nouveau Badge

```
✅ Étape 1: Définition
  □ Code unique choisi (format: CATEGORY_NAME_TIER)
  □ Nom et description clairs
  □ Emoji et couleur selon rareté
  □ Catégorie et condition_type définis

✅ Étape 2: Seeding
  □ Script de seeding créé (scripts/seed-[category]-badges.js)
  □ Script exécuté sans erreur
  □ Badge visible dans la table `badges`

✅ Étape 3: Tracking
  □ Mapping ajouté dans badgeHandler.js
  □ Hook fonction créé (si nouvelle catégorie)
  □ Hook intégré dans le handler concerné

✅ Étape 4: Documentation
  □ GUIDE-INTEGRATION-BADGES.md mis à jour (section Historique)
  □ CHANGELOG.md mis à jour
  □ Tests E2E effectués

✅ Validation Finale
  □ Badge s'affiche dans /profile → Badges
  □ Progression fonctionne correctement
  □ Déblocage automatique testé
  □ Notification DM reçue
```

### Documentation de Référence

- **[GUIDE-INTEGRATION-BADGES.md](GUIDE-INTEGRATION-BADGES.md)** - Guide complet d'intégration (DOIT être lu avant tout ajout)
- **[SYSTEME-BADGES-COMPLET-2025.md](SYSTEME-BADGES-COMPLET-2025.md)** - Spécification système badges
- **[handlers/badgeHandler.js](handlers/badgeHandler.js)** - Logique centrale badges (550+ lignes)
- **[scripts/seed-super-bonus-badges.js](scripts/seed-super-bonus-badges.js)** - Exemple de seeding

### Catégories de Badges Disponibles

```
super_bonus    # Badges liés aux super bonus (Vision Divine, Jackpot, etc.)
collection     # Badges de progression collection (Débutant, Maître, etc.)
rarity         # Badges par rareté spécifique (Chasseur Légendaire, etc.)
mystery_box    # Badges ouverture de mystery boxes
trap           # Badges pièges (déclenchés, bloqués, survie)
mission        # Badges missions (complétées, approuvées, etc.)
engagement     # Badges fidélité/streaks (jours consécutifs)
social         # Badges partage/parrainage
special        # Badges spéciaux/events
```

### Exemple de Process Complet

```markdown
## AJOUT: Badges Collection (Catégorie 2)

### Étape 1: Définition ✅
- 6 badges créés: Débutant, Collectionneur, Chasseur, Expert, Maître, Légende
- Raretés: Common → Mythic
- Emojis composés: 🔰, 🎯💎, ⭐🏹, 💫🎓, 🏆👑, 👑✨🌟

### Étape 2: Seeding ✅
- Script: `scripts/seed-collection-badges.js`
- Exécuté: ✅ 6 badges créés
- Vérification: `SELECT * FROM badges WHERE category = 'collection'`

### Étape 3: Tracking ✅
- Hook créé: `badgeHandler.onCollectibleFound()`
- Mapping: Lignes 137-155 dans badgeHandler.js
- Intégration: mysteryBoxHandler.js (après addCollectible)

### Étape 4: Documentation ✅
- GUIDE-INTEGRATION-BADGES.md: Section Historique mise à jour
- CHANGELOG.md: Entrée "Added - [Badges] Collection Badges"
- Tests E2E: scripts/test-collection-badges.js
```

### Workflow de Claude pour Nouveaux Badges

**À chaque demande d'ajout de badges**, Claude DOIT:

```
1. Lire GUIDE-INTEGRATION-BADGES.md (section complète)
2. Lire SYSTEME-BADGES-COMPLET-2025.md (spécifications)
3. Vérifier les badges existants pour cohérence
4. Suivre les 4 étapes OBLIGATOIRES
5. Mettre à jour GUIDE-INTEGRATION-BADGES.md + CHANGELOG.md
6. Créer script de test E2E
7. Proposer validation à l'utilisateur
```

---

## 🎯 Règles Importantes

### À TOUJOURS FAIRE

1. ✅ **VERSIONING**: Mettre à jour CHANGELOG.md après CHAQUE modification
2. ✅ **VERSIONING**: Proposer un bump de version en fin de session
3. ✅ **BADGES**: Lire GUIDE-INTEGRATION-BADGES.md AVANT tout ajout de badge
4. ✅ **BADGES**: Suivre les 4 étapes obligatoires (Définition, Seeding, Tracking, Documentation)
5. ✅ **BADGES**: Mettre à jour GUIDE-INTEGRATION-BADGES.md section Historique
6. ✅ Utiliser Node.js pour toute vérification DB (jamais psql direct)
7. ✅ Inclure `guild_id` dans toutes les requêtes SQL
8. ✅ Déférer les interactions Discord IMMÉDIATEMENT (`deferUpdate()` / `deferReply()`)
9. ✅ Créer un script de vérification après toute migration DB
10. ✅ Utiliser `editReply()` après avoir déféré (jamais `update()` ou `reply()`)
11. ✅ Gérer l'erreur 10062 (interaction timeout) gracefully
12. ✅ Utiliser les emojis dans les logs (✅ 🔴 ⚠️ 🔍)

### À NE JAMAIS FAIRE

1. ❌ **VERSIONING**: Modifier du code sans mettre à jour CHANGELOG.md
2. ❌ **VERSIONING**: Terminer une session sans suggérer un bump de version
3. ❌ Utiliser `psql` en ligne de commande pour vérifier la DB
4. ❌ Oublier `guild_id` dans les requêtes SQL
5. ❌ Faire des opérations async avant `deferUpdate()`
6. ❌ Utiliser `update()` ou `reply()` après avoir déféré
7. ❌ Ignorer les erreurs de timeout (code 10062)
8. ❌ Modifier directement la DB sans migration SQL versionnée
9. ❌ Créer des commandes sans vérifier les permissions (co-fondateurs, super-admin)

---

## 📚 Ressources

- [Documentation Discord.js v14](https://discord.js.org/)
- [PostgreSQL node-postgres](https://node-postgres.com/)
- [Documentation détaillée](DOCUMENTATION-BOT-v2.md)
- [Guide de démarrage](GUIDE-DEMARRAGE.md)
- [Résumé projet](RESUME-PROJET.md)

---

**Dernière mise à jour**: 2025-11-13
**Version Claude Code**: Sonnet 4.5 (claude-sonnet-4-5-20250929)
**Version Bot**: 1.0.0
