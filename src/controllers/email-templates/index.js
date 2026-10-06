const express = require("express");
const requirePermission = require("../../common/middleware/require-permission");
const validateBody = require("../../common/middleware/validate");
const makeCrudController = require("../../common/factories/crud-controller");
const { exceptionHandler } = require("../../utilities/handlers");
const { USER_TYPES } = require("../../utilities/constants/user-types");

const EmailTemplate = require("../../models/email-templates");
const EmailTemplateMapping = require("../../models/email-template-mappings");
const { createSchema, updateSchema } = require("./request-objects");

// These routes decide what the platform emails people, so they need both
// userType *and* module gating — applied once for the whole /notifications
// group in routes/index.js now, not here (see that file's comment for why
// each router used to apply its own copy).
const router = express.Router();

const MAPPED_MESSAGE =
  "This email template is already used by an Email Template Mapping, so it cannot be deactivated or deleted. Update or remove that mapping first.";

async function mappedTemplateMessage(id) {
  const found = await EmailTemplateMapping.findOne(
    EmailTemplateMapping.notDeletedFilter({ template: id })
  ).select("_id");
  return found ? MAPPED_MESSAGE : null;
}

const controller = makeCrudController(EmailTemplate, {
  searchFields: ["name", "subject", "description"],
  referencedBy: [{ model: EmailTemplateMapping, field: "template", label: "Email Template Mapping" }],
  decorateItems: async (docs) => {
    const ids = docs.map((doc) => doc._id);
    const mapped = await EmailTemplateMapping.distinct(
      "template",
      EmailTemplateMapping.notDeletedFilter({ template: { $in: ids } })
    );
    const mappedIds = new Set(mapped.map(String));
    return docs.map((doc) => ({
      ...doc.toObject(),
      isMapped: mappedIds.has(String(doc._id)),
    }));
  },
});

async function update(req, res) {
  // The template is only a starting copy. Editing the message stays allowed
  // and does not write back to mappings that already copied it. Turning an
  // active template inactive is the one update a mapping still blocks.
  if (Number(req.body?.status) === 0) {
    const current = await EmailTemplate.findOne(
      EmailTemplate.notDeletedFilter({ _id: req.params.id })
    ).select("status");
    if (current && current.status !== 0) {
      const message = await mappedTemplateMessage(req.params.id);
      if (message) return exceptionHandler({ res, error: message, statusCode: 409 });
    }
  }
  return controller.update(req, res);
}

async function remove(req, res) {
  const message = await mappedTemplateMessage(req.params.id);
  if (message) return exceptionHandler({ res, error: message, statusCode: 409 });
  return controller.remove(req, res);
}

function canViewTemplates(req, res, next) {
  if (req.auth?.userType === USER_TYPES.SUPER_ADMIN) return next();
  const permissions = req.auth?.permissions || {};
  if (permissions["email-templates"]?.view || permissions["email-template-mappings"]?.view) return next();
  return exceptionHandler({
    res,
    error: "You don't have view access to email templates.",
    statusCode: 403,
  });
}

router.get("/email-templates", canViewTemplates, controller.list);
router.post(
  "/email-templates",
  requirePermission("email-templates", "fullAccess"),
  validateBody(createSchema),
  controller.create
);
router.put(
  "/email-templates/:id",
  requirePermission("email-templates", "edit"),
  validateBody(updateSchema),
  update
);
router.delete(
  "/email-templates/:id",
  requirePermission("email-templates", "fullAccess"),
  remove
);

module.exports = router;
