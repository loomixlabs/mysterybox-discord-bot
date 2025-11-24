# ========================================
# Dockerfile pour Bot Discord Give Gamifié
# ========================================

FROM node:20-alpine

# Métadonnées
LABEL maintainer="Votre Nom"
LABEL description="Bot Discord Give Gamifié - Version Multi-serveur"

# Installer les dépendances système nécessaires
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client

# Créer le répertoire de l'application
WORKDIR /app

# Copier les fichiers package
COPY package*.json ./

# Installer les dépendances Node.js
RUN npm install --only=production && npm cache clean --force

# Copier le code source
COPY . .

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Basculer vers l'utilisateur non-root
USER nodejs

# Exposer le port (si nécessaire pour API future)
# EXPOSE 3000

# Healthcheck (optionnel)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Démarrer le bot
CMD ["node", "index.js"]
