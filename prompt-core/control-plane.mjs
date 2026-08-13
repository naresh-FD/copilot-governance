import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const RULE_MODES = Object.freeze([
  "off",
  "shadow",
  "candidate",
  "soft-block",
  "enforce",
]);

function modeOrShadow(value, warnings, label) {
  if (RULE_MODES.includes(value)) return value;
  warnings.push(`${label}: invalid mode ${JSON.stringify(value)}; using shadow`);
  return "shadow";
}

function parseTestModes(env, warnings) {
  if (env.GOV_ALLOW_TEST_OVERRIDES !== "1" || !env.GOV_TEST_RULE_MODES) {
    return {};
  }
  try {
    const value = JSON.parse(env.GOV_TEST_RULE_MODES);
    return value && typeof value === "object" ? value : {};
  } catch (error) {
    warnings.push(`GOV_TEST_RULE_MODES is invalid JSON: ${error.message}`);
    return {};
  }
}

function readRollbackState(env, warnings, now = Date.now()) {
  if (env.GOV_ROLLBACK_STATE === "0") return { ruleIds: [], version: null };
  const path =
    env.GOV_ROLLBACK_STATE_FILE ||
    join(homedir(), ".copilot-gov", "rollback-state.json");
  if (!existsSync(path)) return { ruleIds: [], version: null };
  try {
    const state = JSON.parse(readFileSync(path, "utf8"));
    if (state.schemaVersion !== 1) throw new Error("unsupported schemaVersion");
    const expires = Date.parse(state.expiresAt || "");
    if (!Number.isFinite(expires) || now >= expires) {
      throw new Error("rollback state is expired");
    }
    const ruleIds = Object.entries(state.rules || {})
      .filter(([, value]) => value?.rollbackTo === "shadow")
      .map(([id]) => id);
    return { ruleIds, version: state.generatedAt || null };
  } catch (error) {
    warnings.push(`rollback state is invalid: ${error.message}`);
    return { ruleIds: [], version: null };
  }
}

function inRollout(ruleId, percentage, rolloutKey) {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;
  const digest = createHash("sha256")
    .update(`${ruleId}|${rolloutKey}`)
    .digest();
  return digest.readUInt32BE(0) % 100 < percentage;
}

function scopeMatches(list, value) {
  return !Array.isArray(list) || list.length === 0 || list.includes(value);
}

function activeException(control, ruleId, repository, cohort, now) {
  return (control.exceptions || []).find((entry) => {
    if (entry.ruleId !== ruleId || !entry.id || !entry.expiresAt) return false;
    const starts = entry.startsAt ? Date.parse(entry.startsAt) : null;
    const expires = Date.parse(entry.expiresAt);
    if (
      (entry.startsAt && !Number.isFinite(starts)) ||
      !Number.isFinite(expires) ||
      (starts && now < starts) ||
      now >= expires
    ) {
      return false;
    }
    return (
      scopeMatches(entry.repositories, repository) &&
      scopeMatches(entry.cohorts, cohort)
    );
  });
}

function hasMandatoryBlockApproval(rule, configured, now) {
  const approval = configured.mandatoryBlock;
  const approvedAt = Date.parse(approval?.approvedAt || "");
  return (
    rule.priority === "mandatory" &&
    configured.mode === "enforce" &&
    approval?.approved === true &&
    typeof approval.approvalRef === "string" &&
    approval.approvalRef.trim().length > 0 &&
    typeof approval.rationale === "string" &&
    approval.rationale.trim().length > 0 &&
    Number.isFinite(approvedAt) &&
    approvedAt <= now
  );
}

export function prepareControlPlane(control, env = process.env, evidenceGates = null) {
  const warnings = [];
  const testModes = parseTestModes(env, warnings);
  const rollbackState = readRollbackState(env, warnings);
  if (env.GOV_ENFORCE_ALL) {
    warnings.push("GOV_ENFORCE_ALL is unsupported and was ignored; rules are controlled independently");
  }
  return {
    ...control,
    emergencyRollbackToShadow:
      control.emergencyRollbackToShadow === true ||
      env.GOV_EMERGENCY_SHADOW === "1",
    runtimeRollbacks: new Set([
      ...rollbackState.ruleIds,
      ...String(env.GOV_RULE_ROLLBACK || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ]),
    rollbackStateVersion: rollbackState.version,
    evidenceGates,
    testOverrideActive:
      env.GOV_ALLOW_TEST_OVERRIDES === "1" &&
      Boolean(env.GOV_TEST_RULE_MODES),
    testModes,
    warnings,
  };
}

export function resolveRuleControl(
  rule,
  control,
  {
    cohort = control.defaultCohort || "unassigned",
    repository = "unknown",
    rolloutKey = `${cohort}|${repository}`,
    now = Date.now(),
  } = {},
) {
  const configured = control.rules?.[rule.id] || {};
  const requestedMode = control.testModes?.[rule.id] ?? configured.mode ?? "shadow";
  let mode = modeOrShadow(requestedMode, control.warnings, `rule ${rule.id}`);
  let reason = "configured";
  const mandatoryBlockApproved =
    !control.testOverrideActive &&
    hasMandatoryBlockApproval(rule, configured, now);

  if (mandatoryBlockApproved) reason = "mandatory-baseline";

  if (
    !control.testOverrideActive &&
    !mandatoryBlockApproved &&
    ["candidate", "soft-block", "enforce"].includes(mode)
  ) {
    const evidence = control.evidenceGates?.rules?.[rule.id] || {};
    const approvalField = {
      candidate: "candidateApproved",
      "soft-block": "softBlockApproved",
      enforce: "enforceApproved",
    }[mode];
    if (rule.owner === "unassigned" || configured.owner === "unassigned") {
      mode = "shadow";
      reason = "named-owner-required";
    } else if (control.evidenceGates?.status !== "ratified") {
      mode = "shadow";
      reason = "threshold-ledger-unratified";
    } else if (evidence[approvalField] !== true) {
      mode = "shadow";
      reason = "evidence-gate-not-approved";
    } else if (!evidence.approvalRef || !evidence.approvedAt) {
      mode = "shadow";
      reason = "evidence-approval-incomplete";
    } else if (
      evidence.expiresAt &&
      (!Number.isFinite(Date.parse(evidence.expiresAt)) ||
        now >= Date.parse(evidence.expiresAt))
    ) {
      mode = "shadow";
      reason = "evidence-approval-expired";
    }
  }

  if (control.emergencyRollbackToShadow && ["soft-block", "enforce"].includes(mode)) {
    mode = "shadow";
    reason = "emergency-rollback";
  } else if (control.runtimeRollbacks?.has(rule.id) && mode !== "off") {
    mode = "shadow";
    reason = "per-rule-rollback";
  }

  const starts = configured.startsAt ? Date.parse(configured.startsAt) : null;
  const expires = configured.expiresAt ? Date.parse(configured.expiresAt) : null;
  if (
    (configured.startsAt && !Number.isFinite(starts)) ||
    (configured.expiresAt && !Number.isFinite(expires))
  ) {
    mode = "shadow";
    reason = "invalid-schedule";
  } else if ((starts && now < starts) || (expires && now >= expires)) {
    mode = "shadow";
    reason = starts && now < starts ? "not-started" : "configuration-expired";
  }

  if (
    !scopeMatches(configured.cohorts, cohort) ||
    !scopeMatches(configured.repositories, repository)
  ) {
    mode = "shadow";
    reason = "outside-target";
  }

  const percentage = Number(configured.rolloutPercentage ?? 100);
  if (!inRollout(rule.id, Number.isFinite(percentage) ? percentage : 0, rolloutKey)) {
    mode = "shadow";
    reason = "outside-rollout";
  }

  const exception = activeException(control, rule.id, repository, cohort, now);
  if (exception && mode !== "off") {
    mode = "shadow";
    reason = "active-exception";
  }

  return {
    configuredMode: requestedMode,
    effectiveMode: mode,
    reason,
    exceptionId: exception?.id || null,
    cohort,
    rolloutPercentage: Number.isFinite(percentage) ? percentage : 0,
    candidateBlockDate: configured.candidateBlockDate || null,
  };
}
