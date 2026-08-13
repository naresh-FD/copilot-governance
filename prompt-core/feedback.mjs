const OUTCOMES = new Set(["agree", "disagree", "uncertain"]);
const JUSTIFICATION_CODES = new Set([
  "approved-migration",
  "business-continuity",
  "false-positive-suspected",
  "incident-response",
]);

function safeId(value, label) {
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    throw new Error(`${label} is missing or invalid`);
  }
  return value;
}

export function createFeedbackEvent({
  eventId,
  ruleId,
  ruleVersion,
  outcome,
  reasonCode,
  justificationCode = null,
  exceptionId = null,
  client = "unknown",
  now = new Date(),
} = {}) {
  safeId(eventId, "eventId");
  safeId(ruleId, "ruleId");
  safeId(ruleVersion, "ruleVersion");
  safeId(reasonCode, "reasonCode");
  if (!OUTCOMES.has(outcome)) throw new Error("outcome must be agree, disagree, or uncertain");
  if (justificationCode && !JUSTIFICATION_CODES.has(justificationCode)) {
    throw new Error("justificationCode is not approved");
  }
  if (exceptionId) safeId(exceptionId, "exceptionId");
  return {
    schemaVersion: 1,
    recordType: "feedback",
    feedbackId: randomUUID(),
    recordedAt: now.toISOString(),
    eventId,
    ruleId,
    ruleVersion,
    outcome,
    reasonCode,
    justificationCode,
    exceptionId,
    client,
  };
}

export { JUSTIFICATION_CODES, OUTCOMES };
import { randomUUID } from "node:crypto";
