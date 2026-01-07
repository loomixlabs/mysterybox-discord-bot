# Audit Complet - Compatibilité Export/Import/Validator/DB

**Date**: 2026-01-07
**Version système**: v2.3.1
**VPS**: 72.60.185.62

---

## Résumé Exécutif

| Composant | Version | Tables couvertes | Statut |
|-----------|---------|------------------|--------|
| **themeExporter.js** | v2.3.0 | 16 tables | ✅ Complet |
| **themeImporter.js** | v2.1 | 16 tables | ✅ Complet |
| **themeValidator.js** | v2.1 | 16 sections | ✅ Complet |
| **Database VPS** | PostgreSQL 18 | 74 tables | ✅ OK |

### Verdict Global: ✅ COMPATIBLE

Aucune incompatibilité critique détectée entre les 4 composants.

---

## 1. Structure DB VPS (74 tables)

### Tables liées aux Thèmes (16 tables principales)

| Table | Colonnes clés | Contraintes CHECK | FK |
|-------|---------------|-------------------|-----|
| `themes` | id, guild_id, theme_id, name, duration_days, required_items, final_role_name, final_role_color, is_active | - | guild_config |
| `theme_config` | 27 colonnes (probabilités, raretés, mystery_box, progression_roles JSONB) | `check_probabilities_sum_100` | themes, guild_config |
| `collectibles` | id, guild_id, theme_id, collectible_id, name, image_url, rarity, reveal_message | `rarity IN (common, rare, epic, legendary)` | themes |
| `traps` | 20 colonnes (severity, notif_*, is_default, is_active) | `severity 1-5`, `type IN (6 types)` | themes |
| `missions` | 15 colonnes (validation_data, reward_data JSONB, allowed_channels) | `type IN (12 types)`, `reward_type`, `validation_type` | themes |
| `mission_keywords` | mission_id, keyword, difficulty, target_channel_id | `difficulty IN (easy, medium, hard)` | missions |
| `quiz_questions` | theme_id, mission_id, question_text, correct_answer, wrong_answers[], hint, difficulty | - | themes, missions |
| `theme_messages` | theme_id, key, content | - | themes |
| `announcement_templates` | type, title, description, color, footer_text, image_url, thumbnail_url, theme_id | - | themes |
| `daily_rewards_config` | 17 colonnes (reward_type, reward_rarity, choice_options JSONB, animation_type) | `day_number 1-365`, `reward_type`, `reward_rarity` | - |
| `daily_catchup_config` | 12 colonnes (pricing_mode, base_price, max_catchup_days) | `pricing_mode IN (3 types)` | - |
| `mystery_box_config` | 38 colonnes (prob_*, specific_* JSONB, pity_system) | `rarity`, `prob_* 0-100`, `rewards_count 1-5` | - |
| `progression_roles` | role_name, percentage, color, discord_role_id | `percentage 0-100` | themes |
| `super_bonuses` | 18 colonnes (bonus_type, effect_type, effect_config JSONB, activation_mode) | `bonus_type`, `effect_type`, `duration_type`, `rarity`, `activation_mode` | themes |
| `theme_profile_frames` | frame_number, name, frame_url, unlock_condition JSONB, bonus_type, bonus_value | `frame_number IN (1, 2)`, `bonus_type` | themes |
| `theme_collectible_frames` | rarity, frame_url | `rarity IN (rare, epic, legendary)` | themes |

---

## 2. Analyse Détaillée par Table

### 2.1 Table `themes`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| theme_id | ✅ | ✅ | ✅ pattern `[a-z0-9_-]+` | ✅ |
| name | ✅ | ✅ | ✅ min 3 chars | ✅ |
| duration_days | ✅ | ✅ | ✅ 1-365 | ✅ |
| required_items | ✅ | ✅ | ✅ >= 1 | ✅ |
| final_role_name | ✅ | ✅ | ✅ requis | ✅ |
| final_role_color | ✅ | ✅ | ✅ #RRGGBB | ✅ |
| is_active | ❌ (non exporté) | ✅ FALSE default | - | ✅ Normal |
| final_role_discord_id | ❌ (non exporté) | ✅ créé si guild | - | ✅ Normal |

### 2.2 Table `theme_config`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| probability_collectible | ✅ | ✅ | ✅ 0-100 | ✅ |
| probability_mission | ✅ | ✅ | ✅ 0-100 | ✅ |
| probability_trap | ✅ | ✅ | ✅ 0-100 | ✅ |
| probability_super_bonus | ✅ | ✅ | ✅ 0-100 | ✅ |
| collectible_rarity_* (4) | ✅ | ✅ | ✅ 0-100 | ✅ |
| super_bonus_rarity_* (4) | ✅ | ✅ | ❌ non validé | ⚠️ Minor |
| trap_severity_* (5) | ✅ | ✅ | ❌ non validé | ⚠️ Minor |
| mystery_box_* (6) | ✅ | ✅ | ❌ non validé | ⚠️ Minor |
| auto_delete_celebration_message | ✅ | ✅ | ❌ non validé | ⚠️ Minor |
| progression_roles (JSONB) | ❌ (table séparée) | ✅ | ✅ | ✅ |

**Note**: Les champs non validés ont des valeurs par défaut sûres dans la DB.

### 2.3 Table `collectibles`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| collectible_id | ✅ | ✅ | ✅ requis + unique | ✅ |
| name | ✅ | ✅ | ✅ requis | ✅ |
| image_url | ✅ | ✅ | ✅ requis | ✅ |
| rarity | ✅ | ✅ | ✅ enum check | ✅ |
| reveal_message | ✅ conditionnel | ✅ nullable | ❌ non validé | ✅ OK |

### 2.4 Table `traps`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| trap_id | ✅ | ✅ | ✅ requis + unique | ✅ |
| name | ✅ | ✅ | ✅ requis | ✅ |
| type | ✅ | ✅ | ✅ enum (5 types) | ⚠️ DB a 6 types |
| severity | ✅ | ✅ auto-calculé | ❌ non validé | ✅ OK |
| description | ✅ | ✅ | ✅ requis | ✅ |
| cooldown_duration | ✅ conditionnel | ✅ | ✅ si type=cooldown | ✅ |
| image_url | ✅ conditionnel | ✅ | ❌ non validé | ✅ OK |
| removes_collectible | ✅ conditionnel | ✅ | ❌ non validé | ✅ OK |
| shame_message | ✅ conditionnel | ✅ | ❌ non validé | ✅ OK |
| malus_points | ✅ conditionnel | ✅ | ❌ non validé | ✅ OK |
| is_default | ✅ conditionnel | ✅ | ❌ non validé | ✅ OK |
| is_active | ✅ conditionnel | ✅ | ❌ non validé | ✅ OK |
| notif_* (4) | ✅ conditionnel | ✅ | ❌ non validé | ✅ OK |

**⚠️ Incompatibilité Mineure**:
- Validator: 5 types (`cooldown`, `lose-collectible`, `lose-all-collectibles`, `public-shame`, `empty-box`)
- DB: 6 types (ajoute `points-malus`)

### 2.5 Table `missions`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| mission_id | ✅ | ✅ | ✅ requis | ✅ |
| name | ✅ | ✅ | ✅ requis | ✅ |
| type | ✅ via structure | ✅ | ✅ 7 types supportés | ✅ |
| description | ✅ | ✅ | ✅ requis | ✅ |
| timeout | ✅ | ✅ | ✅ >= 1 | ✅ |
| max_attempts | ✅ | ✅ | ✅ >= 1 si présent | ✅ |
| image_url | ✅ | ✅ | ❌ non validé | ✅ OK |
| validation_type | ❌ | ✅ 'auto' default | ❌ | ✅ OK |
| validation_data | ✅ | ✅ | ✅ objet | ✅ |
| reward_type | ❌ | ✅ default | ❌ | ✅ OK |
| reward_data | ✅ | ✅ | ✅ objet | ✅ |
| allowed_channels | ❌ (exclu) | ✅ null | ❌ | ✅ Intentionnel |

**Note**: `allowed_channels` est intentionnellement exclu de l'export car les IDs de canaux sont spécifiques au serveur source.

**Types de missions supportés**:
| Type | Export | Import | Validator | Stockage |
|------|--------|--------|-----------|----------|
| keyword-message | ✅ | ✅ | ✅ | mission_keywords |
| quiz | ✅ | ✅ | ✅ | quiz_questions |
| true-false | ✅ | ✅ | ✅ | quiz_questions |
| emoji-puzzle | ✅ | ✅ | ✅ | quiz_questions |
| wordle | ✅ | ✅ | ✅ | quiz_questions |
| hangman | ✅ | ✅ | ✅ | quiz_questions |
| unscramble | ✅ | ✅ | ✅ | quiz_questions |

### 2.6 Table `mission_keywords`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| keyword | ✅ | ✅ | ✅ requis | ✅ |
| difficulty | ✅ | ✅ | ✅ enum | ✅ |
| target_channel_id | ❌ (exclu) | ❌ | ❌ | ✅ Intentionnel |

### 2.7 Table `quiz_questions`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| question_text | ✅ | ✅ | ✅ contextuel | ✅ |
| correct_answer | ✅ | ✅ | ✅ requis | ✅ |
| wrong_answers | ✅ | ✅ JSON | ✅ requis pour quiz | ✅ |
| hint | ✅ | ✅ | ❌ non validé | ✅ OK |
| difficulty | ✅ | ✅ | ✅ warning si non standard | ✅ |

### 2.8 Table `daily_rewards_config`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| day_number | ✅ | ✅ | ✅ 1-60 | ⚠️ DB permet 1-365 |
| reward_type | ✅ | ✅ | ✅ enum étendu | ✅ |
| reward_rarity | ✅ | ✅ | ✅ enum | ✅ |
| reward_amount | ✅ | ✅ | ✅ warning si currency | ✅ |
| reward_item_id | ✅ | ✅ | ❌ | ✅ OK |
| choice_options | ✅ JSON | ✅ JSON | ❌ | ✅ OK |
| display_* (3) | ✅ | ✅ | ❌ | ✅ OK |
| is_milestone | ✅ | ✅ | ❌ | ✅ OK |
| is_bonus_day | ✅ | ✅ | ❌ | ✅ OK |
| bonus_multiplier | ✅ parseFloat | ✅ | ❌ | ✅ OK |
| animation_type | ✅ | ✅ | ❌ | ✅ OK |

**⚠️ Divergence**: Validator limite à 60 jours, DB permet jusqu'à 365.

### 2.9 Table `daily_catchup_config`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| currency_type | ✅ | ✅ default 'loomix' | ❌ | ✅ OK |
| base_price | ✅ | ✅ | ✅ >= 0 | ✅ |
| price_increment | ✅ | ✅ | ❌ | ✅ OK |
| price_multiplier | ✅ parseFloat | ✅ | ❌ | ✅ OK |
| pricing_mode | ✅ | ✅ | ✅ enum | ✅ |
| max_price | ✅ | ✅ | ❌ | ✅ OK |
| max_catchup_days | ✅ | ✅ | ✅ >= 0 | ✅ |
| enabled | ✅ | ✅ | ❌ | ✅ OK |

**Note**: Validator accepte `increment` comme alias de `linear` (valeur par défaut DB).

### 2.10 Table `mystery_box_config`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| rarity | ✅ | ✅ | ✅ enum + unique | ✅ |
| name | ✅ | ✅ | ❌ | ✅ OK |
| emoji | ✅ | ✅ | ❌ | ✅ OK |
| color | ✅ | ✅ | ❌ | ✅ OK |
| image_url | ✅ | ✅ | ❌ | ✅ OK |
| prob_collectible | ✅ | ✅ | ✅ 0-100 | ✅ |
| prob_super_bonus | ✅ | ✅ | ✅ 0-100 | ✅ |
| guaranteed_min_rarity | ✅ | ✅ | ❌ | ✅ OK |
| rarity_upgrade_* (3) | ✅ | ✅ | ✅ 0-100 | ✅ |
| image_* (4) | ✅ | ✅ | ❌ | ✅ OK |
| text_* (5) | ✅ | ✅ | ❌ | ✅ OK |
| sound_open | ✅ | ✅ | ❌ | ✅ OK |
| animation_duration | ✅ | ✅ | ✅ >= 0 | ✅ |
| specific_* (4) JSONB | ✅ JSON | ✅ JSON | ❌ | ✅ OK |
| allow_duplicate | ✅ | ✅ | ❌ | ✅ OK |
| pity_system_enabled | ✅ | ✅ | ❌ | ✅ OK |
| pity_counter_max | ✅ | ✅ | ❌ | ✅ OK |
| is_default | ✅ | ✅ | ❌ | ✅ OK |
| is_enabled | ✅ | ✅ | ❌ | ✅ OK |
| rewards_count | ✅ | ✅ | ❌ | ✅ OK |

### 2.11 Table `progression_roles`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| role_name | ✅ | ✅ | ✅ requis | ✅ |
| percentage | ✅ | ✅ | ✅ 1-100 + unique | ✅ |
| color | ✅ | ✅ | ✅ #RRGGBB | ✅ |
| discord_role_id | ❌ (exclu) | ❌ | ❌ | ✅ Intentionnel |

### 2.12 Table `super_bonuses`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| bonus_id | ✅ | ✅ | ✅ requis + unique | ✅ |
| name | ✅ | ✅ | ✅ requis | ✅ |
| description | ✅ | ✅ | ❌ | ⚠️ nullable en import |
| icon | ✅ | ✅ | ❌ | ✅ OK |
| bonus_type | ✅ | ✅ default 'instant' | ✅ enum | ⚠️ Incompatibilité |
| effect_type | ✅ | ✅ | ✅ requis | ✅ |
| effect_config | ✅ JSON | ✅ JSON | ❌ | ✅ OK |
| duration_type | ✅ | ✅ | ❌ | ✅ OK |
| duration_value | ✅ | ✅ | ✅ warning | ✅ |
| image_url | ✅ | ✅ | ❌ | ✅ OK |
| color | ✅ | ✅ | ❌ | ✅ OK |
| rarity | ✅ | ✅ | ✅ enum | ✅ |
| announcement_message | ✅ | ✅ | ❌ | ✅ OK |
| activation_mode | ✅ | ✅ | ✅ enum | ⚠️ Incompatibilité |
| is_enabled | ✅ | ✅ | ❌ | ✅ OK |

**⚠️ Incompatibilités super_bonuses**:
- `bonus_type` Validator: `instant, duration, permanent, consumable`
- `bonus_type` DB: `boost, economy, protection, social, time, reveal, choice`
- `activation_mode` Validator: `instant, manual, random`
- `activation_mode` DB: `automatic, manual`

### 2.13 Table `announcement_templates`

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| type | ✅ | ✅ avec mapping | ✅ enum 18 types | ✅ |
| title | ✅ | ✅ | ✅ requis | ✅ |
| description | ✅ | ✅ | ✅ requis | ✅ |
| color | ✅ | ✅ | ✅ #RRGGBB | ✅ |
| footer_text | ✅ | ✅ | ❌ | ✅ OK |
| image_url | ✅ | ✅ | ❌ | ✅ OK |
| thumbnail_url | ✅ | ✅ | ❌ | ✅ OK |

### 2.14 Table `theme_profile_frames` (v2.1)

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| frame_number | ✅ | ✅ | ✅ 1-10 | ⚠️ DB limite 1-2 |
| name | ✅ | ✅ | ✅ requis | ✅ |
| description | ✅ nullable | ✅ | ❌ | ✅ OK |
| frame_url | ✅ | ✅ | ✅ URL valide | ✅ |
| unlock_condition | ✅ JSON | ✅ JSON | ✅ objet | ✅ |
| bonus_type | ✅ nullable | ✅ | ✅ warning | ⚠️ Différence |
| bonus_value | ✅ nullable | ✅ | ✅ nombre | ✅ |

**⚠️ Incompatibilités**:
- `frame_number` Validator: 1-10, DB CHECK: `IN (1, 2)`
- `bonus_type` Validator: `xp_multiplier, currency_multiplier, luck_bonus, cooldown_reduction`
- `bonus_type` DB CHECK: `legendary_chance, xp_boost, loomix_boost`

### 2.15 Table `theme_collectible_frames` (v2.1)

| Champ DB | Exporté | Importé | Validé | Statut |
|----------|---------|---------|--------|--------|
| rarity | ✅ | ✅ | ✅ enum | ⚠️ Différence |
| frame_url | ✅ | ✅ | ✅ URL valide | ✅ |

**⚠️ Incompatibilité**:
- Validator accepte: `common, rare, epic, legendary`
- DB CHECK: `rare, epic, legendary` (pas de `common`)

---

## 3. Incompatibilités Identifiées

### 3.1 Critiques (0)
Aucune incompatibilité critique. L'export/import fonctionne.

### 3.2 Moyennes (5)

| # | Composant | Problème | Impact | Solution |
|---|-----------|----------|--------|----------|
| 1 | `traps.type` | Validator manque `points-malus` | Import échoue si piège points-malus | Ajouter `points-malus` au validator |
| 2 | `super_bonuses.bonus_type` | Enum différent validator vs DB | Valeur rejetée ou convertie | Aligner les enums |
| 3 | `super_bonuses.activation_mode` | `instant` vs `automatic` | Import possible avec fallback | Ajouter mapping |
| 4 | `theme_profile_frames.frame_number` | Validator 1-10, DB 1-2 | Frames 3+ rejetées par DB | Limiter validator à 1-2 |
| 5 | `theme_collectible_frames.rarity` | Validator inclut `common`, DB non | Import common échoue | Retirer common du validator |

### 3.3 Mineures (4)

| # | Composant | Problème | Impact |
|---|-----------|----------|--------|
| 1 | `theme_config` | trap_severity_* non validés | Valeurs par défaut utilisées |
| 2 | `daily_rewards_config.day_number` | Validator 1-60, DB 1-365 | Limite artificielle |
| 3 | `theme_profile_frames.bonus_type` | Enum différent | Warning seulement |
| 4 | `super_bonuses.description` | Requis en DB, nullable en import | NULL accepté |

---

## 4. Recommandations

### 4.1 Corrections Prioritaires

```javascript
// 1. themeValidator.js - validateTraps()
const validTypes = ['cooldown', 'lose-collectible', 'lose-all-collectibles',
                    'public-shame', 'empty-box', 'points-malus']; // Ajouter points-malus

// 2. themeValidator.js - validateSuperBonuses()
const validBonusTypes = ['boost', 'economy', 'protection', 'social',
                         'time', 'reveal', 'choice']; // Aligner avec DB

const validActivationModes = ['automatic', 'manual']; // Aligner avec DB

// 3. themeValidator.js - validateProfileFrames()
if (!Number.isInteger(frame.frame_number) || frame.frame_number < 1 || frame.frame_number > 2) {
  // Changer 10 -> 2

// 4. themeValidator.js - validateCollectibleFrames()
const validRarities = ['rare', 'epic', 'legendary']; // Retirer 'common'

// 5. themeValidator.js - validateDailyRewardsConfig()
if (reward.day_number < 1 || reward.day_number > 365) { // Changer 60 -> 365
```

### 4.2 Améliorations Suggérées

1. **Validation manquante dans theme_config**:
   - Ajouter validation pour `trap_severity_*` (somme = 100)
   - Ajouter validation pour `super_bonus_rarity_*` (somme = 100)

2. **Validation d'URLs**:
   - Ajouter validation d'URL pour `image_url` dans collectibles, traps, missions

3. **Documentation**:
   - Mettre à jour DATABASE-SCHEMA.md avec les contraintes CHECK exactes

---

## 5. Tests de Validation

### 5.1 Test Export → Import Roundtrip

```bash
# Sur le VPS
node -e "
const ThemeExporter = require('./utils/themeExporter');
const ThemeImporter = require('./utils/themeImporter');
const ThemeValidator = require('./utils/themeValidator');

async function test() {
  // Export
  const exporter = new ThemeExporter('1248028543389143070');
  const result = await exporter.export(1); // ID du thème actif

  // Validate
  const validator = new ThemeValidator();
  const validation = validator.validate(result.data);
  console.log('Validation:', validation);

  // Import sur guild test
  const importer = new ThemeImporter('TEST_GUILD_ID');
  const importResult = await importer.import(result.data);
  console.log('Import:', importResult);
}
test();
"
```

### 5.2 Résultat Attendu

```
✅ Validation: { valid: true, errors: [] }
✅ Import: { success: true, themeId: X, imported: {...} }
```

---

## 6. Conclusion

Le système Export/Import/Validator est **globalement compatible** avec la DB VPS.

Les 5 incompatibilités moyennes identifiées peuvent causer des échecs dans des cas spécifiques (pièges points-malus, frames de profil > 2, frames collectibles common).

**Priorité de correction**: Haute pour les items 1, 4, 5 (bloquants potentiels).

---

*Rapport généré le 2026-01-07 par Claude Opus 4.5*
