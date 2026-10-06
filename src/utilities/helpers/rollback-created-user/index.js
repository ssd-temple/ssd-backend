const { User } = require("../../../models/users");
const { Customer } = require("../../../models/customers");

/**
 * Undoes a half-finished "create account" request. Creating an account makes a User login AND a customer
 * profile (same mobile number and email). Deleting only the User — as the create flows used to — left the
 * profile behind, so retrying the same email or mobile number failed with "already exists". This removes
 * the profile first (it is looked up by the login that owns it), then the login. Never throws: it runs
 * inside a catch block, where the original error is the one that matters.
 */
async function rollbackCreatedUser(userId) {
  if (!userId) return;
  await Customer.deleteMany({ linkedUserId: userId }).catch(() => {});
  await User.deleteOne({ _id: userId }).catch(() => {});
}

module.exports = rollbackCreatedUser;
