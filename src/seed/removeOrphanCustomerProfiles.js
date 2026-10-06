/**
 * Removes customer profiles whose login (User) no longer exists. They are left behind when an account
 * creation failed halfway (for example the activation email was refused) in versions before the rollback
 * also removed the profile, and they block retrying the same email or mobile number ("already exists").
 *
 * Dry run by default — it only lists what it would delete:
 *   node src/seed/removeOrphanCustomerProfiles.js
 *   node src/seed/removeOrphanCustomerProfiles.js --email=someone@example.com
 * Delete for real:
 *   node src/seed/removeOrphanCustomerProfiles.js --apply
 *
 * On the server:  sudo docker compose exec backend node src/seed/removeOrphanCustomerProfiles.js
 */
require("dotenv").config();
const connectDatabase = require("../config/database");
const { User } = require("../models/users");
const { Customer } = require("../models/customers");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const emailArg = (args.find((a) => a.startsWith("--email=")) || "").slice("--email=".length).trim().toLowerCase();

async function run() {
  await connectDatabase();

  const filter = { linkedUserId: { $ne: null } };
  if (emailArg) filter.email = emailArg;
  const profiles = await Customer.find(filter).select("_id name email mobileNumber linkedUserId isDeleted");

  const userIds = profiles.map((p) => p.linkedUserId);
  const existing = new Set((await User.find({ _id: { $in: userIds } }).select("_id")).map((u) => String(u._id)));
  const orphans = profiles.filter((p) => !existing.has(String(p.linkedUserId)));

  console.log(`>>> Profiles checked: ${profiles.length}. Orphans (no login behind them): ${orphans.length}.`);
  for (const o of orphans) console.log(`  ${o.name} | ${o.email} | ${o.mobileNumber || "-"}${o.isDeleted ? " (soft-deleted)" : ""}`);

  if (!orphans.length) return process.exit(0);
  if (!apply) {
    console.log(">>> Dry run only. Add --apply to delete the profiles listed above.");
    return process.exit(0);
  }

  const result = await Customer.deleteMany({ _id: { $in: orphans.map((o) => o._id) } });
  console.log(`>>> Deleted ${result.deletedCount} orphan profile(s).`);
  return process.exit(0);
}

run().catch((err) => {
  console.error(">>> removeOrphanCustomerProfiles failed:", err);
  process.exit(1);
});
