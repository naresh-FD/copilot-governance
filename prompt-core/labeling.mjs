const LABELS = new Set(["true-positive", "false-positive", "uncertain"]);

function validateReview(review) {
  if (
    !review?.evidenceId ||
    !review.repositoryRef ||
    !review.ruleId ||
    !review.ruleVersion ||
    !review.reasonCode
  ) {
    throw new Error("review is missing required evidence metadata");
  }
  if (!review.reviewerRef) throw new Error("reviewerRef is required");
  if (!LABELS.has(review.label)) throw new Error("review label is invalid");
}

export function finalizeReview({ reviews, adjudication = null, finalizedAt = new Date() } = {}) {
  if (!Array.isArray(reviews) || reviews.length !== 2) {
    throw new Error("exactly two independent reviews are required");
  }
  for (const review of reviews) validateReview(review);
  const [first, second] = reviews;
  if (first.evidenceId !== second.evidenceId || first.ruleId !== second.ruleId) {
    throw new Error("reviews must refer to the same evidence and rule");
  }
  if (first.reviewerRef === second.reviewerRef) {
    throw new Error("reviewers must be independent");
  }
  let finalLabel = first.label === second.label ? first.label : null;
  let adjudicatorRef = null;
  if (!finalLabel) {
    if (!adjudication?.adjudicatorRef || !LABELS.has(adjudication.label)) {
      throw new Error("disagreeing reviews require an adjudicator and valid label");
    }
    if ([first.reviewerRef, second.reviewerRef].includes(adjudication.adjudicatorRef)) {
      throw new Error("adjudicator must be independent of both reviewers");
    }
    finalLabel = adjudication.label;
    adjudicatorRef = adjudication.adjudicatorRef;
  }
  if (finalLabel === "uncertain") {
    throw new Error("uncertain evidence cannot enter the precision denominator");
  }
  return {
    schemaVersion: 1,
    evidenceId: first.evidenceId,
    repositoryRef: first.repositoryRef,
    ruleId: first.ruleId,
    ruleVersion: first.ruleVersion,
    reasonCode: first.reasonCode,
    finalLabel,
    reviewerRefs: [first.reviewerRef, second.reviewerRef],
    adjudicatorRef,
    finalizedAt: finalizedAt.toISOString(),
  };
}

export { LABELS };
