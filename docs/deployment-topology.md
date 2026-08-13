# PIK v2 Deployment and Trust Boundaries

```mermaid
flowchart LR
  A["Signed policy source"] --> B["Distribution PR"]
  B --> C["Surface adapter"]
  C --> D["PIK kernel"]
  D --> E["Model-facing submission"]
  D --> F["Bounded local metadata buffer"]
  F -. "approved transport not implemented" .-> G["On-prem collector"]
  G -.-> H["Reconciled dashboard/review queue"]
```

- The Ed25519 private signing key is not stored in Git. The committed public key
  verifies the exact manifest; checksums verify every declared policy input.
- Policy packs have issued/expiry times, kernel compatibility bounds and a
  24-hour LKG expiry grace. The grace is degraded and cannot enforce.
- `PolicyPackManager` supplies background refresh for long-lived adapters. The
  current command hooks are short-lived and validate on every invocation.
- The local metadata buffer is asynchronous, bounded and rotation-safe. Optional
  AES-256-GCM encryption is enabled with an approved 32-byte key and key ID.
- Collector transport, dashboard, endpoint heartbeat and reviewer identity are
  intentionally unimplemented until enterprise destinations and approvals exist.
- Policy, adapter and script changes remain PR-controlled through CODEOWNERS;
  placeholder GitHub teams must be replaced before enterprise deployment.
