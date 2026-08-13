import { randomUUID } from "node:crypto";

function sizeBucket(chars) {
  if (chars === 0) return "0";
  if (chars <= 250) return "1-250";
  if (chars <= 1_000) return "251-1000";
  if (chars <= 4_000) return "1001-4000";
  if (chars <= 16_000) return "4001-16000";
  return "16001+";
}

export function surfaceCapabilities(surface, event) {
  const notifyOnly = (surface.notifyOnly || []).includes(event);
  return {
    observe: true,
    notify: surface.systemMessage === true || notifyOnly,
    replace: !notifyOnly && surface.rewriteVerified === true,
    augment: !notifyOnly && surface.injectVerified === true,
    block: !notifyOnly && surface.block !== null,
    correlateDownstreamDelivery:
      !notifyOnly && surface.deliveryProof?.status === "canary-verified",
  };
}

export function createCanonicalEnvelope({
  prompt,
  surface,
  event,
  payload = {},
  kernelVersion,
  policyPack,
  repositoryProfile,
  cohort,
}) {
  const eventId = randomUUID();
  const envelope = {
    schemaVersion: 1,
    eventId,
    correlationId:
      payload.session_id || payload.sessionId || payload.correlationId || eventId,
    observedAt: new Date().toISOString(),
    kernelVersion,
    client: surface.id,
    adapter: surface.adapterId || surface.id,
    hook: event || surface.events?.[0] || "unknown",
    clientVersion: payload.client_version || payload.clientVersion || null,
    adapterVersion: surface.adapterVersion || null,
    extensionVersion:
      payload.extension_version || payload.extensionVersion || null,
    repositoryClass: repositoryProfile?.stacks || [],
    cohort: cohort || "unassigned",
    policyPackVersion: policyPack.manifest.version,
    policyPackChecksum: policyPack.checksum,
    policyPackSource: policyPack.source,
    prompt: {
      chars: prompt.length,
      charsBucket: sizeBucket(prompt.length),
      localTokenEstimate: Math.ceil(prompt.length / 4),
      tokenEstimateBucket: sizeBucket(Math.ceil(prompt.length / 4)),
    },
    interactionType:
      payload.interaction_type || payload.interactionType || "unspecified",
    capabilities: surfaceCapabilities(surface, event),
    selectedWorkflowIds: [],
    policyResults: [],
    operatingMode: "shadow",
    decision: "evaluation_pending",
    controlState: "observed",
    latencyMs: {},
    failureMarkers: [...(policyPack.degradedReasons || [])],
    bypassMarkers: [],
  };

  // The original prompt is available to the in-memory pipeline but is
  // deliberately non-enumerable so JSON serialization cannot leak it.
  Object.defineProperty(envelope, "originalPrompt", {
    value: prompt,
    enumerable: false,
    writable: false,
  });
  return envelope;
}

export function telemetryFromEnvelope(envelope, decision) {
  return {
    schemaVersion: envelope.schemaVersion,
    eventId: envelope.eventId,
    correlationId: envelope.correlationId,
    ts: envelope.observedAt,
    kernelVersion: envelope.kernelVersion,
    client: envelope.client,
    surface: envelope.client,
    adapter: envelope.adapter,
    hook: envelope.hook,
    event: envelope.hook,
    clientVersion: envelope.clientVersion,
    adapterVersion: envelope.adapterVersion,
    extensionVersion: envelope.extensionVersion,
    repositoryClass: envelope.repositoryClass,
    cohort: envelope.cohort,
    policyPackVersion: envelope.policyPackVersion,
    policyPackChecksum: envelope.policyPackChecksum,
    policyPackSource: envelope.policyPackSource,
    promptCharsBucket: envelope.prompt.charsBucket,
    promptTokenEstimateBucket: envelope.prompt.tokenEstimateBucket,
    governedCharsBucket: decision.governedCharsBucket || "0",
    capabilities: envelope.capabilities,
    selectedWorkflowIds: envelope.selectedWorkflowIds,
    selectedSkills: decision.selectedSkills || [],
    policyResults: envelope.policyResults,
    operatingMode: envelope.operatingMode,
    mode: decision.mode,
    decision: envelope.decision,
    controlState: envelope.controlState,
    latencyMs: envelope.latencyMs,
    failureMarkers: envelope.failureMarkers,
    bypassMarkers: envelope.bypassMarkers,
    blocked: decision.mode === "block",
    unenforceable: decision.unenforceable === true,
    advisoryShown: decision.advisoryShown === true,
    contextBudgetChars: decision.contextDecision?.configuredLimit ?? 18_000,
    contextUsedChars:
      decision.contextDecision?.finalCharCount ??
      decision.contextDecision?.usedChars ??
      0,
    contextOverBudget: decision.contextDecision?.overBudget ?? false,
    exceptionIds: (decision.ruleResults || [])
      .map((result) => result.exceptionId)
      .filter(Boolean),
  };
}
