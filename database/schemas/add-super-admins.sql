-- Ajouter les super-admins
INSERT INTO super_admins (discord_id, username, role, added_at)
VALUES
  ('297307186307006464', 'Propriétaire Principal', 'owner', NOW()),
  ('340981911281205248', 'Associé', 'admin', NOW())
ON CONFLICT (discord_id) DO NOTHING;

-- Vérifier les super-admins
SELECT discord_id, username, role, added_at FROM super_admins;
