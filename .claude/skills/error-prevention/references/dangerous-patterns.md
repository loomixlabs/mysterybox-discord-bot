# Catalogue des Patterns Dangereux

## Niveau CRITIQUE (🔴)

### 1. Oubli guild_id dans SQL

**Impact**: Données mélangées entre serveurs, corruption data, bugs critiques prod

```javascript
// ❌ DANGEREUX
await db.query('SELECT * FROM themes WHERE is_active = TRUE');
await db.query('UPDATE players SET points = 0');
await db.query('DELETE FROM collections WHERE item_id = $1', [itemId]);

// ✅ CORRECT
await db.query('SELECT * FROM themes WHERE is_active = TRUE AND guild_id = $1', [guildId]);
await db.query('UPDATE players SET points = 0 WHERE guild_id = $1', [guildId]);
await db.query('DELETE FROM collections WHERE item_id = $1 AND guild_id = $2', [itemId, guildId]);
```

**Tables TOUJOURS avec guild_id:**
- players, player_progress, player_badges, player_cooldowns
- themes, collectibles, collections, traps
- missions, mission_progress
- give_campaigns, give_channels, give_logs
- announcement_settings, announcement_templates
- badges, mystery_box_config
- Toutes sauf: colors, super_admins (globales)

### 2. Timeout Discord (Code 10062)

**Impact**: Interaction échoue, UX cassée, logs d'erreurs

```javascript
// ❌ DANGEREUX - Plus de 3 secondes sans réponse
async handleButton(interaction) {
  const heavyData = await db.queryAll('SELECT * FROM big_table'); // 2-5s
  const processed = await processData(heavyData); // 1-3s
  await interaction.update({ content: 'Done' }); // ERREUR 10062
}

// ✅ CORRECT - Defer immédiatement
async handleButton(interaction) {
  await interaction.deferUpdate(); // < 100ms
  const heavyData = await db.queryAll('SELECT * FROM big_table');
  const processed = await processData(heavyData);
  await interaction.editReply({ content: 'Done' });
}
```

### 3. Routing Incomplet dans interactionCreate

**Impact**: Interactions ignorées, timeout silencieux

```javascript
// ❌ INCOMPLET - Manque StringSelectMenu
if (interaction.isButton()) {
  if (customId.startsWith('prefix_')) {
    return handler.handle(interaction);
  }
}
// L'utilisateur clique sur un select menu → TIMEOUT

// ✅ COMPLET
if (interaction.isButton()) {
  if (customId.startsWith('prefix_')) {
    return handler.handle(interaction);
  }
}
if (interaction.isStringSelectMenu()) {
  if (customId.startsWith('prefix_')) {
    return handler.handle(interaction);
  }
}
if (interaction.isModalSubmit()) {
  if (customId.startsWith('prefix_')) {
    return handler.handle(interaction);
  }
}
```

---

## Niveau ÉLEVÉ (🟠)

### 4. Double Defer (délégation)

**Impact**: Erreur "Interaction already acknowledged"

```javascript
// ❌ Parent défère PUIS délègue
// adminPanelHandler.js
async handleButton(interaction) {
  await interaction.deferUpdate(); // ❌
  if (customId.startsWith('give_unique_')) {
    return giveUniqueHandler.handle(interaction); // Handler va aussi defer
  }
}

// ✅ Déléguer SANS defer
async handleButton(interaction) {
  if (customId.startsWith('give_unique_')) {
    return giveUniqueHandler.handle(interaction); // Handler gère le defer
  }
  await interaction.deferUpdate(); // Defer seulement si pas délégué
}
```

### 5. Modal après Defer

**Impact**: Erreur "Cannot show modal on deferred interaction"

```javascript
// ❌ IMPOSSIBLE
await interaction.deferUpdate();
const modal = new ModalBuilder()...;
await interaction.showModal(modal); // ERREUR

// ✅ CORRECT - Modal SANS defer préalable
if (action === 'open_modal') {
  const modal = new ModalBuilder()...;
  return interaction.showModal(modal); // Return immédiat, pas de defer
}
// Defer pour les autres cas
await interaction.deferUpdate();
```

### 6. reply() ou update() après defer

**Impact**: Erreur "Interaction already replied"

```javascript
// ❌ ERREUR
await interaction.deferUpdate();
await interaction.update({ content: 'test' }); // ERREUR

await interaction.deferReply();
await interaction.reply({ content: 'test' }); // ERREUR

// ✅ CORRECT - Toujours editReply après defer
await interaction.deferUpdate();
await interaction.editReply({ content: 'test' });

await interaction.deferReply({ flags: 64 });
await interaction.editReply({ content: 'test' });
```

---

## Niveau MOYEN (🟡)

### 7. Catch sans gestion 10062

**Impact**: Logs pollués, erreurs non traitées

```javascript
// ❌ Log inutile pour timeout normal
catch (error) {
  console.error('Erreur:', error); // Spam logs avec 10062
}

// ✅ CORRECT
catch (error) {
  if (error.code === 10062) {
    console.warn('⏱️ Interaction expirée (timeout utilisateur)');
    return; // Pas d'action, c'est normal
  }
  console.error('🔴 Erreur:', error);
  // Gérer vraie erreur...
}
```

### 8. Flags manquants pour ephemeral

**Impact**: Message visible par tous au lieu de privé

```javascript
// ❌ VISIBLE PAR TOUS
await interaction.reply({ content: 'Erreur privée' });

// ✅ EPHEMERAL (privé)
await interaction.reply({ content: 'Erreur privée', flags: 64 });
// Ou avec deferReply
await interaction.deferReply({ flags: 64 });
```

### 9. Hardcode d'IDs

**Impact**: Code non portable entre serveurs

```javascript
// ❌ HARDCODÉ
const adminChannel = '123456789012345678';
const adminRole = '987654321098765432';

// ✅ DYNAMIQUE
const guildConfig = await db.getGuildConfig(guildId);
const adminChannel = guildConfig.admin_channel_id;
const adminRole = guildConfig.admin_role_id;
```

---

## Niveau ATTENTION (⚪)

### 10. Console.log en production

```javascript
// ❌ Pollue les logs
console.log('data:', data);
console.log('here');

// ✅ Logs structurés
console.log('🔍 [Handler] Processing:', { itemId, guildId });
console.error('🔴 [Handler] Failed:', error.message);
```

### 11. Await dans une boucle

```javascript
// ❌ LENT - Séquentiel
for (const item of items) {
  await db.query('INSERT...', [item]);
}

// ✅ RAPIDE - Parallèle
await Promise.all(items.map(item =>
  db.query('INSERT...', [item])
));
```
