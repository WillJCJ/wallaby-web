INSERT INTO guests (name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, updated_by)
VALUES (
  'Local Admin',
  'admin@example.com',
  'pending',
  0,
  '',
  'Local admin test account',
  'local-seed'
)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  rsvp = excluded.rsvp,
  additional_guests = excluded.additional_guests,
  dietary_requirements = excluded.dietary_requirements,
  rsvp_message = excluded.rsvp_message,
  updated_by = excluded.updated_by,
  updated_at = datetime('now');

INSERT INTO guests (name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, updated_by)
VALUES (
  'Alex Roo',
  'alex@example.com',
  'yes',
  1,
  'Gluten-free',
  'Bringing a plus one.',
  'local-seed'
)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  rsvp = excluded.rsvp,
  additional_guests = excluded.additional_guests,
  dietary_requirements = excluded.dietary_requirements,
  rsvp_message = excluded.rsvp_message,
  updated_by = excluded.updated_by,
  updated_at = datetime('now');

INSERT INTO guests (name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, updated_by)
VALUES (
  'Mia Wallaby',
  'mia@example.com',
  'pending',
  0,
  'Vegetarian',
  'Will confirm travel next week.',
  'local-seed'
)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  rsvp = excluded.rsvp,
  additional_guests = excluded.additional_guests,
  dietary_requirements = excluded.dietary_requirements,
  rsvp_message = excluded.rsvp_message,
  updated_by = excluded.updated_by,
  updated_at = datetime('now');

INSERT INTO guests (name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, updated_by)
VALUES (
  'Sam Quokka',
  'sam@example.com',
  'no',
  0,
  '',
  'Cannot make this one sadly.',
  'local-seed'
)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  rsvp = excluded.rsvp,
  additional_guests = excluded.additional_guests,
  dietary_requirements = excluded.dietary_requirements,
  rsvp_message = excluded.rsvp_message,
  updated_by = excluded.updated_by,
  updated_at = datetime('now');

INSERT INTO guests (name, email, rsvp, additional_guests, dietary_requirements, rsvp_message, updated_by)
VALUES (
  'Priya Koala',
  'priya@example.com',
  'yes',
  2,
  'Nut allergy',
  'Kids are excited for wallaby bingo.',
  'local-seed'
)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  rsvp = excluded.rsvp,
  additional_guests = excluded.additional_guests,
  dietary_requirements = excluded.dietary_requirements,
  rsvp_message = excluded.rsvp_message,
  updated_by = excluded.updated_by,
  updated_at = datetime('now');
