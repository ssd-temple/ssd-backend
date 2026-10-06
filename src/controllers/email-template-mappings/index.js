const express = require("express");
const requirePermission = require("../../common/middleware/require-permission");
const validateBody = require("../../common/middleware/validate");
const makeCrudController = require("../../common/factories/crud-controller");
const { exceptionHandler, responseHandler } = require("../../utilities/handlers");
const { USER_TYPES } = require("../../utilities/constants/user-types");
const { EMAIL_EVENTS } = require("../../utilities/constants/email-events");

const EmailTemplateMapping = require("../../models/email-template-mappings");
const Entity = require("../../models/entities");
const { User } = require("../../models/users");
const { createSchema, updateSchema } = require("./request-objects");

// Same gate as email-templates — see routes/index.js, applied once for the
// whole /notifications group.
const router = express.Router();

const controller = makeCrudController(EmailTemplateMapping, {
  searchFields: ["event", "subject"],
  populate: [
    { path: "template", select: "name subject htmlContent description status" },
    { path: "entity", select: "name code templeName" },
  ],
});

const EVENT_TAKEN = "This event is already mapped for this entity.";

async function options(req, res) {
  try {
    const entities = await Entity.find(Entity.notDeletedFilter({ status: 1 }))
      .select("name code templeName logoUrl")
      .sort({ name: 1 });

    let visible = entities;
    if (req.auth?.userType !== USER_TYPES.SUPER_ADMIN) {
      const user = await User.findById(req.auth?.userId).select("entities");
      const allowed = new Set((user?.entities || []).map((row) => String(row.entity)));
      visible = entities.filter((entity) => allowed.has(String(entity._id)));
    }

    return responseHandler({
      res,
      response: { entities: visible, events: EMAIL_EVENTS },
    });
  } catch (error) {
    return exceptionHandler({ res, error });
  }
}

async function create(req, res) {
  const clash = await EmailTemplateMapping.findOne(
    EmailTemplateMapping.notDeletedFilter({ entity: req.body.entity, event: req.body.event })
  ).select("_id");
  if (clash) return exceptionHandler({ res, error: EVENT_TAKEN, statusCode: 409 });
  return controller.create(req, res);
}

async function update(req, res) {
  if (req.body.event) {
    const current = await EmailTemplateMapping.findOne(
      EmailTemplateMapping.notDeletedFilter({ _id: req.params.id })
    ).select("entity");
    if (!current) return exceptionHandler({ res, error: "Record not found.", statusCode: 404 });

    const clash = await EmailTemplateMapping.findOne(
      EmailTemplateMapping.notDeletedFilter({
        entity: current.entity,
        event: req.body.event,
        _id: { $ne: current._id },
      })
    ).select("_id");
    if (clash) return exceptionHandler({ res, error: EVENT_TAKEN, statusCode: 409 });
  }
  return controller.update(req, res);
}

function canViewOptions(req, res, next) {
  if (req.auth?.userType === USER_TYPES.SUPER_ADMIN) return next();
  const permissions = req.auth?.permissions || {};
  if (permissions["email-templates"]?.view || permissions["email-template-mappings"]?.view) return next();
  return exceptionHandler({
    res,
    error: "You don't have view access to email template mappings.",
    statusCode: 403,
  });
}

router.get("/email-template-mappings/options", canViewOptions, options);
router.get("/email-template-mappings", requirePermission("email-template-mappings", "view"), controller.list);
router.post(
  "/email-template-mappings",
  requirePermission("email-template-mappings", "fullAccess"),
  validateBody(createSchema),
  create
);
router.put(
  "/email-template-mappings/:id",
  requirePermission("email-template-mappings", "edit"),
  validateBody(updateSchema),
  update
);
router.delete(
  "/email-template-mappings/:id",
  requirePermission("email-template-mappings", "fullAccess"),
  controller.remove
);

module.exports = router;
