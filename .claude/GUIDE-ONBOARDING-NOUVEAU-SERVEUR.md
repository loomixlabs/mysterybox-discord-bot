# Guide d'Onboarding - Nouveau Serveur Discord

> **Version**: 1.0.0
> **Date**: 2025-11-23
> **Statut**: Production Ready

---

## Vue d'Ensemble

Ce guide décrit le processus complet pour déployer le bot sur un nouveau serveur Discord, de l'invitation initiale à l'activation complète.

---

## 1. Pré-requis

### 1.1 Côté Bot Owner (Super Admin)
- Accès au panel `/super-admin-panel`
- Variables d'environnement configurées dans `.env`:
  ```env
  APPLICATION_ID=<votre_application_id>
  DISCORD_TOKEN=<votre_token>
  ```

### 1.2 Côté Serveur Cible
- L'administrateur du serveur doit avoir les permissions `Manage Guild`
- Le serveur doit être accessible (non en mode communautaire restreint)

---

## 2. Flow d'Onboarding Complet

### Étape 1: Génération du Lien d'Invitation

**Option A: Via Script**
```bash
node scripts/generate-invite-url.js [GUILD_ID]
```

**Option B: Via OAuth2 Generator**
```javascript
const oauthGenerator = require('./utils/oauthGenerator');
const url = oauthGenerator.generateInviteUrl(process.env.APPLICATION_ID, {
  guildId: 'ID_DU_SERVEUR',  // Optionnel: pré-sélectionne le serveur
  scopes: ['bot', 'applications.commands'],
  permissions: ['ADMINISTRATOR']  // Ou liste détaillée
});
console.log(url);
```

### Étape 2: Installation du Bot

1. L'admin du serveur cible clique sur le lien d'invitation
2. Sélectionne le serveur (ou pré-sélectionné)
3. Accepte les permissions demandées
4. Le bot rejoint le serveur

### Étape 3: Auto-Enregistrement du Serveur

Le serveur est **automatiquement enregistré** lors de la première interaction:

```javascript
// Dans subscriptionHandler.js -> checkSubscriptionStatus()
if (!config) {
  // Nouveau serveur - l'enregistrer automatiquement
  await GuildConfig.registerGuild(guildId, guild.name, guild.ownerId);
  console.log(`✅ Nouveau serveur auto-enregistré: ${guild.name}`);
  return true;  // Actif par défaut
}
```

**Tables créées automatiquement:**
- `guild_config` - Configuration principale
- `guild_stats` - Statistiques du serveur
- `announcement_settings` - Paramètres d'annonces

### Étape 4: Diagnostic Initial (Recommandé)

L'admin du serveur exécute:
```
/check-setup
```

Cette commande vérifie:
- ✅ Permissions du bot (rôles, canaux, etc.)
- ✅ Hiérarchie des rôles
- ✅ Configuration de la base de données
- ✅ Thèmes disponibles

Si des problèmes sont détectés, un lien de réinvitation avec les bonnes permissions est fourni.

### Étape 5: Configuration Initiale

L'admin exécute le wizard de configuration:
```
/setup
```

Le wizard guide à travers:
1. Configuration des rôles admin
2. Sélection des canaux d'annonce
3. Configuration du thème initial (optionnel)

### Étape 6: Activation par Super Admin (Si Trial/Premium)

**Via Super Admin Panel:**
1. Super Admin exécute `/super-admin-panel`
2. Navigue vers "Gestion Serveurs"
3. Sélectionne le nouveau serveur
4. Options disponibles:
   - **Démarrer Essai** → Configure une période d'essai (X jours)
   - **Activer** → Active sans limite (premium)
   - **Convertir en Premium** → Transforme un essai en premium

---

## 3. Système de Subscriptions

### 3.1 États Possibles

| État | Description | Accès |
|------|-------------|-------|
| `not_registered` | Serveur jamais utilisé | Auto-enregistrement à la 1ère interaction |
| `premium` | Version complète | ✅ Toutes fonctionnalités |
| `trial` | Période d'essai | ✅ Limité dans le temps |
| `trial_expired` | Essai terminé | ❌ Bloqué |
| `inactive` | Désactivé manuellement | ❌ Bloqué |

### 3.2 Gestion des Essais

**Démarrer un essai:**
```javascript
await GuildConfig.startTrial(guildId, 14, 100);
// 14 jours, max 100 joueurs
```

**Prolonger un essai:**
```javascript
await GuildConfig.extendTrial(guildId, 7);
// +7 jours supplémentaires
```

**Convertir en premium:**
```javascript
await GuildConfig.convertToPremium(guildId, null);
// null = joueurs illimités
```

### 3.3 Automatismes

Le système vérifie automatiquement:

| Tâche | Fréquence | Action |
|-------|-----------|--------|
| Essais expirés | Toutes les heures | Désactive le serveur, notifie owner |
| Essais proches expiration | Tous les jours | Envoie DM de rappel (3 jours avant) |

---

## 4. Commandes Disponibles

### Pour les Admins du Serveur

| Commande | Description |
|----------|-------------|
| `/setup` | Wizard de configuration initiale |
| `/check-setup` | Diagnostic complet du bot |
| `/admin-panel` | Panel d'administration |
| `/server-config` | Configuration globale (branding) |

### Pour les Joueurs

| Commande | Description |
|----------|-------------|
| `/profile` | Voir sa progression |
| `/leaderboard` | Classement des joueurs |

### Pour le Super Admin

| Commande | Description |
|----------|-------------|
| `/super-admin-panel` | Panel multi-serveur |

---

## 5. Troubleshooting

### Le bot ne répond pas
1. Vérifier que le bot est bien en ligne
2. Exécuter `/check-setup` pour diagnostiquer
3. Vérifier les permissions dans les paramètres du serveur

### "Période d'essai expirée"
1. Contacter le super admin
2. Options: prolonger l'essai ou passer en premium

### "Bot désactivé sur ce serveur"
1. Le serveur a été désactivé manuellement
2. Contacter le super admin pour réactivation

### Permissions manquantes
1. Exécuter `/check-setup`
2. Utiliser le lien de réinvitation fourni
3. S'assurer que le rôle du bot est au-dessus des rôles à gérer

---

## 6. Architecture Technique

### Fichiers Impliqués

```
utils/
├── guildConfig.js         # Gestion config serveur + trials
├── oauthGenerator.js      # Génération URL invitation
├── setupDiagnostic.js     # Diagnostic complet

handlers/
├── subscriptionHandler.js # Vérification auto subscriptions
├── superAdminHandler.js   # UI gestion trials

commands/
├── admin/
│   ├── check-setup.js     # Commande diagnostic
│   └── setup.js           # Wizard configuration
└── superadmin/
    └── super-admin-panel.js

events/
└── ready.js               # Initialisation des crons
```

### Base de Données

```sql
-- Table principale
guild_config (
  guild_id        VARCHAR PRIMARY KEY,
  guild_name      VARCHAR,
  owner_id        VARCHAR,
  is_active       BOOLEAN DEFAULT TRUE,
  is_trial        BOOLEAN DEFAULT FALSE,
  trial_expires_at TIMESTAMP,
  max_players     INTEGER,
  activated_at    TIMESTAMP,
  deactivated_at  TIMESTAMP,
  last_activity   TIMESTAMP,
  notes           TEXT
)
```

---

## 7. Checklist Déploiement

### Pour chaque nouveau serveur:

- [ ] Lien d'invitation généré
- [ ] Bot installé sur le serveur
- [ ] `/check-setup` exécuté sans erreur
- [ ] `/setup` complété par l'admin
- [ ] Trial ou Premium activé (si requis)
- [ ] Thème configuré
- [ ] Canaux d'annonce définis

---

## 8. Bonnes Pratiques

1. **Toujours commencer par `/check-setup`** pour identifier les problèmes
2. **Utiliser des essais de 14 jours** pour les nouveaux serveurs
3. **Envoyer les notifications 3 jours avant expiration**
4. **Documenter les raisons de désactivation** dans le champ `notes`
5. **Mettre à jour les stats régulièrement** via `GuildConfig.updateStats()`

---

**Dernière mise à jour**: 2025-11-23
