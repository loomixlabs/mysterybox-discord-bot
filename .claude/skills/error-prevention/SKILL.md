---
name: error-prevention
description: |
  Expert en prévention d'erreurs et détection de patterns dangereux.
  ACTIVE AUTOMATIQUEMENT quand Claude:
  - Écrit du code JavaScript/Node.js
  - Modifie des handlers Discord.js
  - Écrit des requêtes SQL
  - Travaille sur du code multi-serveur (guild_id)

  Détecte: timeouts Discord, oubli guild_id, routing incomplet, requêtes SQL dangereuses.
  DOIT être consulté AVANT chaque modification de code.
---

# Error Prevention Expert

## Mission
Détecter et prévenir les erreurs AVANT qu'elles ne causent des bugs en production.

## Activation Automatique

Cette skill s'active quand tu:
- Écris/modifies du code `.js` dans handlers/
- Écris des requêtes SQL (SELECT, INSERT, UPDATE, DELETE)
- Travailles sur des interactions Discord
- Modifies interactionCreate.js ou un handler

## Checklist Universelle (OBLIGATOIRE)

**AVANT chaque modification, vérifie:**

```
□ guild_id extrait en LIGNE 1 du handler
□ deferUpdate()/deferReply() en LIGNE 2 (sauf showModal)
□ Toutes requêtes SQL ont WHERE guild_id = $X
□ Routing couvre buttons + selects + modals
□ Pas de await avant defer
□ editReply() utilisé (jamais reply/update après defer)
```

## Patterns Dangereux à Détecter

### 1. Oubli guild_id (CRITIQUE)

```javascript
// ❌ DANGEREUX - Affecte TOUS les serveurs
const theme = await db.queryOne('SELECT * FROM themes WHERE is_active = TRUE');

// ✅ CORRECT
const guildId = interaction.guildId;
const theme = await db.queryOne(
  'SELECT * FROM themes WHERE is_active = TRUE AND guild_id = $1',
  [guildId]
);
```

**Regex de détection:**
```regex
(SELECT|UPDATE|DELETE|INSERT)(?!.*guild_id).*FROM\s+\w+
```

### 2. Timeout Discord (Code 10062)

```javascript
// ❌ TIMEOUT GARANTI - Opération async AVANT defer
async handle(interaction) {
  const data = await db.query(...);  // 2-3 secondes
  await interaction.update(...);      // ERREUR 10062
}

// ✅ CORRECT - defer IMMÉDIATEMENT
async handle(interaction) {
  await interaction.deferUpdate();    // LIGNE 1
  const data = await db.query(...);
  await interaction.editReply(...);
}
```

### 3. Routing Incomplet

```javascript
// ❌ INCOMPLET - Oublie les select menus
if (interaction.isButton()) {
  if (customId.startsWith('give_unique_')) {
    return handler.handleInteraction(interaction);
  }
}

// ✅ COMPLET - Route TOUS les types
if (interaction.isButton() || interaction.isStringSelectMenu()) {
  if (customId.startsWith('give_unique_')) {
    return handler.handleInteraction(interaction);
  }
}
if (interaction.isModalSubmit()) {
  if (customId.startsWith('give_unique_')) {
    return handler.handleInteraction(interaction);
  }
}
```

### 4. Double Defer

```javascript
// ❌ ERREUR - defer dans parent ET enfant
// adminPanelHandler.js
if (customId.startsWith('give_unique_')) {
  await interaction.deferUpdate();  // ❌ Le handler va aussi defer
  return giveUniqueHandler.handle(interaction);
}

// ✅ CORRECT - déléguer SANS defer
if (customId.startsWith('give_unique_')) {
  return giveUniqueHandler.handle(interaction);  // Le handler défère
}
```

### 5. Modal après Defer

```javascript
// ❌ IMPOSSIBLE - showModal APRÈS defer
await interaction.deferUpdate();
await interaction.showModal(modal);  // ERREUR

// ✅ CORRECT - showModal SANS defer
if (action === 'custom_message') {
  return interaction.showModal(modal);  // Pas de defer avant
}
await interaction.deferUpdate();  // Defer pour autres actions
```

## Scripts de Validation

Exécuter avant chaque commit:

```bash
node scripts/error-prevention/validate-code.js [fichier]
```

Détecte automatiquement:
- Requêtes SQL sans guild_id
- Handlers sans defer
- Routing incomplet
- Patterns dangereux

## Réponse Automatique

Quand tu détectes un pattern dangereux:

1. **STOP** - Arrête l'écriture
2. **SIGNALE** - Affiche le problème avec emoji 🔴
3. **CORRIGE** - Propose la version correcte
4. **VÉRIFIE** - Demande confirmation avant continuer

## Références

- [dangerous-patterns.md](references/dangerous-patterns.md) - Catalogue complet des erreurs
- [checklist.md](references/checklist.md) - Checklist détaillée par contexte
