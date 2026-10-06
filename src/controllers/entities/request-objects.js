const Joi = require("joi");

const addressSchema = Joi.object({
  block: Joi.string().trim().allow("").default(""),
  unit: Joi.string().trim().allow("").default(""),
  street: Joi.string().trim().allow("").default(""),
  country: Joi.string().trim().allow("").default(""),
  pincode: Joi.string().trim().allow("").default(""),
});

const createSchema = Joi.object({
  code: Joi.string().trim().uppercase().min(2).max(20).required(),
  name: Joi.string().trim().min(2).max(150).required(),
  templeName: Joi.string().trim().min(2).max(200).required(),
  templeTamilName: Joi.string().trim().allow("").default(""),
  address: addressSchema.default({}),
  email: Joi.string().trim().email({ tlds: { allow: false } }).allow("").default(""),
  mobileNumber: Joi.string().trim().allow("").pattern(/^[89]\d{7}$/).default(""),
  gstNumber: Joi.string().trim().allow("").max(30).default(""),
  description: Joi.string().trim().allow("").max(500).default(""),
  logoUrl: Joi.string().trim().allow("", null).default(""),
  status: Joi.number().valid(0, 1).default(1),
});

const updateSchema = Joi.object({
  code: Joi.string().trim().uppercase().min(2).max(20),
  name: Joi.string().trim().min(2).max(150),
  templeName: Joi.string().trim().min(2).max(200),
  templeTamilName: Joi.string().trim().allow(""),
  address: addressSchema,
  email: Joi.string().trim().email({ tlds: { allow: false } }).allow(""),
  mobileNumber: Joi.string().trim().allow("").pattern(/^[89]\d{7}$/),
  gstNumber: Joi.string().trim().allow("").max(30),
  description: Joi.string().trim().allow("").max(500),
  logoUrl: Joi.string().trim().allow("", null),
  status: Joi.number().valid(0, 1),
});

module.exports = { createSchema, updateSchema };
