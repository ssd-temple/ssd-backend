const express = require("express");
const superAdminOnly = require("../../common/middleware/super-admin-only");
const validateBody = require("../../common/middleware/validate");
const makeCrudController = require("../../common/factories/crud-controller");
const { uploadEntityLogo, hydrateMultipartBody } = require("../../common/middleware/upload");

const Entity = require("../../models/entities");
const EmailTemplateMapping = require("../../models/email-template-mappings");
const { User } = require("../../models/users");
const { Customer } = require("../../models/customers");
const { createSchema, updateSchema } = require("./request-objects");

// Mounted on the shared /masters router. superAdminOnly is on each route,
// not router.use(), because a path-less use() on a router that shares the
// /masters prefix would run for every other master too.
const router = express.Router();

const crud = makeCrudController(Entity, {
  searchFields: ["code", "name", "templeName", "email"],
  referencedBy: [
    { model: User, field: "entities.entity", label: "User" },
    { model: Customer, field: "entity", label: "Customer" },
    { model: EmailTemplateMapping, field: "entity", label: "Email Template Mapping" },
  ],
  sort: { name: 1 },
});

router.get("/entities", superAdminOnly, crud.list);
router.post(
  "/entities",
  superAdminOnly,
  uploadEntityLogo,
  hydrateMultipartBody,
  validateBody(createSchema),
  crud.create
);
router.put(
  "/entities/:id",
  superAdminOnly,
  uploadEntityLogo,
  hydrateMultipartBody,
  validateBody(updateSchema),
  crud.update
);
router.delete("/entities/:id", superAdminOnly, crud.remove);

module.exports = router;
