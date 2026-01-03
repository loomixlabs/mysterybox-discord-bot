# DEBUG REFERENCE - Overview Section

## Guild de test: 297309737135898624

**Dernière vérification**: 2025-12-09 ✅ TOUTES LES DONNÉES VALIDÉES
**Statut actuel**: ✅ FONCTIONNE - Stats, Theme, Top Players, Activité récente OK

---

## 1. MAPPING UI → DATA → SQL

| UI Element | Frontend Prop | API Field | SQL Table | SQL Column(s) |
|------------|---------------|-----------|-----------|---------------|
| Joueurs | `stats.totalPlayers` | `stats.totalPlayers` | `players` | `COUNT(*)` |
| Items collectés | `stats.totalCollections` | `stats.totalCollections` | `collections` | `COUNT(*) WHERE lost_at IS NULL` |
| Campagnes actives | `stats.activeCampaigns` | `stats.activeCampaigns` | `give_campaigns` | `COUNT(*) WHERE status='active'` |
| Collections complètes | `stats.completedPlayers` | `stats.completedPlayers` | `players + collections` | Subquery avec HAVING |
| Nouveaux aujourd'hui | `stats.newPlayersToday` | `stats.newPlayersToday` | `players` | `COUNT(*) WHERE created_at >= CURRENT_DATE` |
| Items requis | `stats.requiredItems` | `stats.requiredItems` | `themes` | `required_items` |
| Theme actif nom | `activeTheme.name` | `themeData.name` | `themes` | `name WHERE is_active=true` |
| Theme collectibles | `activeTheme.collectibles.length` | `themeData.collectibles` | `collectibles` | `COUNT(*) WHERE theme_id=X` |
| Theme pièges | `activeTheme.traps.length` | `themeData.traps` | `traps` | `COUNT(*) WHERE theme_id=X` |
| Theme missions | `activeTheme.missions.length` | `themeData.missions` | `missions` | `COUNT(*) WHERE theme_id=X` |
| Top joueurs | `topPlayers` | `topPlayers[]` | `players + collections` | JOIN + GROUP BY |
| Activité récente | `recentActivity` | `recentActivity[]` | `give_logs` | `give_type, winner_username, created_at` |

---

## 2. STRUCTURE DES TABLES (Colonnes Réelles)

### players
```sql
id, guild_id, discord_id, username, created_at, updated_at
```

### collections
```sql
id, guild_id, player_id, collectible_id, collected_at, lost_at, source
```

### themes
```sql
id, guild_id, name, is_active, required_items, final_role_name, final_role_discord_id, created_at
```

### collectibles
```sql
id, guild_id, theme_id, name, description, rarity, image_url, emoji, reveal_message
```

### traps
```sql
id, guild_id, theme_id, name, type, effect_type, effect_value, message, image_url
```

### missions
```sql
id, guild_id, theme_id, name, type, description, reward_type, reward_id
```

### give_campaigns
```sql
id, guild_id, name, status, start_date, end_date, created_at
```

### give_logs
```sql
id, guild_id, give_type, item_id, message_id, channel_id, winner_id, winner_username, campaign_id, created_at, claimed_at
```
⚠️ PAS DE: action_type, details, discord_id

---

## 3. API RESPONSE ATTENDUE

```json
{
  "success": true,
  "stats": {
    "totalPlayers": 3,
    "totalCollections": 4,
    "activeCampaigns": 0,
    "totalBadges": X,
    "adminRolesCount": X,
    "completedPlayers": 1,
    "requiredItems": 4,
    "newPlayersToday": 0
  },
  "topPlayers": [
    { "username": "xmicordix", "discord_id": "...", "collected_count": "4" }
  ],
  "recentActivity": [
    { "id": 1, "type": "collectible", "description": "xmicordix a obtenu Item", "created_at": "..." }
  ],
  "themeData": {
    "name": "testv4",
    "required_items": 4,
    "collectibles": [array of length 4],
    "traps": [array of length 5],
    "missions": [array of length 3]
  }
}
```

---

## 4. FRONTEND PROPS ATTENDUES (ConfigBotOverview.js)

```javascript
props: {
  guild: Object,           // { id, name, ... }
  stats: Object,           // { totalPlayers, totalCollections, activeCampaigns, completedPlayers, requiredItems, newPlayersToday }
  activeTheme: Object,     // { name, required_items, collectibles[], traps[], missions[] }
  topPlayers: Array,       // [{ username, discord_id, collected_count }]
  recentActivity: Array,   // [{ id, type, description, created_at }]
  loading: Boolean
}
```

---

## 5. SCRIPT DE VERIFICATION

```bash
node scripts/test-overview-queries.js
```

Ce script teste toutes les requêtes SQL et affiche les résultats.

---

## 6. CHECKLIST DE DEBUG

- [ ] API route retourne tous les champs
- [ ] Pas d'erreur SQL (colonnes inexistantes)
- [ ] Frontend reçoit les props correctement
- [ ] computed `activeThemeSummary` fonctionne
- [ ] Les chiffres correspondent à la DB

---

## 7. VALEURS ATTENDUES POUR GUILD 297309737135898624

| Donnée | Valeur |
|--------|--------|
| totalPlayers | 3 |
| totalCollections | 4 |
| activeCampaigns | 0 |
| completedPlayers | 1 |
| requiredItems | 4 |
| newPlayersToday | 0 |
| Theme name | testv4 |
| Collectibles | 4 |
| Traps | 5 |
| Missions | 3 |
| Top player | xmicordix (4 items) |

---

## 8. RÉSULTAT DE VÉRIFICATION (2025-12-09)

### Test SQL Direct ✅
```bash
node scripts/test-overview-queries.js
# Résultat: Toutes les requêtes OK!
```

### Workflow Vérifié ✅
```
DB (PostgreSQL)
  ↓ SQL Queries → routes/guild.js (lignes 2758-2905)
API Response (/api/guild/:guildId/config-bot/overview)
  ↓ HTTP GET → guild-api.js (ligne 700)
Frontend State (app.js)
  ↓ loadConfigBotData() → lignes 2195-2232
Vue Props (index.html)
  ↓ :stats, :active-theme, :top-players, :recent-activity
Component (ConfigBotOverview.js)
  ↓ Affichage UI
```

### Fichiers Critiques

| Fichier | Rôle | Lignes Clés |
|---------|------|-------------|
| [routes/guild.js](../../theme-builder/routes/guild.js) | API Endpoint | 2758-2905 |
| [guild-api.js](../../theme-builder/public/js/guild-api.js) | API Client | 700-703 |
| [app.js](../../theme-builder/public/js/app.js) | State Management | 2195-2232 |
| [ConfigBotOverview.js](../../theme-builder/public/js/components/ConfigBotOverview.js) | UI Component | 1-301 |

### Corrections Appliquées (Session Précédente)
1. **completedPlayersCount**: Query wrappée dans subquery
2. **recentActivity**: Colonnes `action_type`/`details` → `give_type`/`winner_username`
3. **ConfigBotOverview.js**: Deux blocks `methods:` fusionnés
