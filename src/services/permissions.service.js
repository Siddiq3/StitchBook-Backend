const ROLE_PERMISSIONS = {
  owner: ['*'],
  manager: [
    'customers:read',
    'customers:write',
    'measurements:read',
    'measurements:write',
    'orders:read',
    'orders:write',
    'orders:update_status',
    'staff:read',
    'staff:write',
    'payroll:read',
    'payroll:write',
    'payments:read',
    'payments:write',
    'dashboard:read',
    'shop:read',
    'shop:write',
  ],
  cutter: [
    'customers:read',
    'measurements:read',
    'measurements:write',
    'orders:read',
    'orders:update_status',
    'work:read',
    'work:write',
    'dashboard:read',
  ],
  stitcher: [
    'orders:read',
    'work:read',
    'work:write',
  ],
  delivery: ['orders:read', 'orders:update_status'],
  helper: ['orders:read'],
};

const normalizeRole = (role) => {
  if (!role) return 'stitcher';
  const value = String(role).toLowerCase();
  if (value === 'tailor' || value === 'designer') return 'cutter';
  return ROLE_PERMISSIONS[value] ? value : 'stitcher';
};

const getRolePermissions = (role) => ROLE_PERMISSIONS[normalizeRole(role)] || [];

const mergePermissions = (role, customPermissions = {}) => {
  const permissions = new Set(getRolePermissions(role));

  if (Array.isArray(customPermissions)) {
    customPermissions.forEach((permission) => permissions.add(permission));
  } else if (customPermissions && typeof customPermissions === 'object') {
    Object.entries(customPermissions).forEach(([permission, allowed]) => {
      if (allowed) permissions.add(permission);
      if (allowed === false) permissions.delete(permission);
    });
  }

  return Array.from(permissions);
};

const hasPermission = (permissions = [], permission) => (
  permissions.includes('*') || permissions.includes(permission)
);

module.exports = {
  ROLE_PERMISSIONS,
  normalizeRole,
  getRolePermissions,
  mergePermissions,
  hasPermission,
};
