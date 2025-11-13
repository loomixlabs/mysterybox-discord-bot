-- Mise à jour des missions avec les bonnes descriptions et timeouts

-- Mission #1: Mot Deviné (keyword-message)
UPDATE missions
SET name = 'Mot Deviné',
    description = 'Fais dire le mot secret à un autre joueur dans le salon indiqué ! ⚠️ Si TU le dis, tu échoues la mission !',
    timeout = 300
WHERE id = 1;

-- Mission #2: Quiz (quiz)
UPDATE missions
SET name = 'Quiz',
    description = 'Réponds correctement à une question de culture générale sur le thème !',
    timeout = 60
WHERE id = 2;

-- Afficher les résultats
SELECT id, name, description, timeout FROM missions ORDER BY id;
