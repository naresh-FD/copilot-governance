const DEFAULT_THRESHOLDS = Object.freeze({
  minimumReviewedMatches: 210,
  minimumTruePositives: 206,
  maximumFalsePositives: 4,
  minimumPointPrecision: 0.98,
  minimumWilsonLowerBound: 0.95,
  minimumPilotRepositories: 3,
  minimumShadowDays: 28,
  maximumP95WarmLatencyMs: 250,
  maximumDegradedRate: 0.01,
  maximumDisagreementRate: 0.02,
  gameDayMaximumAgeDays: 30,
});

export function wilsonInterval(successes, total, z = 1.959963984540054) {
  if (!Number.isInteger(successes) || !Number.isInteger(total)) {
    throw new Error("successes and total must be integers");
  }
  if (total <= 0 || successes < 0 || successes > total) {
    return { lower: 0, upper: 1 };
  }
  const proportion = successes / total;
  const denominator = 1 + (z * z) / total;
  const centre = proportion + (z * z) / (2 * total);
  const margin =
    z *
    Math.sqrt(
      (proportion * (1 - proportion)) / total +
        (z * z) / (4 * total * total),
    );
  return {
    lower: (centre - margin) / denominator,
    upper: (centre + margin) / denominator,
  };
}

function qualifiedLabels(labels, ruleId) {
  const seen = new Set();
  return labels.filter((label) => {
    if (
      label.ruleId !== ruleId ||
      !label.evidenceId ||
      seen.has(label.evidenceId) ||
      !["true-positive", "false-positive"].includes(label.finalLabel) ||
      !Array.isArray(label.reviewerRefs) ||
      new Set(label.reviewerRefs).size < 2 ||
      !label.repositoryRef
    ) {
      return false;
    }
    seen.add(label.evidenceId);
    return true;
  });
}

export function evaluateCandidateEvidence({
  ruleId,
  labels = [],
  shadowStartedAt,
  fixtures = {},
  operations = {},
  thresholds = {},
  now = new Date(),
} = {}) {
  if (!ruleId) throw new Error("ruleId is required");
  const gate = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const reviewed = qualifiedLabels(labels, ruleId);
  const truePositives = reviewed.filter(
    (label) => label.finalLabel === "true-positive",
  ).length;
  const falsePositives = reviewed.length - truePositives;
  const precision = reviewed.length ? truePositives / reviewed.length : 0;
  const confidence = wilsonInterval(truePositives, reviewed.length);
  const repositories = new Set(reviewed.map((label) => label.repositoryRef)).size;
  const shadowDays = Number.isFinite(Date.parse(shadowStartedAt || ""))
    ? (now.getTime() - Date.parse(shadowStartedAt)) / 86_400_000
    : 0;
  const gameDayAge = Number.isFinite(Date.parse(operations.lastGameDayAt || ""))
    ? (now.getTime() - Date.parse(operations.lastGameDayAt)) / 86_400_000
    : Number.POSITIVE_INFINITY;
  const reasons = [];

  const requireGate = (condition, reason) => {
    if (!condition) reasons.push(reason);
  };
  requireGate(shadowDays >= gate.minimumShadowDays, "shadow-period-incomplete");
  requireGate(reviewed.length >= gate.minimumReviewedMatches, "insufficient-reviewed-matches");
  requireGate(truePositives >= gate.minimumTruePositives, "insufficient-true-positives");
  requireGate(falsePositives <= gate.maximumFalsePositives, "too-many-false-positives");
  requireGate(precision >= gate.minimumPointPrecision, "point-precision-below-gate");
  requireGate(confidence.lower >= gate.minimumWilsonLowerBound, "wilson-lower-bound-below-gate");
  requireGate(repositories >= gate.minimumPilotRepositories, "insufficient-pilot-repositories");
  requireGate(operations.unresolvedSeverity1FalsePositives === 0, "severity-1-false-positive");
  requireGate(fixtures.mandatoryPassed === true, "mandatory-fixtures-failed");
  requireGate(fixtures.adversarialPassed === true, "adversarial-fixtures-failed");
  requireGate(operations.materialPrecisionDifference === false, "material-segment-precision-difference");
  requireGate(Number(operations.p95WarmLatencyMs) <= gate.maximumP95WarmLatencyMs, "latency-gate-failed");
  requireGate(Number(operations.degradedRate) < gate.maximumDegradedRate, "degraded-rate-gate-failed");
  requireGate(operations.silentFailures === 0, "silent-failures-present");
  requireGate(operations.rollbackGameDayPassed === true, "rollback-game-day-not-passed");
  requireGate(gameDayAge <= gate.gameDayMaximumAgeDays, "rollback-game-day-stale");
  requireGate(Number(operations.disagreementRate) < gate.maximumDisagreementRate, "disagreement-rate-gate-failed");

  return {
    schemaVersion: 1,
    ruleId,
    evaluatedAt: now.toISOString(),
    eligible: reasons.length === 0,
    reasons,
    metrics: {
      reviewedMatches: reviewed.length,
      truePositives,
      falsePositives,
      pointPrecision: precision,
      wilson95Lower: confidence.lower,
      wilson95Upper: confidence.upper,
      pilotRepositories: repositories,
      shadowDays,
      optionalHighAssurance300of300:
        reviewed.length >= 300 && falsePositives === 0,
    },
    thresholds: gate,
  };
}

export { DEFAULT_THRESHOLDS };
