# DATABASE SCHEMA - Bot Discord Multi-Serveur

> **Dernière mise à jour**: 2025-11-20
> **Total tables**: 37
> **PostgreSQL**: Compatible 14+

---

## 📋 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Multi-Serveur](#architecture-multi-serveur)
3. [Tables par Catégorie](#tables-par-catégorie)
4. [Schéma Détaillé](#schéma-détaillé)
5. [Anomalies Détectées](#anomalies-détectées)
6. [Index et Performance](#index-et-performance)

---

## 🎯 Vue d'Ensemble

Ce document décrit la structure complète de la base de données PostgreSQL du bot Discord.

### Principes Architecturaux

1. **Multi-Serveur**: Isolation par `guild_id` (TEXT)
2. **Soft Delete**: Utilisation de timestamps pour historique
3. **Performance**: Index optimisés sur clés fréquentes
4. **Contraintes**: Foreign keys avec ON DELETE CASCADE/SET NULL
5. **Auditabilité**: Tables de logs et timestamps

### Catégories de Tables

- ⚙️ **Configuration**: 3 table(s)
- 👤 **Joueurs**: 6 table(s)
- 🏆 **Badges**: 3 table(s)
- 🎨 **Thèmes & Collectibles**: 5 table(s)
- 🎯 **Missions**: 4 table(s)
- 📢 **Campagnes**: 3 table(s)
- 👑 **Super Admin**: 2 table(s)
- ✨ **Super Bonus**: 2 table(s)
- 📊 **Tracking & Logs**: 2 table(s)
- 📦 **Autres**: 7 table(s)

---

## 🏗️ Architecture Multi-Serveur

**RÈGLE IMPÉRATIVE**: Toutes les requêtes SQL doivent inclure `WHERE guild_id = $X`.

### Colonnes Standard

```sql
guild_id TEXT NOT NULL          -- ID du serveur Discord
id SERIAL PRIMARY KEY            -- ID unique auto-incrémenté
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

### Pattern de Requête

```javascript
// ✅ CORRECT
const result = await db.query(
  'SELECT * FROM players WHERE guild_id = $1 AND discord_id = $2',
  [guildId, discordId]
);

// ❌ INCORRECT - Manque guild_id
const result = await db.query(
  'SELECT * FROM players WHERE discord_id = $1',
  [discordId]
);
```

---

## 📚 Tables par Catégorie


### ⚙️ Configuration

**`announcement_settings`** (23 colonnes, 1 FK, 2 index)

**`announcement_templates`** (11 colonnes, 1 FK, 2 index)

**`guild_config`** (13 colonnes, 4 index)
  *Configuration et statut de chaque serveur Discord utilisant le bot*


### 👤 Joueurs

**`player_active_bonuses`** (11 colonnes, 2 FK, 4 index)

**`player_cooldowns`** (7 colonnes, 3 FK, 3 index)

**`player_login_history`** (5 colonnes, 1 FK, 5 index)
  *Historique des connexions quotidiennes des joueurs*

**`player_malus_points`** (6 colonnes, 3 FK, 2 index)

**`player_progress`** (9 colonnes, 3 FK, 4 index)

**`players`** (11 colonnes, 1 FK, 7 index)


### 🏆 Badges

**`badge_progress`** (9 colonnes, 2 FK, 5 index)
  *Progression en temps réel vers le déblocage des badges*

**`badges`** (14 colonnes, 5 index)
  *Définition de tous les badges disponibles dans le système*

**`player_badges`** (6 colonnes, 2 FK, 5 index)
  *Badges débloqués par les joueurs (historique des achievements)*


### 🎨 Thèmes & Collectibles

**`collectibles`** (9 colonnes, 2 FK, 5 index)

**`theme_config`** (22 colonnes, 2 FK, 3 index)

**`theme_messages`** (5 colonnes, 2 FK, 2 index)

**`themes`** (13 colonnes, 1 FK, 4 index)
  *Thèmes de collection par serveur (isolés par guild_id)*

**`traps`** (20 colonnes, 2 FK, 6 index)


### 🎯 Missions

**`mission_keywords`** (7 colonnes, 2 FK, 4 index)
  *Stores multiple possible keywords for keyword-message missions to avoid repetition*

**`mission_progress`** (15 colonnes, 3 FK, 5 index)

**`missions`** (16 colonnes, 2 FK, 5 index)

**`quiz_questions`** (10 colonnes, 1 FK, 2 index)


### 📢 Campagnes

**`give_campaigns`** (21 colonnes, 2 FK, 4 index)

**`give_channels`** (8 colonnes, 1 FK, 4 index)

**`give_logs`** (11 colonnes, 2 FK, 3 index)


### 👑 Super Admin

**`super_admin_logs`** (7 colonnes, 3 index)

**`super_admins`** (6 colonnes, 2 index)
  *Développeurs ayant accès à l'interface de gestion globale*


### ✨ Super Bonus

**`bonus_usage_history`** (8 colonnes, 2 FK, 1 index)

**`super_bonuses`** (19 colonnes, 2 FK, 5 index)
  *Super pouvoirs temporaires/permanents par serveur*


### 📊 Tracking & Logs

**`audit_logs`** (6 colonnes, 1 FK, 3 index)

**`trap_triggered`** (5 colonnes, 3 FK, 1 index)


### 📦 Autres

**`announcement_channel`** (6 colonnes, 1 FK, 2 index)

**`apple_game_winners`** (4 colonnes, 4 index)

**`collections`** (7 colonnes, 3 FK, 5 index)

**`colors`** (6 colonnes, 3 index)

**`guild_admin_roles`** (5 colonnes, 4 index)
  *Rôles Discord ayant accès à l'admin panel par serveur*

**`guild_branding`** (14 colonnes, 1 FK, 3 index)

**`guild_stats`** (7 colonnes, 1 FK, 1 index)
  *Statistiques agrégées par serveur pour monitoring*


---

## 📊 Schéma Détaillé


### Configuration

#### `announcement_settings`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('announcement_settings_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `legendary_collectible` | BOOLEAN | Oui | `true` |
| `collection_completed` | BOOLEAN | Oui | `true` |
| `collection_traded` | BOOLEAN | Oui | `true` |
| `collection_lost` | BOOLEAN | Oui | `true` |
| `trap_curse` | BOOLEAN | Oui | `true` |
| `mission_word_guessed` | BOOLEAN | Oui | `true` |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `updated_at` | TIMESTAMP | Oui | `now()` |
| `theme_expired` | BOOLEAN | Oui | `false` |
| `theme_expiring_soon` | BOOLEAN | Oui | `false` |
| `mission_started` | BOOLEAN | Oui | `false` |
| `mission_completed` | BOOLEAN | Oui | `false` |
| `mission_failed` | BOOLEAN | Oui | `false` |
| `mission_approved` | BOOLEAN | Oui | `false` |
| `mission_rejected` | BOOLEAN | Oui | `false` |
| `trap_cooldown` | BOOLEAN | Oui | `true` |
| `trap_lose_collectible` | BOOLEAN | Oui | `true` |
| `trap_public_shame` | BOOLEAN | Oui | `true` |
| `trap_malus_points` | BOOLEAN | Oui | `true` |
| `trap_empty_box` | BOOLEAN | Oui | `true` |
| `trap_lose_all_collectibles` | BOOLEAN | Oui | `false` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `announcement_settings_guild_id_key`: UNIQUE (guild_id)

**Foreign Keys:**

- `announcement_settings_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE

**Index:**

- `announcement_settings_guild_id_key`: (guild_id)
- `announcement_settings_pkey`: (id)

---

#### `announcement_templates`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('announcement_templates_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `type` | TEXT | Non | - |
| `title` | TEXT | Non | - |
| `description` | TEXT | Non | - |
| `color` | TEXT | Oui | `'#3498db'::text` |
| `image_url` | TEXT | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `updated_at` | TIMESTAMP | Oui | `now()` |
| `footer_text` | TEXT | Oui | `'Système d''annonces'::text` |
| `thumbnail_url` | TEXT | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `announcement_templates_guild_id_type_key`: UNIQUE (guild_id, type)

**Foreign Keys:**

- `announcement_templates_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE

**Index:**

- `announcement_templates_guild_id_type_key`: (guild_id, type)
- `announcement_templates_pkey`: (id)

---

#### `guild_config`

> Configuration et statut de chaque serveur Discord utilisant le bot

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `guild_id` | TEXT | Non | - |
| `guild_name` | TEXT | Non | - |
| `is_active` | BOOLEAN | Oui | `true` |
| `is_trial` | BOOLEAN | Oui | `false` |
| `trial_expires_at` | TIMESTAMP | Oui | - |
| `co_founder_role_id` | TEXT | Oui | - |
| `max_players` | INTEGER | Oui | - |
| `owner_id` | TEXT | Oui | - |
| `added_at` | TIMESTAMP | Oui | `now()` |
| `activated_at` | TIMESTAMP | Oui | `now()` |
| `deactivated_at` | TIMESTAMP | Oui | - |
| `last_activity` | TIMESTAMP | Oui | `now()` |
| `notes` | TEXT | Oui | - |

**Primary Key:**

- `PRIMARY KEY (guild_id)`

**Référencée par:**

- `guild_stats` via `guild_stats_guild_id_fkey`
- `themes` via `themes_guild_id_fkey`
- `theme_config` via `theme_config_guild_id_fkey`
- `theme_messages` via `theme_messages_guild_id_fkey`
- `collectibles` via `collectibles_guild_id_fkey`
- `missions` via `missions_guild_id_fkey`
- `traps` via `traps_guild_id_fkey`
- `super_bonuses` via `super_bonuses_guild_id_fkey`
- `players` via `players_guild_id_fkey`
- `player_progress` via `player_progress_guild_id_fkey`
- `collections` via `collections_guild_id_fkey`
- `player_active_bonuses` via `player_active_bonuses_guild_id_fkey`
- `bonus_usage_history` via `bonus_usage_history_guild_id_fkey`
- `mission_progress` via `mission_progress_guild_id_fkey`
- `player_cooldowns` via `player_cooldowns_guild_id_fkey`
- `player_malus_points` via `player_malus_points_guild_id_fkey`
- `trap_triggered` via `trap_triggered_guild_id_fkey`
- `give_campaigns` via `give_campaigns_guild_id_fkey`
- `give_channels` via `give_channels_guild_id_fkey`
- `announcement_channel` via `announcement_channel_guild_id_fkey`
- `announcement_settings` via `announcement_settings_guild_id_fkey`
- `announcement_templates` via `announcement_templates_guild_id_fkey`
- `give_logs` via `give_logs_guild_id_fkey`
- `audit_logs` via `audit_logs_guild_id_fkey`
- `mission_keywords` via `mission_keywords_guild_id_fkey`
- `guild_branding` via `guild_branding_guild_id_fkey`

**Index:**

- `guild_config_pkey`: (guild_id)
- `idx_guild_config_active`: (is_active)
- `idx_guild_config_guild_id`: (guild_id)
- `idx_guild_config_trial`: (is_trial, trial_expires_at) WHERE (is_trial = true)

---


### Joueurs

#### `player_active_bonuses`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('player_active_bonuses_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `user_id` | TEXT | Non | - |
| `bonus_id` | INTEGER | Non | - |
| `activated_at` | TIMESTAMP | Oui | - |
| `expires_at` | TIMESTAMP | Oui | - |
| `remaining_charges` | INTEGER | Oui | - |
| `is_active` | BOOLEAN | Oui | `true` |
| `used_at` | TIMESTAMP | Oui | - |
| `obtained_from` | TEXT | Oui | - |
| `given_by` | TEXT | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Foreign Keys:**

- `player_active_bonuses_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `player_active_bonuses_bonus_id_fkey`: FOREIGN KEY (bonus_id) REFERENCES super_bonuses(id) ON DELETE CASCADE

**Index:**

- `idx_active_bonuses_expires`: (expires_at) WHERE ((is_active = true) AND (expires_at IS NOT NULL))
- `idx_active_bonuses_guild`: (guild_id)
- `idx_active_bonuses_user`: (guild_id, user_id, is_active)
- `player_active_bonuses_pkey`: (id)

---

#### `player_cooldowns`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('player_cooldowns_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `player_id` | INTEGER | Non | - |
| `trap_id` | INTEGER | Non | - |
| `started_at` | TIMESTAMP | Oui | `now()` |
| `expires_at` | TIMESTAMP | Non | - |
| `is_active` | BOOLEAN | Oui | `true` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Foreign Keys:**

- `player_cooldowns_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `player_cooldowns_player_id_fkey`: FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
- `player_cooldowns_trap_id_fkey`: FOREIGN KEY (trap_id) REFERENCES traps(id) ON DELETE CASCADE

**Index:**

- `idx_cooldowns_active`: (guild_id, is_active, expires_at)
- `idx_cooldowns_guild`: (guild_id)
- `player_cooldowns_pkey`: (id)

---

#### `player_login_history`

> Historique des connexions quotidiennes des joueurs

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('player_login_history_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `player_id` | INTEGER | Non | - |
| `login_date` | DATE | Non | `CURRENT_DATE` |
| `created_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `player_login_history_guild_id_player_id_login_date_key`: UNIQUE (guild_id, player_id, login_date)

**Foreign Keys:**

- `player_login_history_guild_id_player_id_fkey`: FOREIGN KEY (guild_id, player_id) REFERENCES players(guild_id, id) ON DELETE CASCADE

**Index:**

- `idx_login_history_date`: (login_date DESC)
- `idx_login_history_guild_player`: (guild_id, player_id)
- `idx_login_history_lookup`: (guild_id, player_id, login_date)
- `player_login_history_guild_id_player_id_login_date_key`: (guild_id, player_id, login_date)
- `player_login_history_pkey`: (id)

---

#### `player_malus_points`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('player_malus_points_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `player_id` | INTEGER | Non | - |
| `theme_id` | INTEGER | Non | - |
| `points` | INTEGER | Oui | `0` |
| `updated_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `player_malus_points_guild_id_player_id_theme_id_key`: UNIQUE (guild_id, player_id, theme_id)

**Foreign Keys:**

- `player_malus_points_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `player_malus_points_player_id_fkey`: FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
- `player_malus_points_theme_id_fkey`: FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE

**Index:**

- `player_malus_points_guild_id_player_id_theme_id_key`: (guild_id, player_id, theme_id)
- `player_malus_points_pkey`: (id)

---

#### `player_progress`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('player_progress_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `player_id` | INTEGER | Non | - |
| `theme_id` | INTEGER | Non | - |
| `collected_count` | INTEGER | Oui | `0` |
| `is_completed` | BOOLEAN | Oui | `false` |
| `completed_at` | TIMESTAMP | Oui | - |
| `started_at` | TIMESTAMP | Oui | `now()` |
| `last_collected_at` | TIMESTAMP | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `player_progress_guild_id_player_id_theme_id_key`: UNIQUE (guild_id, player_id, theme_id)

**Foreign Keys:**

- `player_progress_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `player_progress_player_id_fkey`: FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
- `player_progress_theme_id_fkey`: FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE

**Index:**

- `idx_progress_guild`: (guild_id)
- `idx_progress_player_theme`: (guild_id, player_id, theme_id)
- `player_progress_guild_id_player_id_theme_id_key`: (guild_id, player_id, theme_id)
- `player_progress_pkey`: (id)

---

#### `players`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('players_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `discord_id` | TEXT | Non | - |
| `username` | TEXT | Non | - |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `updated_at` | TIMESTAMP | Oui | `now()` |
| `preferred_color` | TEXT | Oui | - |
| `traps_blocked` | INTEGER | Oui | `0` |
| `current_login_streak` | INTEGER | Oui | `0` |
| `last_login_date` | DATE | Oui | - |
| `best_login_streak` | INTEGER | Oui | `0` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `players_guild_id_discord_id_key`: UNIQUE (guild_id, discord_id)
- `players_guild_id_id_key`: UNIQUE (guild_id, id)

**Foreign Keys:**

- `players_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE

**Référencée par:**

- `player_progress` via `player_progress_player_id_fkey`
- `collections` via `collections_player_id_fkey`
- `mission_progress` via `mission_progress_player_id_fkey`
- `player_cooldowns` via `player_cooldowns_player_id_fkey`
- `player_malus_points` via `player_malus_points_player_id_fkey`
- `trap_triggered` via `trap_triggered_player_id_fkey`
- `player_badges` via `player_badges_player_id_fkey`
- `badge_progress` via `badge_progress_player_id_fkey`
- `player_login_history` via `player_login_history_guild_id_player_id_fkey`

**Index:**

- `idx_players_discord_id`: (guild_id, discord_id)
- `idx_players_guild`: (guild_id)
- `idx_players_login_streak`: (guild_id, current_login_streak DESC) WHERE (current_login_streak > 0)
- `idx_players_traps_blocked`: (traps_blocked) WHERE (traps_blocked > 0)
- `players_guild_id_discord_id_key`: (guild_id, discord_id)
- `players_guild_id_id_key`: (guild_id, id)
- `players_pkey`: (id)

---


### Badges

#### `badge_progress`

> Progression en temps réel vers le déblocage des badges

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('badge_progress_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `player_id` | INTEGER | Non | - |
| `badge_id` | INTEGER | Non | - |
| `current_value` | INTEGER | Oui | `0` |
| `target_value` | INTEGER | Non | - |
| `percentage` | NUMERIC | Oui | - |
| `started_at` | TIMESTAMP | Oui | `now()` |
| `updated_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `badge_progress_guild_id_player_id_badge_id_key`: UNIQUE (guild_id, player_id, badge_id)

**Foreign Keys:**

- `badge_progress_badge_id_fkey`: FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
- `badge_progress_player_id_fkey`: FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE

**Index:**

- `badge_progress_guild_id_player_id_badge_id_key`: (guild_id, player_id, badge_id)
- `badge_progress_pkey`: (id)
- `idx_badge_progress_badge`: (badge_id)
- `idx_badge_progress_percentage`: (percentage DESC)
- `idx_badge_progress_player`: (guild_id, player_id)

**Triggers:**

- `trigger_update_badge_progress_timestamp` (UPDATE)

---

#### `badges`

> Définition de tous les badges disponibles dans le système

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('badges_id_seq'::regclass)` |
| `code` | TEXT | Non | - |
| `name` | TEXT | Non | - |
| `description` | TEXT | Non | - |
| `emoji` | TEXT | Non | - |
| `color` | TEXT | Non | - |
| `rarity` | TEXT | Non | - |
| `category` | TEXT | Non | - |
| `condition_type` | TEXT | Non | - |
| `condition_target` | TEXT | Oui | - |
| `condition_value` | INTEGER | Oui | - |
| `display_order` | INTEGER | Oui | `0` |
| `is_secret` | BOOLEAN | Oui | `false` |
| `created_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `badges_code_key`: UNIQUE (code)

**Contraintes CHECK:**

- `badges_category_check`: CHECK ((category = ANY (ARRAY['super_bonus'::text, 'collection'::text, 'rarity'::text, 'mystery_box'::text, 'trap'::text, 'mission'::text, 'engagement'::text, 'social'::text, 'special'::text])))
- `badges_condition_type_check`: CHECK ((condition_type = ANY (ARRAY['super_bonus_usage'::text, 'super_bonus_unlock'::text, 'collectible_count'::text, 'rarity_collect'::text, 'mystery_box_open'::text, 'trap_survive'::text, 'trap_block'::text, 'mission_complete'::text, 'login_streak'::text, 'custom'::text])))
- `badges_rarity_check`: CHECK ((rarity = ANY (ARRAY['common'::text, 'uncommon'::text, 'rare'::text, 'epic'::text, 'legendary'::text, 'mythic'::text])))

**Référencée par:**

- `player_badges` via `player_badges_badge_id_fkey`
- `badge_progress` via `badge_progress_badge_id_fkey`

**Index:**

- `badges_code_key`: (code)
- `badges_pkey`: (id)
- `idx_badges_category`: (category)
- `idx_badges_condition`: (condition_type, condition_target)
- `idx_badges_rarity`: (rarity)

---

#### `player_badges`

> Badges débloqués par les joueurs (historique des achievements)

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('player_badges_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `player_id` | INTEGER | Non | - |
| `badge_id` | INTEGER | Non | - |
| `unlocked_at` | TIMESTAMP | Oui | `now()` |
| `unlocked_from` | TEXT | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `player_badges_guild_id_player_id_badge_id_key`: UNIQUE (guild_id, player_id, badge_id)

**Foreign Keys:**

- `player_badges_badge_id_fkey`: FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
- `player_badges_player_id_fkey`: FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE

**Index:**

- `idx_player_badges_badge`: (badge_id)
- `idx_player_badges_player`: (guild_id, player_id)
- `idx_player_badges_unlocked`: (unlocked_at DESC)
- `player_badges_guild_id_player_id_badge_id_key`: (guild_id, player_id, badge_id)
- `player_badges_pkey`: (id)

---


### Thèmes & Collectibles

#### `collectibles`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('collectibles_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `theme_id` | INTEGER | Non | - |
| `collectible_id` | TEXT | Non | - |
| `name` | TEXT | Non | - |
| `image_url` | TEXT | Non | - |
| `rarity` | TEXT | Oui | `'common'::text` |
| `reveal_message` | TEXT | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `collectibles_guild_id_theme_id_collectible_id_key`: UNIQUE (guild_id, theme_id, collectible_id)

**Contraintes CHECK:**

- `collectibles_rarity_check`: CHECK ((rarity = ANY (ARRAY['common'::text, 'rare'::text, 'epic'::text, 'legendary'::text])))

**Foreign Keys:**

- `collectibles_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `collectibles_theme_id_fkey`: FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE

**Référencée par:**

- `collections` via `collections_collectible_id_fkey`

**Index:**

- `collectibles_guild_id_theme_id_collectible_id_key`: (guild_id, theme_id, collectible_id)
- `collectibles_pkey`: (id)
- `idx_collectibles_guild`: (guild_id)
- `idx_collectibles_rarity`: (guild_id, rarity)
- `idx_collectibles_theme`: (guild_id, theme_id)

---

#### `theme_config`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('theme_config_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `theme_id` | INTEGER | Non | - |
| `probability_collectible` | INTEGER | Oui | `50` |
| `probability_mission` | INTEGER | Oui | `35` |
| `probability_trap` | INTEGER | Oui | `15` |
| `mystery_box_image` | TEXT | Oui | - |
| `mystery_box_title` | TEXT | Oui | `'🎁 BOÎTE MYSTÉRIEUSE'::text` |
| `mystery_box_description` | TEXT | Oui | `'Que contient-elle ?'::text` |
| `mystery_box_winner_message` | TEXT | Oui | `'🎉 **{player}** a ouvert la boîte mystère !'::text` |
| `mystery_box_celebration_gif` | TEXT | Oui | `'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif'::text` |
| `mystery_box_celebration_emojis` | TEXT | Oui | `'🎉,🎊,✨,🌟'::text` |
| `probability_super_bonus` | INTEGER | Oui | `10` |
| `collectible_rarity_legendary` | INTEGER | Oui | `5` |
| `collectible_rarity_epic` | INTEGER | Oui | `10` |
| `collectible_rarity_rare` | INTEGER | Oui | `20` |
| `collectible_rarity_common` | INTEGER | Oui | `40` |
| `super_bonus_rarity_legendary` | INTEGER | Oui | `5` |
| `super_bonus_rarity_epic` | INTEGER | Oui | `10` |
| `super_bonus_rarity_rare` | INTEGER | Oui | `20` |
| `super_bonus_rarity_common` | INTEGER | Oui | `40` |
| `auto_delete_celebration_message` | BOOLEAN | Oui | `false` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `theme_config_guild_id_theme_id_key`: UNIQUE (guild_id, theme_id)

**Contraintes CHECK:**

- `check_probabilities_sum_100`: CHECK (((((probability_collectible + probability_mission) + probability_trap) + COALESCE(probability_super_bonus, 0)) = 100))

**Foreign Keys:**

- `theme_config_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `theme_config_theme_id_fkey`: FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE

**Index:**

- `idx_theme_config_guild`: (guild_id)
- `theme_config_guild_id_theme_id_key`: (guild_id, theme_id)
- `theme_config_pkey`: (id)

---

#### `theme_messages`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('theme_messages_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `theme_id` | INTEGER | Non | - |
| `key` | TEXT | Non | - |
| `content` | TEXT | Non | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `theme_messages_guild_id_theme_id_key_key`: UNIQUE (guild_id, theme_id, key)

**Foreign Keys:**

- `theme_messages_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `theme_messages_theme_id_fkey`: FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE

**Index:**

- `theme_messages_guild_id_theme_id_key_key`: (guild_id, theme_id, key)
- `theme_messages_pkey`: (id)

---

#### `themes`

> Thèmes de collection par serveur (isolés par guild_id)

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('themes_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `theme_id` | TEXT | Non | - |
| `name` | TEXT | Non | - |
| `is_active` | BOOLEAN | Oui | `false` |
| `duration_days` | INTEGER | Non | - |
| `required_items` | INTEGER | Non | - |
| `final_role_name` | TEXT | Non | - |
| `final_role_color` | TEXT | Non | - |
| `final_role_discord_id` | TEXT | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `updated_at` | TIMESTAMP | Oui | `now()` |
| `activated_at` | TIMESTAMP | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `themes_guild_id_theme_id_key`: UNIQUE (guild_id, theme_id)

**Foreign Keys:**

- `themes_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE

**Référencée par:**

- `theme_config` via `theme_config_theme_id_fkey`
- `theme_messages` via `theme_messages_theme_id_fkey`
- `collectibles` via `collectibles_theme_id_fkey`
- `missions` via `missions_theme_id_fkey`
- `traps` via `traps_theme_id_fkey`
- `super_bonuses` via `super_bonuses_theme_id_fkey`
- `player_progress` via `player_progress_theme_id_fkey`
- `player_malus_points` via `player_malus_points_theme_id_fkey`
- `give_campaigns` via `give_campaigns_theme_id_fkey`
- `quiz_questions` via `quiz_questions_theme_id_fkey`

**Index:**

- `idx_themes_active`: (guild_id, is_active)
- `idx_themes_guild`: (guild_id)
- `themes_guild_id_theme_id_key`: (guild_id, theme_id)
- `themes_pkey`: (id)

---

#### `traps`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('traps_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `theme_id` | INTEGER | Non | - |
| `trap_id` | TEXT | Non | - |
| `name` | TEXT | Non | - |
| `type` | TEXT | Non | - |
| `description` | TEXT | Non | - |
| `image_url` | TEXT | Oui | - |
| `cooldown_duration` | INTEGER | Oui | - |
| `removes_collectible` | BOOLEAN | Oui | `false` |
| `shame_message` | TEXT | Oui | - |
| `shame_channel_id` | TEXT | Oui | - |
| `malus_points` | INTEGER | Oui | `0` |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `is_default` | BOOLEAN | Oui | `false` |
| `is_active` | BOOLEAN | Oui | `true` |
| `notif_title` | TEXT | Oui | - |
| `notif_description` | TEXT | Oui | - |
| `notif_color` | TEXT | Oui | `'#e74c3c'::text` |
| `notif_footer` | TEXT | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `traps_guild_id_trap_id_key`: UNIQUE (guild_id, trap_id)

**Contraintes CHECK:**

- `traps_type_check`: CHECK ((type = ANY (ARRAY['cooldown'::text, 'lose-collectible'::text, 'lose-all-collectibles'::text, 'public-shame'::text, 'points-malus'::text, 'empty-box'::text])))

**Foreign Keys:**

- `traps_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `traps_theme_id_fkey`: FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE

**Référencée par:**

- `player_cooldowns` via `player_cooldowns_trap_id_fkey`
- `trap_triggered` via `trap_triggered_trap_id_fkey`

**Index:**

- `idx_traps_active`: (guild_id, theme_id, is_active)
- `idx_traps_default`: (guild_id, theme_id, is_default)
- `idx_traps_guild`: (guild_id)
- `idx_traps_theme`: (guild_id, theme_id)
- `traps_guild_id_trap_id_key`: (guild_id, trap_id)
- `traps_pkey`: (id)

---


### Missions

#### `mission_keywords`

> Stores multiple possible keywords for keyword-message missions to avoid repetition

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('mission_keywords_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `mission_id` | INTEGER | Non | - |
| `keyword` | TEXT | Non | - |
| `target_channel_id` | TEXT | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `difficulty` | TEXT | Oui | `'medium'::text` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `mission_keywords_guild_id_mission_id_keyword_key`: UNIQUE (guild_id, mission_id, keyword)

**Contraintes CHECK:**

- `mission_keywords_difficulty_check`: CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])))

**Foreign Keys:**

- `mission_keywords_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `mission_keywords_mission_id_fkey`: FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE

**Index:**

- `idx_mission_keywords_lookup`: (guild_id, keyword)
- `idx_mission_keywords_mission`: (mission_id)
- `mission_keywords_guild_id_mission_id_keyword_key`: (guild_id, mission_id, keyword)
- `mission_keywords_pkey`: (id)

---

#### `mission_progress`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('mission_progress_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `player_id` | INTEGER | Non | - |
| `mission_id` | INTEGER | Non | - |
| `thread_id` | TEXT | Oui | - |
| `status` | TEXT | Oui | `'pending'::text` |
| `submitted_proof` | TEXT | Oui | - |
| `validated_by` | TEXT | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `updated_at` | TIMESTAMP | Oui | `now()` |
| `completed_at` | TIMESTAMP | Oui | - |
| `target_channel_id` | TEXT | Oui | - |
| `target_keyword` | TEXT | Oui | - |
| `mission_type` | TEXT | Oui | - |
| `expires_at` | TIMESTAMP | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes CHECK:**

- `mission_progress_status_check`: CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text])))

**Foreign Keys:**

- `mission_progress_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `mission_progress_player_id_fkey`: FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
- `mission_progress_mission_id_fkey`: FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE

**Index:**

- `idx_mission_progress_active_keyword`: (guild_id, status, mission_type, target_keyword) WHERE ((status = 'in_progress'::text) AND (mission_type = 'keyword-message'::text))
- `idx_mission_progress_expires`: (expires_at) WHERE ((status = 'in_progress'::text) AND (expires_at IS NOT NULL))
- `idx_mission_progress_guild`: (guild_id)
- `idx_mission_progress_status`: (guild_id, status)
- `mission_progress_pkey`: (id)

---

#### `missions`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('missions_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `theme_id` | INTEGER | Non | - |
| `mission_id` | TEXT | Non | - |
| `name` | TEXT | Non | - |
| `type` | TEXT | Non | - |
| `description` | TEXT | Non | - |
| `validation_type` | TEXT | Non | - |
| `validation_data` | JSONB | Oui | - |
| `timeout` | INTEGER | Oui | `30` |
| `image_url` | TEXT | Oui | - |
| `reward_type` | TEXT | Oui | `'random-collectible'::text` |
| `reward_data` | JSONB | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `allowed_channels` | ARRAY | Oui | - |
| `max_attempts` | INTEGER | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `missions_guild_id_theme_id_mission_id_key`: UNIQUE (guild_id, theme_id, mission_id)

**Contraintes CHECK:**

- `missions_type_check`: CHECK ((type = ANY (ARRAY['keyword-message'::text, 'reaction-message'::text, 'quiz'::text, 'voice-join'::text, 'message-count'::text, 'reaction-count'::text, 'manual'::text])))
- `missions_validation_type_check`: CHECK ((validation_type = ANY (ARRAY['auto'::text, 'manual'::text])))
- `missions_reward_type_check`: CHECK ((reward_type = ANY (ARRAY['random-collectible'::text, 'specific-collectible'::text, 'bonus-points'::text])))

**Foreign Keys:**

- `missions_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `missions_theme_id_fkey`: FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE

**Référencée par:**

- `mission_progress` via `mission_progress_mission_id_fkey`
- `mission_keywords` via `mission_keywords_mission_id_fkey`

**Index:**

- `idx_missions_guild`: (guild_id)
- `idx_missions_max_attempts`: (max_attempts) WHERE (max_attempts IS NOT NULL)
- `idx_missions_theme`: (guild_id, theme_id)
- `missions_guild_id_theme_id_mission_id_key`: (guild_id, theme_id, mission_id)
- `missions_pkey`: (id)

---

#### `quiz_questions`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('quiz_questions_id_seq'::regclass)` |
| `guild_id` | VARCHAR(20) | Non | - |
| `theme_id` | INTEGER | Non | - |
| `question_text` | TEXT | Non | - |
| `correct_answer` | TEXT | Non | - |
| `wrong_answers` | ARRAY | Oui | - |
| `hint` | TEXT | Oui | - |
| `difficulty` | VARCHAR(20) | Oui | `'medium'::character varying` |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `updated_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Foreign Keys:**

- `quiz_questions_theme_id_fkey`: FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE

**Index:**

- `idx_quiz_questions_guild_theme`: (guild_id, theme_id)
- `quiz_questions_pkey`: (id)

---


### Campagnes

#### `give_campaigns`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('give_campaigns_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `campaign_id` | TEXT | Non | - |
| `theme_id` | INTEGER | Non | - |
| `campaign_type` | TEXT | Non | - |
| `mode` | TEXT | Non | - |
| `burst_count` | INTEGER | Oui | - |
| `burst_interval` | INTEGER | Oui | - |
| `scheduled_duration` | INTEGER | Oui | - |
| `scheduled_interval` | INTEGER | Oui | - |
| `total_gives_planned` | INTEGER | Non | - |
| `total_gives_posted` | INTEGER | Oui | `0` |
| `status` | TEXT | Oui | `'running'::text` |
| `admin_id` | TEXT | Non | - |
| `channel_id` | TEXT | Oui | - |
| `category_id` | TEXT | Oui | - |
| `started_at` | TIMESTAMP | Oui | `now()` |
| `last_give_at` | TIMESTAMP | Oui | - |
| `next_give_at` | TIMESTAMP | Oui | - |
| `completed_at` | TIMESTAMP | Oui | - |
| `target_channels` | TEXT | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `give_campaigns_guild_id_campaign_id_key`: UNIQUE (guild_id, campaign_id)

**Contraintes CHECK:**

- `give_campaigns_campaign_type_check`: CHECK ((campaign_type = ANY (ARRAY['burst'::text, 'scheduled'::text])))
- `give_campaigns_mode_check`: CHECK ((mode = ANY (ARRAY['random'::text, 'here'::text, 'specific'::text])))
- `give_campaigns_status_check`: CHECK ((status = ANY (ARRAY['running'::text, 'paused'::text, 'stopped'::text, 'completed'::text])))

**Foreign Keys:**

- `give_campaigns_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `give_campaigns_theme_id_fkey`: FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE

**Référencée par:**

- `give_logs` via `give_logs_campaign_id_fkey`

**Index:**

- `give_campaigns_guild_id_campaign_id_key`: (guild_id, campaign_id)
- `give_campaigns_pkey`: (id)
- `idx_campaigns_guild`: (guild_id)
- `idx_campaigns_status`: (guild_id, status)

---

#### `give_channels`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('give_channels_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `type` | TEXT | Non | - |
| `discord_id` | TEXT | Non | - |
| `name` | TEXT | Non | - |
| `parent_category_id` | TEXT | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `created_by` | TEXT | Non | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `give_channels_guild_id_discord_id_key`: UNIQUE (guild_id, discord_id)

**Contraintes CHECK:**

- `give_channels_type_check`: CHECK ((type = ANY (ARRAY['category'::text, 'channel'::text])))

**Foreign Keys:**

- `give_channels_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE

**Index:**

- `give_channels_guild_id_discord_id_key`: (guild_id, discord_id)
- `give_channels_pkey`: (id)
- `idx_give_channels_guild`: (guild_id)
- `idx_give_channels_type`: (guild_id, type)

---

#### `give_logs`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('give_logs_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `give_type` | TEXT | Non | - |
| `item_id` | INTEGER | Non | - |
| `message_id` | TEXT | Non | - |
| `channel_id` | TEXT | Non | - |
| `winner_id` | TEXT | Oui | - |
| `winner_username` | TEXT | Oui | - |
| `campaign_id` | INTEGER | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `claimed_at` | TIMESTAMP | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes CHECK:**

- `give_logs_give_type_check`: CHECK ((give_type = ANY (ARRAY['collectible'::text, 'mission'::text, 'trap'::text, 'super_bonus'::text])))

**Foreign Keys:**

- `give_logs_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `give_logs_campaign_id_fkey`: FOREIGN KEY (campaign_id) REFERENCES give_campaigns(id) ON DELETE SET NULL

**Index:**

- `give_logs_pkey`: (id)
- `idx_give_logs_guild`: (guild_id)
- `idx_give_logs_message`: (message_id)

---


### Super Admin

#### `super_admin_logs`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('super_admin_logs_id_seq'::regclass)` |
| `admin_id` | TEXT | Non | - |
| `action` | TEXT | Non | - |
| `target_guild_id` | TEXT | Oui | - |
| `details` | JSONB | Oui | - |
| `ip_address` | TEXT | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Index:**

- `idx_super_admin_logs_admin`: (admin_id)
- `idx_super_admin_logs_created`: (created_at)
- `super_admin_logs_pkey`: (id)

---

#### `super_admins`

> Développeurs ayant accès à l'interface de gestion globale

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('super_admins_id_seq'::regclass)` |
| `discord_id` | TEXT | Non | - |
| `username` | TEXT | Non | - |
| `role` | TEXT | Oui | `'admin'::text` |
| `added_at` | TIMESTAMP | Oui | `now()` |
| `added_by` | TEXT | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `super_admins_discord_id_key`: UNIQUE (discord_id)

**Contraintes CHECK:**

- `super_admins_role_check`: CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text])))

**Index:**

- `super_admins_discord_id_key`: (discord_id)
- `super_admins_pkey`: (id)

---


### Super Bonus

#### `bonus_usage_history`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('bonus_usage_history_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `user_id` | TEXT | Non | - |
| `bonus_id` | INTEGER | Non | - |
| `used_at` | TIMESTAMP | Oui | `now()` |
| `effect_result` | JSONB | Oui | - |
| `trigger_type` | TEXT | Oui | - |
| `related_event_id` | INTEGER | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Foreign Keys:**

- `bonus_usage_history_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `bonus_usage_history_bonus_id_fkey`: FOREIGN KEY (bonus_id) REFERENCES super_bonuses(id) ON DELETE SET NULL

**Index:**

- `bonus_usage_history_pkey`: (id)

---

#### `super_bonuses`

> Super pouvoirs temporaires/permanents par serveur

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('super_bonuses_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `bonus_id` | TEXT | Non | - |
| `name` | TEXT | Non | - |
| `description` | TEXT | Non | - |
| `icon` | TEXT | Oui | - |
| `bonus_type` | TEXT | Non | - |
| `effect_type` | TEXT | Non | - |
| `effect_config` | JSONB | Oui | - |
| `duration_type` | TEXT | Non | - |
| `duration_value` | INTEGER | Oui | - |
| `image_url` | TEXT | Oui | - |
| `color` | TEXT | Oui | `'#3498db'::text` |
| `rarity` | TEXT | Oui | `'common'::text` |
| `theme_id` | INTEGER | Oui | - |
| `announcement_message` | TEXT | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `activation_mode` | TEXT | Oui | `'manual'::text` |
| `is_enabled` | BOOLEAN | Non | `true` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `super_bonuses_guild_id_bonus_id_key`: UNIQUE (guild_id, bonus_id)

**Contraintes CHECK:**

- `super_bonuses_duration_type_check`: CHECK ((duration_type = ANY (ARRAY['temporary'::text, 'charges'::text, 'permanent'::text])))
- `super_bonuses_rarity_check`: CHECK ((rarity = ANY (ARRAY['common'::text, 'rare'::text, 'epic'::text, 'legendary'::text])))
- `super_bonuses_check`: CHECK ((((duration_type = 'temporary'::text) AND (duration_value > 0)) OR ((duration_type = 'charges'::text) AND (duration_value > 0)) OR ((duration_type = 'permanent'::text) AND (duration_value IS NULL))))
- `super_bonuses_effect_type_check`: CHECK ((effect_type = ANY (ARRAY['probability'::text, 'cosmetic'::text, 'protection'::text, 'cooldown'::text, 'reveal'::text, 'transfer'::text, 'rarity_boost'::text, 'multiplier'::text, 'detector'::text, 'voice'::text, 'reroll'::text])))
- `super_bonuses_activation_mode_check`: CHECK ((activation_mode = ANY (ARRAY['automatic'::text, 'manual'::text])))
- `super_bonuses_bonus_type_check`: CHECK ((bonus_type = ANY (ARRAY['boost'::text, 'economy'::text, 'protection'::text, 'social'::text, 'time'::text, 'reveal'::text])))

**Foreign Keys:**

- `super_bonuses_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `super_bonuses_theme_id_fkey`: FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE

**Référencée par:**

- `player_active_bonuses` via `player_active_bonuses_bonus_id_fkey`
- `bonus_usage_history` via `bonus_usage_history_bonus_id_fkey`

**Index:**

- `idx_super_bonuses_guild`: (guild_id)
- `idx_super_bonuses_is_enabled`: (guild_id, is_enabled)
- `idx_super_bonuses_theme`: (guild_id, theme_id)
- `super_bonuses_guild_id_bonus_id_key`: (guild_id, bonus_id)
- `super_bonuses_pkey`: (id)

---


### Tracking & Logs

#### `audit_logs`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('audit_logs_id_seq'::regclass)` |
| `guild_id` | TEXT | Oui | - |
| `action` | TEXT | Non | - |
| `admin_id` | TEXT | Non | - |
| `details` | JSONB | Oui | - |
| `created_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Foreign Keys:**

- `audit_logs_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE

**Index:**

- `audit_logs_pkey`: (id)
- `idx_audit_logs_admin`: (admin_id)
- `idx_audit_logs_guild`: (guild_id)

---

#### `trap_triggered`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('trap_triggered_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `player_id` | INTEGER | Non | - |
| `trap_id` | INTEGER | Non | - |
| `triggered_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Foreign Keys:**

- `trap_triggered_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `trap_triggered_player_id_fkey`: FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
- `trap_triggered_trap_id_fkey`: FOREIGN KEY (trap_id) REFERENCES traps(id) ON DELETE CASCADE

**Index:**

- `trap_triggered_pkey`: (id)

---


### Autres

#### `announcement_channel`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('announcement_channel_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `channel_id` | TEXT | Non | - |
| `channel_name` | TEXT | Non | - |
| `created_at` | TIMESTAMP | Oui | `now()` |
| `updated_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `announcement_channel_guild_id_key`: UNIQUE (guild_id)

**Foreign Keys:**

- `announcement_channel_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE

**Index:**

- `announcement_channel_guild_id_key`: (guild_id)
- `announcement_channel_pkey`: (id)

---

#### `apple_game_winners`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('apple_game_winners_id_seq'::regclass)` |
| `user_id` | VARCHAR(20) | Non | - |
| `guild_id` | VARCHAR(20) | Non | - |
| `won_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `apple_game_winners_user_id_guild_id_key`: UNIQUE (user_id, guild_id)

**Index:**

- `apple_game_winners_pkey`: (id)
- `apple_game_winners_user_id_guild_id_key`: (user_id, guild_id)
- `idx_apple_game_winners_guild`: (guild_id)
- `idx_apple_game_winners_user`: (user_id)

---

#### `collections`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('collections_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `player_id` | INTEGER | Non | - |
| `collectible_id` | INTEGER | Non | - |
| `collected_at` | TIMESTAMP | Oui | `now()` |
| `source` | TEXT | Oui | `'give'::text` |
| `lost_at` | TIMESTAMP | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `collections_guild_id_player_id_collectible_id_key`: UNIQUE (guild_id, player_id, collectible_id)

**Contraintes CHECK:**

- `collections_source_check`: CHECK ((source = ANY (ARRAY['give'::text, 'mission'::text, 'mystery_box'::text])))

**Foreign Keys:**

- `collections_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE
- `collections_player_id_fkey`: FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
- `collections_collectible_id_fkey`: FOREIGN KEY (collectible_id) REFERENCES collectibles(id) ON DELETE CASCADE

**Index:**

- `collections_guild_id_player_id_collectible_id_key`: (guild_id, player_id, collectible_id)
- `collections_pkey`: (id)
- `idx_collections_guild`: (guild_id)
- `idx_collections_lost_at`: (lost_at)
- `idx_collections_player`: (guild_id, player_id)

**Triggers:**

- `trg_collections_delete_update_count` (DELETE)
- `trg_collections_insert_update_count` (INSERT)

---

#### `colors`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('colors_id_seq'::regclass)` |
| `name` | TEXT | Non | - |
| `hex_code` | TEXT | Non | - |
| `emoji` | TEXT | Oui | - |
| `category` | TEXT | Non | - |
| `created_at` | TIMESTAMP | Oui | `CURRENT_TIMESTAMP` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `colors_hex_code_key`: UNIQUE (hex_code)
- `colors_name_key`: UNIQUE (name)

**Index:**

- `colors_hex_code_key`: (hex_code)
- `colors_name_key`: (name)
- `colors_pkey`: (id)

---

#### `guild_admin_roles`

> Rôles Discord ayant accès à l'admin panel par serveur

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('guild_admin_roles_id_seq'::regclass)` |
| `guild_id` | VARCHAR(20) | Non | - |
| `role_id` | VARCHAR(20) | Non | - |
| `added_by` | VARCHAR(20) | Non | - |
| `created_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `guild_admin_roles_guild_id_role_id_key`: UNIQUE (guild_id, role_id)

**Index:**

- `guild_admin_roles_guild_id_role_id_key`: (guild_id, role_id)
- `guild_admin_roles_pkey`: (id)
- `idx_guild_admin_roles_guild`: (guild_id)
- `idx_guild_admin_roles_role`: (role_id)

---

#### `guild_branding`

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `id` | INTEGER | Non | `nextval('guild_branding_id_seq'::regclass)` |
| `guild_id` | TEXT | Non | - |
| `bot_display_name` | TEXT | Oui | `'MysteryBox by Loomix'::text` |
| `primary_color` | TEXT | Oui | `'#3498db'::text` |
| `secondary_color` | TEXT | Oui | `'#2ecc71'::text` |
| `embed_footer_text` | TEXT | Oui | `'MysteryBox by Loomix'::text` |
| `embed_footer_icon_url` | TEXT | Oui | - |
| `language` | TEXT | Oui | `'fr'::text` |
| `timezone` | TEXT | Oui | `'Europe/Paris'::text` |
| `modules_enabled` | JSONB | Oui | `'["mysterybox"]'::jsonb` |
| `created_at` | TIMESTAMP | Oui | `CURRENT_TIMESTAMP` |
| `updated_at` | TIMESTAMP | Oui | `CURRENT_TIMESTAMP` |
| `bot_status` | JSONB | Oui | `'{"text": "MysteryBox", "type": "custom"}'::jsonb` |
| `bot_role_id` | TEXT | Oui | - |

**Primary Key:**

- `PRIMARY KEY (id)`

**Contraintes UNIQUE:**

- `guild_branding_guild_id_key`: UNIQUE (guild_id)

**Foreign Keys:**

- `guild_branding_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE

**Index:**

- `guild_branding_guild_id_key`: (guild_id)
- `guild_branding_pkey`: (id)
- `idx_guild_branding_guild_id`: (guild_id)

---

#### `guild_stats`

> Statistiques agrégées par serveur pour monitoring

**Colonnes:**

| Colonne | Type | Nullable | Default |
|---------|------|----------|----------|
| `guild_id` | TEXT | Non | - |
| `total_players` | INTEGER | Oui | `0` |
| `total_gives` | INTEGER | Oui | `0` |
| `total_campaigns` | INTEGER | Oui | `0` |
| `total_collections` | INTEGER | Oui | `0` |
| `last_give_at` | TIMESTAMP | Oui | - |
| `updated_at` | TIMESTAMP | Oui | `now()` |

**Primary Key:**

- `PRIMARY KEY (guild_id)`

**Foreign Keys:**

- `guild_stats_guild_id_fkey`: FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id) ON DELETE CASCADE

**Index:**

- `guild_stats_pkey`: (guild_id)

---


---

## ⚠️ Anomalies Détectées

11 anomalie(s) détectée(s) lors de l'audit:

1. **[announcement_channel]** missing_update_trigger
   - Colonne updated_at sans trigger auto-update

2. **[announcement_settings]** missing_update_trigger
   - Colonne updated_at sans trigger auto-update

3. **[announcement_templates]** missing_update_trigger
   - Colonne updated_at sans trigger auto-update

4. **[colors]** missing_guild_id
   - Colonne guild_id manquante (table multi-serveur)

5. **[guild_branding]** missing_update_trigger
   - Colonne updated_at sans trigger auto-update

6. **[guild_stats]** missing_update_trigger
   - Colonne updated_at sans trigger auto-update

7. **[mission_progress]** missing_update_trigger
   - Colonne updated_at sans trigger auto-update

8. **[player_malus_points]** missing_update_trigger
   - Colonne updated_at sans trigger auto-update

9. **[players]** missing_update_trigger
   - Colonne updated_at sans trigger auto-update

10. **[quiz_questions]** missing_update_trigger
   - Colonne updated_at sans trigger auto-update

11. **[themes]** missing_update_trigger
   - Colonne updated_at sans trigger auto-update


---

## 🚀 Index et Performance

### Index Critiques

Les index suivants sont essentiels pour la performance:

```sql
-- Multi-serveur (TOUTES les tables avec guild_id)
CREATE INDEX idx_tablename_guild ON table_name(guild_id);

-- Recherche par Discord ID
CREATE INDEX idx_players_discord_id ON players(guild_id, discord_id);

-- Badges actifs
CREATE INDEX idx_player_active_bonuses_active ON player_active_bonuses(guild_id, player_id, expires_at)
  WHERE expires_at > NOW();

-- Login streaks
CREATE INDEX idx_players_login_streak ON players(guild_id, current_login_streak DESC)
  WHERE current_login_streak > 0;
```

### Recommandations

1. **Vacuum régulier**: `VACUUM ANALYZE` hebdomadaire
2. **Monitoring**: Surveiller `pg_stat_user_tables`
3. **Indexes partiels**: WHERE clauses pour filtrer données nulles/inactives
4. **Foreign keys**: Toujours avec ON DELETE CASCADE/SET NULL

---

## 📝 Notes pour Claude Code

### Avant Toute Modification DB

1. ✅ Lire ce fichier pour vérifier l'existence des colonnes
2. ✅ Vérifier les contraintes (CHECK, UNIQUE, FK)
3. ✅ Toujours inclure `guild_id` dans les requêtes
4. ✅ Créer une migration SQL versionnée
5. ✅ Tester avec un script Node.js avant déploiement

### Types de Colonnes Courants

| Type | Usage | Exemple |
|------|-------|---------|
| `TEXT` | IDs Discord, guild_id | `'1248028543389143070'` |
| `INTEGER` | IDs internes, compteurs | `1, 42, 100` |
| `BOOLEAN` | Flags | `TRUE, FALSE` |
| `TIMESTAMP` | Dates/heures | `NOW(), '2025-11-20 20:00:00'` |
| `DATE` | Dates seules | `CURRENT_DATE, '2025-11-20'` |
| `JSONB` | Données structurées | `'{"key": "value"}'` |

---

*Document généré automatiquement par audit-and-update-database-schema.js*
*Pour toute modification, régénérer avec: `node scripts/audit-and-update-database-schema.js`*
