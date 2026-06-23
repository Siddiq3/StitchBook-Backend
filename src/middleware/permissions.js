const responder = require('../utils/responder');
const { hasPermission } = require('../services/permissions.service');

const requirePermission = (permission) => (req, res, next) => {
  if (hasPermission(req.user?.permissions || [], permission)) {
    return next();
  }

  return responder.error(res, 403, 'You do not have permission to perform this action', {
    code: 'FORBIDDEN',
    requiredPermission: permission,
  });
};

module.exports = {
  requirePermission,
};
