const Joi = require("joi");
const { EMAIL_EVENT_KEYS } = require("../../utilities/constants/email-events");

const objectId = Joi.string().hex().length(24);
const email = Joi.string().trim().email({ tlds: { allow: false } });

const fromEmail = email.allow(null, "").custom((value) => (value === "" ? null : value));

const createSchema = Joi.object({
  entity: objectId.required(),
  event: Joi.string().trim().uppercase().valid(...EMAIL_EVENT_KEYS).required(),
  template: objectId.required(),
  fromOverride: fromEmail.default(null),
  cc: Joi.array().items(email).default([]),
  bcc: Joi.array().items(email).default([]),
  subject: Joi.string().trim().min(1).required(),
  content: Joi.string().min(1).required(),
  status: Joi.number().valid(0, 1).default(1),
});

const updateSchema = Joi.object({
  event: Joi.string().trim().uppercase().valid(...EMAIL_EVENT_KEYS),
  template: objectId,
  fromOverride: fromEmail,
  cc: Joi.array().items(email),
  bcc: Joi.array().items(email),
  subject: Joi.string().trim().min(1),
  content: Joi.string().min(1),
  status: Joi.number().valid(0, 1),
});

module.exports = { createSchema, updateSchema };
