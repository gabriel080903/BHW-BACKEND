const ROLE_ADMIN = 'Admin';
const ROLE_BHW = 'BHW';
const ROLE_PARENT_GUARDIAN = 'Parent/Guardian';

const ROLE_VALUES = [ROLE_ADMIN, ROLE_BHW, ROLE_PARENT_GUARDIAN];
const ROLE_DEFAULT = ROLE_BHW;

const ROLE_MAP = {
  admin: ROLE_ADMIN,
  bhw: ROLE_BHW,
  parent: ROLE_PARENT_GUARDIAN,
  'parent/guardian': ROLE_PARENT_GUARDIAN
};

const normalizeRole = (value) => {
  if (!value) return '';

  const trimmed = String(value).trim();
  const mapped = ROLE_MAP[trimmed.toLowerCase()];
  return mapped || trimmed;
};

module.exports = {
  ROLE_ADMIN,
  ROLE_BHW,
  ROLE_PARENT_GUARDIAN,
  ROLE_VALUES,
  ROLE_DEFAULT,
  normalizeRole
};
