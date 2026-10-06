const { exceptionHandler } = require("../../utilities/handlers");
const { USER_TYPES } = require("../../utilities/constants/user-types");

/**
 * Entity Master is not a Role permission. Several accounts can be granted
 * every module, and the logo on outgoing mail is still a platform setting,
 * so only the bootstrap SUPER_ADMIN user type may read or change it.
 */
function superAdminOnly(req, res, next) {
  if (req.auth?.userType === USER_TYPES.SUPER_ADMIN) return next();

  return exceptionHandler({
    res,
    error: "Entity Master is restricted to the system administrator.",
    statusCode: 403,
  });
}

module.exports = superAdminOnly;
