const mongoose = require("mongoose");
const { auditablePlugin, activeUniqueIndexOptions } = require("../../common/plugins/auditable");

/**
 * Which template fires for a given event, per entity — mirrors HEB's
 * `email-template-mapping` model. This is the entity-wise part: two
 * entities can point the same event ("ACCOUNT_ACTIVATION") at two
 * different templates (different branding, different signature), without
 * either template needing to know about the other.
 *
 * `subject` and `content` are a copy taken from the chosen Email Template
 * when the mapping is saved. Editing them here does not write back to that
 * template. Sending uses these fields (the shell around `content` — logo,
 * card — comes from the entity, not from the template).
 */
const emailTemplateMappingSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: "Entity", required: true },
  event: { type: String, required: true, trim: true, uppercase: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: "EmailTemplate", required: true },

  fromOverride: { type: String, default: null },
  cc: { type: [String], default: [] },
  bcc: { type: [String], default: [] },
  subject: { type: String, default: "" },
  content: { type: String, default: "" },
});

emailTemplateMappingSchema.plugin(auditablePlugin);

// One active mapping per entity+event — exactly what send-templated-email looks up.
emailTemplateMappingSchema.index(
  { entity: 1, event: 1 },
  activeUniqueIndexOptions()
);

module.exports = mongoose.model("EmailTemplateMapping", emailTemplateMappingSchema);
