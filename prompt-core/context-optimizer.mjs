// Context budget optimizer for the prompt interception kernel.
//
// The "budget" is the maximum character count of the COMPLETE rendered prompt
// that the engine delivers to the model — not just the sum of the section
// bodies. Every heading, separator, and structural overhead counts.
//
// The optimizer accepts an optional `renderer` callback. When provided, the
// optimizer calls renderer(sectionList) to obtain the actual serialized output
// for a candidate section set and measures that string. When omitted (e.g. in
// direct unit tests), it falls back to summing section content lengths, which
// under-counts by the structural overhead but is useful for isolated testing.
//
// Return shape:
//   sections          — ordered list of included section objects
//   configuredLimit   — the maximumChars value in effect
//   finalCharCount    — actual character count of the rendered output
//   includedSections  — ids of sections in the output
//   omittedSections   — ids of sections dropped to fit the budget
//   overBudget        — true when mandatory content alone exceeds the limit
//   overBudgetReason  — human-readable explanation when overBudget is true
//   usedChars         — alias for finalCharCount (backward compat)
//   droppedSections   — alias for omittedSections (backward compat)

export function optimizeContext({
  core,
  originalPrompt,
  skills = [],
  anchors = [],
  template,
  maximumChars = 18000,
  renderer,
}) {
  const sections = [
    { id: 'core', priority: 100, mandatory: true, content: core ?? '' },
    { id: 'original-prompt', priority: 100, mandatory: true, content: originalPrompt ?? '' },
    ...skills.map((skill, i) => ({
      id: `skill:${skill.name}`,
      priority: 90 - i * 10,
      mandatory: i === 0,
      content: skill.content ?? '',
    })),
    ...anchors.map((anchor, i) => ({
      id: `anchor:${anchor.path ?? i}`,
      priority: 70 - i,
      mandatory: false,
      content: anchor.content ?? '',
    })),
    { id: 'template', priority: 50, mandatory: false, content: template?.body ?? '' },
  ].filter((s) => s.content.trim());

  const mandatory = sections.filter((s) => s.mandatory);
  const optional = sections.filter((s) => !s.mandatory).sort((a, b) => b.priority - a.priority);

  // Measure actual rendered size when a renderer is available; fall back to
  // summing raw content lengths when one is not (e.g. in isolated tests).
  const measure = renderer
    ? (secs) => renderer(secs).length
    : (secs) => secs.reduce((t, s) => t + s.content.length, 0);

  // Check mandatory-only size before attempting any compaction.
  const mandatorySize = measure(mandatory);
  if (mandatorySize > maximumChars) {
    return {
      sections: mandatory,
      configuredLimit: maximumChars,
      finalCharCount: mandatorySize,
      includedSections: mandatory.map((s) => s.id),
      omittedSections: optional.map((s) => s.id),
      overBudget: true,
      overBudgetReason:
        `Mandatory sections alone (${mandatorySize} chars) exceed the configured ` +
        `limit (${maximumChars} chars). All optional sections dropped. The original ` +
        `developer prompt and governance core are preserved; optional skills, anchors ` +
        `and workflow templates were omitted.`,
      usedChars: mandatorySize,
      droppedSections: optional.map((s) => s.id),
    };
  }

  // Try including all sections, then drop optional ones from lowest priority
  // (reversed) until the budget is satisfied.
  let included = [...mandatory, ...optional];
  let size = measure(included);
  const omitted = [];

  // optional is already sorted highest-priority first; reverse for dropping.
  const dropCandidates = [...optional].reverse();
  for (const section of dropCandidates) {
    if (size <= maximumChars) break;
    included = included.filter((s) => s.id !== section.id);
    omitted.push(section.id);
    size = measure(included);
  }

  return {
    sections: included,
    configuredLimit: maximumChars,
    finalCharCount: size,
    includedSections: included.map((s) => s.id),
    omittedSections: omitted,
    overBudget: size > maximumChars,
    overBudgetReason:
      size > maximumChars
        ? `Rendered output (${size} chars) still exceeds limit (${maximumChars} chars) ` +
          `after dropping all optional sections. Mandatory content preserved.`
        : null,
    usedChars: size,
    droppedSections: omitted,
  };
}
