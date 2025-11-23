/**
 * Utilitaire de comparaison intelligente pour les réponses de quiz
 *
 * Fonctionnalités:
 * - Tolérance aux fautes de frappe (Levenshtein distance)
 * - Suppression automatique des articles français
 * - Support des réponses multiples (toutes requises)
 * - Séparateurs flexibles (virgule, "et", espace)
 */

// Articles français à ignorer
const FRENCH_ARTICLES = [
  'le', 'la', 'les', 'un', 'une', 'des',
  "l'", "d'", 'du', 'au', 'aux',
  'l\'', 'd\''  // Versions avec apostrophe échappée
];

// Seuils de similarité (ajustés pour mots courts)
const SIMILARITY_THRESHOLDS = {
  CORRECT: 0.80,      // >= 80% = réponse correcte (1 faute sur 5 chars)
  CLOSE: 0.60,        // 60-79% = très proche
  WRONG: 0            // < 60% = incorrect
};

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 * @param {string} str1 - Première chaîne
 * @param {string} str2 - Deuxième chaîne
 * @returns {number} - Distance (nombre d'opérations)
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  // Cas de base
  if (m === 0) return n;
  if (n === 0) return m;

  // Matrice de distances
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialisation
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Remplissage
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // Suppression
        dp[i][j - 1] + 1,      // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Calcule le ratio de similarité entre deux chaînes (0 à 1)
 * @param {string} str1 - Première chaîne
 * @param {string} str2 - Deuxième chaîne
 * @returns {number} - Ratio de similarité (1 = identique, 0 = totalement différent)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - (distance / maxLength);
}

/**
 * Supprime les accents d'une chaîne
 * @param {string} text - Texte avec accents
 * @returns {string} - Texte sans accents
 */
function removeAccents(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Supprime les articles français d'une chaîne
 * @param {string} text - Texte avec articles
 * @returns {string} - Texte sans articles
 */
function stripArticles(text) {
  let result = text;

  // Supprimer les articles avec apostrophe (l', d')
  result = result.replace(/\b[ld]['']\s*/gi, '');

  // Supprimer les articles standards en début de mot
  for (const article of ['le', 'la', 'les', 'un', 'une', 'des', 'du', 'au', 'aux']) {
    // Regex: article suivi d'un espace (début de chaîne ou après espace)
    const regex = new RegExp(`(^|\\s)${article}\\s+`, 'gi');
    result = result.replace(regex, '$1');
  }

  return result.trim();
}

/**
 * Normalise une réponse pour comparaison
 * - Minuscules
 * - Supprime les accents
 * - Supprime les articles français
 * - Supprime les espaces multiples
 * - Trim
 *
 * @param {string} text - Texte à normaliser
 * @returns {string} - Texte normalisé
 */
function normalizeAnswer(text) {
  if (!text || typeof text !== 'string') return '';

  let normalized = text.toLowerCase();
  normalized = removeAccents(normalized);
  normalized = stripArticles(normalized);
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Sépare une réponse contenant plusieurs parties
 * Séparateurs acceptés: virgule, "et", espace (si pas d'autres séparateurs)
 *
 * @param {string} text - Texte à séparer
 * @returns {string[]} - Tableau des parties
 */
function splitMultipleAnswers(text) {
  if (!text || typeof text !== 'string') return [];

  let parts = [];

  // Priorité 1: Virgule
  if (text.includes(',')) {
    parts = text.split(',').map(p => p.trim()).filter(p => p.length > 0);
  }
  // Priorité 2: "et" comme séparateur
  else if (text.toLowerCase().includes(' et ')) {
    parts = text.split(/\s+et\s+/i).map(p => p.trim()).filter(p => p.length > 0);
  }
  // Priorité 3: Espace (seulement pour des mots individuels)
  else if (text.includes(' ')) {
    // Vérifier si c'est une liste de mots courts (probablement des réponses séparées)
    const words = text.split(/\s+/).filter(w => w.length > 0);
    // Si tous les mots sont courts (<= 15 chars), considérer comme liste
    if (words.every(w => w.length <= 15) && words.length >= 2) {
      parts = words;
    } else {
      // Sinon, c'est une phrase complète = une seule réponse
      parts = [text.trim()];
    }
  }
  else {
    parts = [text.trim()];
  }

  return parts.filter(p => p.length > 0);
}

/**
 * Compare une réponse utilisateur avec la réponse correcte
 * Gère les réponses multiples (toutes doivent être présentes)
 *
 * @param {string} userAnswer - Réponse du joueur
 * @param {string} correctAnswer - Réponse correcte attendue
 * @param {string[]} [alternatives=[]] - Réponses alternatives acceptées
 * @returns {Object} - Résultat: { isCorrect, isClose, similarity, feedback, matchedParts }
 */
function matchAnswer(userAnswer, correctAnswer, alternatives = []) {
  // Normalisation
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = normalizeAnswer(correctAnswer);

  // Résultat par défaut
  const result = {
    isCorrect: false,
    isClose: false,
    similarity: 0,
    feedback: null,
    matchedParts: [],
    missingParts: []
  };

  // Vérifier si la réponse correcte contient plusieurs parties
  const correctParts = splitMultipleAnswers(normalizedCorrect);
  const userParts = splitMultipleAnswers(normalizedUser);

  // Normaliser les alternatives
  const normalizedAlternatives = (alternatives || [])
    .filter(a => a && typeof a === 'string')
    .map(a => normalizeAnswer(a));

  // CAS 1: Réponse simple (une seule partie attendue)
  if (correctParts.length <= 1) {
    // Vérifier correspondance exacte (après normalisation)
    if (normalizedUser === normalizedCorrect) {
      result.isCorrect = true;
      result.similarity = 1;
      return result;
    }

    // Vérifier les alternatives
    for (const alt of normalizedAlternatives) {
      if (normalizedUser === alt) {
        result.isCorrect = true;
        result.similarity = 1;
        return result;
      }
    }

    // Calculer la similarité
    let bestSimilarity = calculateSimilarity(normalizedUser, normalizedCorrect);

    // Vérifier aussi avec les alternatives
    for (const alt of normalizedAlternatives) {
      const altSimilarity = calculateSimilarity(normalizedUser, alt);
      if (altSimilarity > bestSimilarity) {
        bestSimilarity = altSimilarity;
      }
    }

    result.similarity = bestSimilarity;

    if (bestSimilarity >= SIMILARITY_THRESHOLDS.CORRECT) {
      result.isCorrect = true;
    } else if (bestSimilarity >= SIMILARITY_THRESHOLDS.CLOSE) {
      result.isClose = true;
      result.feedback = 'Tu es très proche !';
    }

    return result;
  }

  // CAS 2: Réponses multiples requises (toutes doivent être présentes)
  const matchedParts = [];
  const missingParts = [];
  let totalSimilarity = 0;

  for (const expectedPart of correctParts) {
    let bestMatch = { similarity: 0, userPart: null };

    // Chercher la meilleure correspondance parmi les réponses de l'utilisateur
    for (const userPart of userParts) {
      const similarity = calculateSimilarity(userPart, expectedPart);
      if (similarity > bestMatch.similarity) {
        bestMatch = { similarity, userPart };
      }
    }

    if (bestMatch.similarity >= SIMILARITY_THRESHOLDS.CORRECT) {
      matchedParts.push(expectedPart);
      totalSimilarity += bestMatch.similarity;
    } else if (bestMatch.similarity >= SIMILARITY_THRESHOLDS.CLOSE) {
      // Partie proche mais pas assez
      missingParts.push({ part: expectedPart, closestMatch: bestMatch.userPart });
      totalSimilarity += bestMatch.similarity;
    } else {
      missingParts.push({ part: expectedPart, closestMatch: null });
    }
  }

  result.matchedParts = matchedParts;
  result.missingParts = missingParts;
  result.similarity = correctParts.length > 0 ? totalSimilarity / correctParts.length : 0;

  // Toutes les parties doivent être trouvées
  if (matchedParts.length === correctParts.length) {
    result.isCorrect = true;
  } else if (matchedParts.length > 0 && matchedParts.length < correctParts.length) {
    // Quelques parties trouvées, mais pas toutes
    result.isClose = true;
    const remaining = correctParts.length - matchedParts.length;
    result.feedback = remaining === 1
      ? 'Il te manque 1 réponse !'
      : `Il te manque ${remaining} réponses !`;
  } else if (result.similarity >= SIMILARITY_THRESHOLDS.CLOSE) {
    result.isClose = true;
    result.feedback = 'Tu es très proche !';
  }

  return result;
}

/**
 * Détermine le type de feedback à afficher
 * @param {Object} matchResult - Résultat de matchAnswer()
 * @returns {string} - Type de feedback: 'correct', 'close', 'wrong'
 */
function getFeedbackType(matchResult) {
  if (matchResult.isCorrect) return 'correct';
  if (matchResult.isClose) return 'close';
  return 'wrong';
}

/**
 * Génère un message de feedback personnalisé
 * @param {Object} matchResult - Résultat de matchAnswer()
 * @param {string} correctAnswer - Réponse correcte (pour affichage)
 * @returns {string} - Message de feedback
 */
function generateFeedback(matchResult, correctAnswer) {
  if (matchResult.isCorrect) {
    return '✅ Bonne réponse !';
  }

  if (matchResult.isClose) {
    if (matchResult.feedback) {
      return `🔶 ${matchResult.feedback}`;
    }
    return '🔶 Tu es très proche !';
  }

  return `❌ Mauvaise réponse. La bonne réponse était : **${correctAnswer}**`;
}

module.exports = {
  // Fonctions principales
  matchAnswer,
  normalizeAnswer,
  calculateSimilarity,
  splitMultipleAnswers,

  // Utilitaires
  stripArticles,
  removeAccents,
  levenshteinDistance,

  // Feedback
  getFeedbackType,
  generateFeedback,

  // Constantes
  SIMILARITY_THRESHOLDS,
  FRENCH_ARTICLES
};
