# 🎮 Bot Discord Giveaway Gamifié

Bot Discord pour créer des giveaways thématiques gamifiés où les joueurs collectent des items pour débloquer un rôle privilège.

## 🌟 Fonctionnalités

- ✅ Giveaways "premier arrivé"
- ✅ Système de collection avec progression
- ✅ Missions avec validation automatique/manuelle
- ✅ Pièges et événements spéciaux
- ✅ Leaderboard en temps réel
- ✅ Configuration via Discord (commandes slash)
- ✅ Threads privés pour les missions
- ✅ Base de données PostgreSQL

## 📦 Stack Technique

- **Runtime:** Node.js 20+
- **Framework Bot:** Discord.js v14
- **Base de données:** PostgreSQL (Railway)
- **Hébergement:** Railway
- **Versioning:** GitHub

## 🚀 Installation Locale

### 1. Prérequis

- Node.js 20+ installé
- Un compte Discord Developer
- PostgreSQL (local ou Railway)

### 2. Cloner le projet

```bash
git clone https://github.com/ton-username/bot-discord.git
cd bot-discord
```

### 3. Installer les dépendances

```bash
npm install
```

### 4. Configuration

Créer un fichier `.env` à la racine :

```env
# Discord
DISCORD_TOKEN=ton_token_discord
APPLICATION_ID=ton_application_id
GUILD_ID=ton_serveur_id

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/botdb

# Permissions
CO_FOUNDER_ROLE_ID=123456789012345678

# Salons
ANNOUNCE_CHANNEL_ID=123456789012345678
GENERAL_CHANNEL_ID=123456789012345678
```

### 5. Initialiser la base de données

Exécuter le fichier `database/schema.sql` dans votre PostgreSQL :

```bash
psql -U user -d botdb -f database/schema.sql
```

Ou via un outil GUI comme pgAdmin, DBeaver, etc.

### 6. Déployer les commandes slash

```bash
npm run deploy
```

### 7. Lancer le bot

```bash
npm start
```

Le bot devrait afficher :
```
✅ Bot prêt ! Connecté en tant que BotName#1234
✅ Database connected
🚀 Le bot est opérationnel !
```

---

## 🌐 Déploiement sur Railway

### 1. Créer un compte Railway

- Aller sur https://railway.app
- Se connecter avec GitHub

### 2. Créer un nouveau projet

- **New Project** → **Deploy from GitHub repo**
- Sélectionner votre repo `bot-discord`

### 3. Ajouter PostgreSQL

- Dans le projet Railway : **New** → **Database** → **Add PostgreSQL**
- Railway va automatiquement créer `DATABASE_URL`

### 4. Configurer les variables d'environnement

Dans **Variables**, ajouter :

```
DISCORD_TOKEN=...
APPLICATION_ID=...
GUILD_ID=...
CO_FOUNDER_ROLE_ID=...
ANNOUNCE_CHANNEL_ID=...
GENERAL_CHANNEL_ID=...
```

### 5. Initialiser la base de données

Deux options :

**Option A - Via Query Editor Railway :**
- Ouvrir PostgreSQL dans Railway
- Onglet **Query**
- Copier/coller le contenu de `database/schema.sql`
- Exécuter

**Option B - Via CLI Railway :**
```bash
railway login
railway link
railway run psql $DATABASE_URL < database/schema.sql
```

### 6. Déployer

Railway déploie automatiquement à chaque push GitHub !

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

Le bot démarre automatiquement. Vérifier les logs dans Railway Dashboard.

---

## 📋 Commandes Disponibles

### 🔧 Commandes Admin (Co-Fondateurs uniquement)

| Commande | Description |
|----------|-------------|
| `/give-create` | Créer un giveaway (collectible ou piège) |
| `/give-list` | Voir la liste des items disponibles |

### 👥 Commandes Joueur

| Commande | Description |
|----------|-------------|
| `/profile` | Voir sa progression |
| `/leaderboard` | Voir le classement |

---

## 🎮 Utilisation

### 1. Créer le premier thème

Le thème "Blanche-Neige" est créé automatiquement lors de l'initialisation de la BDD.

Pour vérifier :
```sql
SELECT * FROM themes WHERE is_active = TRUE;
```

### 2. Ajouter des collectibles (nains)

**Manuellement en SQL** :

```sql
INSERT INTO collectibles (theme_id, collectible_id, name, role_name, role_color, image_url, has_mission, mission_desc, mission_timeout)
VALUES (
  1,
  'simplet',
  'Simplet',
  '🤪 Simplet',
  '#FF6B6B',
  'https://ton-cdn.com/simplet.png',
  TRUE,
  'Poste une blague dans #général',
  30
);
```

**Via commande Discord (à venir)** :
```
/collectible-add
```

### 3. Créer les rôles Discord

Pour chaque collectible, créer manuellement le rôle Discord correspondant :

1. Paramètres serveur → Rôles → Créer un rôle
2. Nom : `🤪 Simplet`
3. Couleur : `#FF6B6B`
4. Copier l'ID du rôle
5. Mettre à jour la BDD :

```sql
UPDATE collectibles
SET role_discord_id = '123456789012345678'
WHERE collectible_id = 'simplet';
```

### 4. Lancer un give

```
/give-list
```
→ Noter l'ID du collectible (ex: `1`)

```
/give-create type:collectible item_id:1
```

Le give est posté dans le salon actuel !

### 5. Joueur participe

Un joueur clique sur **🎯 PARTICIPER**

→ Le bot :
1. Désactive le bouton (premier arrivé)
2. Vérifie si doublon
3. Attribue le rôle
4. Crée un thread privé si mission

### 6. Valider une mission

Dans le thread privé, l'admin clique sur **✅ Valider** ou **❌ Refuser**.

---

## 🗄️ Structure de la Base de Données

### Tables Principales

- `themes` - Thèmes de jeu
- `collectibles` - Items à collecter (nains)
- `traps` - Pièges
- `players` - Joueurs
- `collections` - Items collectés par joueur
- `player_progress` - Progression par thème
- `mission_progress` - Suivi des missions
- `give_logs` - Historique des gives
- `audit_logs` - Actions admin

### Relations

```
themes
  ├── collectibles
  ├── traps
  └── theme_messages

players
  ├── collections → collectibles
  ├── player_progress → themes
  └── mission_progress
```

---

## 🛠️ Développement

### Structure du projet

```
bot-discord/
├── commands/          # Commandes slash
│   ├── admin/        # Commandes admin
│   └── player/       # Commandes joueur
├── events/           # Événements Discord
├── handlers/         # Logique métier
├── utils/            # Utilitaires
├── database/         # Schéma SQL
└── index.js          # Point d'entrée
```

### Ajouter une commande

1. Créer `commands/player/ma-commande.js`
2. Copier le template :

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ma-commande')
    .setDescription('Description'),

  async execute(interaction) {
    await interaction.reply('Hello !');
  }
};
```

3. Redéployer les commandes :
```bash
npm run deploy
```

4. Redémarrer le bot

---

## 🐛 Dépannage

### Le bot ne se connecte pas

Vérifier `.env` :
```bash
echo $DISCORD_TOKEN
```

Vérifier que le token est valide sur https://discord.com/developers/applications

### La base de données ne se connecte pas

Tester la connexion :
```bash
psql $DATABASE_URL
```

Vérifier que `DATABASE_URL` est correcte dans Railway Dashboard.

### Les commandes n'apparaissent pas

Redéployer :
```bash
npm run deploy
```

Attendre 5-10 minutes (cache Discord).

### Le bouton ne fonctionne pas

Vérifier les logs :
```bash
railway logs
```

Vérifier que `interactionCreate` est bien chargé.

---

## 📝 TODO

- [ ] Commandes `/theme-create`, `/theme-edit` avec modals
- [ ] Commande `/collectible-add` avec modals
- [ ] Commande `/trap-add` avec modals
- [ ] Système de streaks (séries)
- [ ] Happy Hour automatique (cron)
- [ ] Échanges entre joueurs
- [ ] Export des stats en CSV

---

## 📄 Licence

MIT

---

## 🤝 Contribution

Les Pull Requests sont bienvenues !

1. Fork le projet
2. Créer une branche (`git checkout -b feature/ma-feature`)
3. Commit (`git commit -m 'Ajout feature'`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvrir une Pull Request

---

## 📧 Support

Pour toute question :
- Ouvrir une issue sur GitHub
- Contacter les admins du serveur Discord

---

**Made with ❤️ pour la communauté**
