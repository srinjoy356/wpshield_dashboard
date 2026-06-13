INSERT INTO user_profiles (id, company_id, role, display_name)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'Sourjya@cybernara.com'),
  null,
  'admin',
  'Sourjya'
);