# Software Documentation Types

A comprehensive reference for every category of documentation produced during the software development lifecycle, organized by the three top-level concerns of any project: **product**, **process**, and **people**.

---

## Overview

All software documentation falls under **Project documentation** — the umbrella that spans the life of the product from inception to retirement. Within that umbrella there are two primary branches:

```
Project documentation
├── Product documentation
│   ├── System documentation
│   └── User documentation
│       ├── End-user documentation
│       └── System admin documentation
└── Process documentation
```

---

## 1. Product Documentation

Product documentation describes **what the software is** and **how it is built**. It targets developers, architects, QA engineers, and technical stakeholders who need an authoritative record of design decisions and implementation details.

Product documentation splits into two sub-types: **System documentation** and **User documentation**.

---

### 1.1 System Documentation

System documentation covers the internal technical architecture of the software. It is written by and for engineers, and it is the primary artifact used during code reviews, onboarding, and maintenance.

#### 1.1.1 Product Requirement Document (PRD)

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Defines what the system must do and why |
| **Audience** | Product managers, engineers, QA, stakeholders |
| **Typical content** | Goals, user stories, acceptance criteria, constraints, non-functional requirements |
| **Owned by** | Product management |
| **Lifecycle** | Created before development; updated through the feature lifecycle |

A PRD answers three questions:
1. **What** problem are we solving?
2. **Who** has the problem?
3. **How** will we know we have solved it?

A well-formed PRD contains:
- Executive summary
- Problem statement and business context
- User personas and use-case scenarios
- Functional requirements (numbered, testable)
- Non-functional requirements (performance, security, scalability, accessibility)
- Out-of-scope items (explicit exclusions prevent scope creep)
- Acceptance criteria (maps directly to QA test cases)
- Dependencies and assumptions
- Open questions log

#### 1.1.2 Design and Architecture Documentation

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Records how the system is structured and why design decisions were made |
| **Audience** | Senior engineers, architects, new team members |
| **Typical content** | System context diagrams, component diagrams, sequence diagrams, ADRs |
| **Owned by** | Engineering / Architecture |
| **Lifecycle** | Evolves with every significant architectural change |

Core documents in this category:

- **System context diagram** — one-page view showing the system, its users, and its external dependencies.
- **Component / container diagram** (C4 model) — shows the major deployable units and how they communicate.
- **Sequence diagrams** — time-ordered interaction flows for critical paths (login, payment, data sync, etc.).
- **Data model / Entity-Relationship diagram (ERD)** — tables, relationships, constraints, and index rationale.
- **API specification** — OpenAPI / AsyncAPI contracts, versioning strategy, authentication scheme.
- **Architecture Decision Records (ADRs)** — lightweight records of every significant decision: the context, the options considered, the decision made, and the consequences. Stored alongside the code (e.g., `docs/adr/`).
- **Technology radar** — snapshot of approved, experimental, deprecated, and banned technologies.
- **Security architecture** — threat model (STRIDE), trust boundaries, key management, and network segmentation.

#### 1.1.3 Agile Product Roadmaps

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Communicates planned direction and priority over time |
| **Audience** | Product, engineering, leadership, customers |
| **Typical content** | Themes, epics, milestones, now/next/later horizons |
| **Owned by** | Product management (with engineering input) |
| **Lifecycle** | Reviewed and updated at least quarterly |

An agile roadmap is a **planning artifact**, not a contract. It expresses intent, not a schedule. Key attributes of a healthy roadmap:

- Outcome-oriented (solving customer problems, not shipping features)
- Horizon-based (Now / Next / Later rather than date-stamped Gantt charts)
- Linked to strategy (each initiative traces to a business objective)
- Publicly accessible to all stakeholders
- Updated after every sprint review

#### 1.1.4 Source Code Documentation

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Makes the codebase understandable to current and future developers |
| **Audience** | Engineers |
| **Typical content** | Inline comments, docstrings, module-level READMEs, changelogs |
| **Owned by** | Engineering |
| **Lifecycle** | Continuous — updated with every code change |

Source code documentation includes:

- **Inline comments** — explain *why*, not *what*. A comment that restates the code adds noise; a comment that records a hidden constraint or workaround adds value.
- **Docstrings / JSDoc / Javadoc** — machine-readable function and class documentation. Enables IDE hover-help and auto-generated API references.
- **Module and package READMEs** — one-paragraph context for every significant package: what it is responsible for, what it is not responsible for, and how to run it locally.
- **Changelog** — follows [Keep a Changelog](https://keepachangelog.com/) format; categorizes every release into Added, Changed, Deprecated, Removed, Fixed, and Security sections.
- **Contribution guide** (`CONTRIBUTING.md`) — branch naming, commit message conventions, PR checklist, code review SLAs.

#### 1.1.5 User Experience (UX) Design Documentation

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Captures design intent and rationale so engineering implements the right experience |
| **Audience** | UX designers, engineers, product managers, QA |
| **Typical content** | Wireframes, prototypes, design tokens, component specifications, usability findings |
| **Owned by** | Design |
| **Lifecycle** | Created before implementation; iterated based on usability research |

Key artifacts:

- **User journey maps** — end-to-end experience from first awareness to value realization.
- **Wireframes and mockups** — low-fidelity (structure) → high-fidelity (visual polish).
- **Interactive prototypes** — clickable flows used in usability tests before a line of code is written.
- **Design system / component library documentation** — every reusable component: when to use it, when not to use it, props/variants, accessibility requirements, and code snippet.
- **Usability test reports** — methodology, participants, tasks, findings, severity ratings, recommended changes.
- **Accessibility audit** — WCAG 2.1 AA compliance evidence (automated scan results + manual testing notes).

#### 1.1.6 Testing Documents

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Defines the quality strategy and records evidence that quality criteria are met |
| **Audience** | QA engineers, developers, release managers, auditors |
| **Typical content** | Test plans, test cases, test reports, coverage data |
| **Owned by** | QA / Engineering |
| **Lifecycle** | Created alongside requirements; updated with every release |

The testing documentation hierarchy:

| Document | What it contains |
|----------|------------------|
| **Test strategy** | Organization-wide approach to quality: types of testing, environments, tools, entry/exit criteria |
| **Test plan** | Feature-specific plan: scope, schedule, resources, risks, pass/fail criteria |
| **Test cases** | Step-by-step instructions with expected results; linked to requirements |
| **Traceability matrix** | Maps requirements → test cases → defects; proves coverage |
| **Test execution report** | Actual results: pass/fail per test case, environment details, defect links |
| **Defect report** | Steps to reproduce, severity, priority, environment, screenshots, fix verification |
| **Performance test report** | Baseline, load, stress, and soak test results with SLA comparison |
| **Security test report** | SAST, DAST, dependency-scan, and penetration-test findings with remediation status |

#### 1.1.7 Help and Maintenance Documentation

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Supports ongoing operation and evolution of the system after initial release |
| **Audience** | Engineers, DevOps, support teams |
| **Typical content** | Runbooks, incident playbooks, monitoring guides, on-call reference |
| **Owned by** | Engineering / DevOps |
| **Lifecycle** | Maintained continuously; reviewed after every incident |

Key documents:

- **Runbook** — step-by-step instructions for routine operational tasks (deploy, rollback, scale, rotate credentials).
- **Incident playbook** — decision trees for every known failure mode: symptoms → diagnosis → remediation → escalation path.
- **On-call guide** — what to do in the first 15 minutes of an alert; who to wake up and when.
- **Monitoring and alerting reference** — dashboard locations, alert definitions, threshold rationale, and how to silence a spurious alert.
- **Dependency inventory** — third-party libraries and services the system depends on, with versions, license types, and upgrade notes.
- **End-of-life plan** — documented decommission steps, data retention decisions, and migration guidance for users.

---

### 1.2 User Documentation

User documentation describes **how to use the software**. It is written for people who interact with the system, not people who build it. The two audiences — end users and system administrators — have different needs and receive different documents.

#### 1.2.1 End-User Documentation

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Helps non-technical users get value from the product |
| **Audience** | Customers, employees, general public |
| **Tone** | Plain language; task-oriented; minimal jargon |
| **Owned by** | Technical writers / Product |
| **Lifecycle** | Released with the feature; updated on every user-visible change |

Standard deliverables:

| Document | Description |
|----------|-------------|
| **Getting started guide** | Covers first-time setup and the "aha moment" — the fastest path to first value |
| **User manual** | Comprehensive reference for every feature, written as task-based procedures |
| **Quick reference card** | One or two pages covering the most-used actions; printed or always-visible in UI |
| **FAQ** | Answers to the top questions from support tickets and user research |
| **In-app help and tooltips** | Contextual guidance surfaced at the point of need inside the product |
| **Tutorial / walkthrough** | Guided, hands-on introduction to a workflow |
| **Release notes (user-facing)** | What changed, why it matters to the user, and any action they need to take |
| **Glossary** | Definitions of domain-specific and product-specific terms |
| **Troubleshooting guide** | Common problems users hit, with step-by-step resolution paths |

Writing principles for end-user documentation:
1. Lead with the task, not the feature ("To export a report…" not "The Export feature…").
2. Use numbered steps for procedures; use bullets only for lists where order does not matter.
3. Include a screenshot or screencast for any step that is hard to describe in words.
4. Test every procedure with a real user before publishing.
5. Keep sentences under 20 words; use active voice.

#### 1.2.2 System Administrator Documentation

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Enables administrators to install, configure, secure, and maintain the system |
| **Audience** | IT administrators, DevOps engineers, platform teams |
| **Tone** | Technical; precise; assumes familiarity with infrastructure concepts |
| **Owned by** | Engineering / DevOps / Technical writers |
| **Lifecycle** | Updated with every release that changes configuration, infrastructure, or security posture |

Standard deliverables:

| Document | Description |
|----------|-------------|
| **Installation guide** | Pre-requisites, step-by-step install procedures, verification steps |
| **Configuration reference** | Every configuration key: type, default value, valid range, effect, and example |
| **Infrastructure requirements** | CPU, memory, disk, network, OS version, and external service dependencies |
| **Security hardening guide** | Minimum permissions, network rules, TLS requirements, secret rotation procedures |
| **Backup and recovery guide** | Backup schedule, storage location, restore procedure, RTO/RPO targets |
| **Upgrade guide** | Version-by-version migration steps, breaking changes, rollback procedure |
| **Integration guide** | How to connect the system to identity providers, monitoring platforms, and third-party services |
| **Audit and compliance guide** | Log format, retention policy, access control evidence, and compliance control mapping |

---

## 2. Process Documentation

Process documentation describes **how the team works**. It is not about the software itself but about the workflows, standards, and agreements that govern how the software is built and delivered.

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Ensures consistency, repeatability, and accountability across the team |
| **Audience** | All project participants: developers, managers, stakeholders, auditors |
| **Owned by** | Project management / Engineering leadership |
| **Lifecycle** | Reviewed at the start of every project phase and updated after retrospectives |

### 2.1 Plans

Plans define **what will be done, when, and by whom**.

| Document | Description |
|----------|-------------|
| **Project plan** | Scope, schedule, resource allocation, milestones, and dependencies |
| **Release plan** | Which features go into which release; release criteria; go/no-go checklist |
| **Capacity plan** | Team availability vs. backlog demand; identifies bottlenecks before they happen |
| **Risk management plan** | Identified risks, probability × impact ratings, mitigation strategies, owners |
| **Communication plan** | Who receives what information, at what cadence, via which channel |
| **Change management plan** | How scope changes are requested, evaluated, approved, and tracked |

### 2.2 Estimates

Estimates provide **a quantified forecast of effort, time, or cost**.

| Document | Description |
|----------|-------------|
| **Effort estimates** | Story points, ideal hours, or T-shirt sizing per work item |
| **Cost estimates** | Labour, infrastructure, licensing, and contingency costs |
| **Timeline estimates** | Calendar-time projections derived from velocity data and team capacity |
| **Estimation log** | Historical record of estimates vs. actuals; used to calibrate future estimates |

Best practices:
- Distinguish estimates from commitments; document the assumption set that underlies each estimate.
- Re-estimate when scope, team composition, or technical approach changes significantly.
- Store estimates in a place that can be compared to actuals after the fact.

### 2.3 Schedules

Schedules translate estimates into **calendar-based delivery commitments**.

| Document | Description |
|----------|-------------|
| **Sprint / iteration schedule** | Which backlog items are in scope for the current iteration, with start and end dates |
| **Milestone schedule** | Key project checkpoints tied to business events (demo, pilot, launch, handover) |
| **Dependency schedule** | External dependencies that could block progress, with owners and expected delivery dates |
| **On-call rotation schedule** | Who is responsible for system availability at each point in time |

### 2.4 Reports and Metrics

Reports and metrics provide **evidence of project health** to stakeholders.

| Document | Cadence | Key contents |
|----------|---------|--------------|
| **Sprint / iteration report** | Per sprint | Velocity, completed items, carry-over, impediments |
| **Project status report** | Weekly / bi-weekly | RAG status, progress vs. plan, risks, decisions needed |
| **Quality metrics report** | Per release | Defect density, test coverage, escaped defects, MTTR |
| **Performance metrics report** | Monthly | Latency, error rate, availability vs. SLA |
| **Security posture report** | Quarterly | Open vulnerabilities, patch compliance, audit findings |
| **Post-mortem / incident report** | After every incident | Timeline, root cause, impact, action items with owners and due dates |
| **Retrospective summary** | Per sprint | What went well, what did not, agreed improvements for next sprint |

### 2.5 Working Papers

Working papers are **in-progress collaborative artifacts** — not authoritative references, but the thinking tools that produce them.

| Document | Description |
|----------|-------------|
| **Design spike notes** | Time-boxed technical investigation: question, approach, findings, recommendation |
| **Meeting minutes** | Decisions made, actions assigned, open questions; distributed within 24 hours |
| **RFCs (Request for Comments)** | Proposal documents for significant changes; open for team comment before a decision is made |
| **Discovery notes** | Raw findings from user research, stakeholder interviews, or competitive analysis |
| **Proof-of-concept report** | Hypothesis, implementation approach, results, and whether the approach is adopted |
| **Design review notes** | What was reviewed, who attended, feedback received, decisions made, required changes |

### 2.6 Standards

Standards define **the rules the team follows** — the non-negotiable baselines for how code is written, how systems are built, and how the team operates.

| Document | Description |
|----------|-------------|
| **Coding standards** | Language-specific style rules, naming conventions, complexity limits, and linting configuration |
| **Git workflow standard** | Branch naming, commit message format (e.g., Conventional Commits), PR size limits, merge strategy |
| **API design standard** | URL conventions, versioning strategy, error format, pagination, authentication |
| **Security standard** | Approved libraries, forbidden patterns, secret-handling rules, vulnerability SLAs |
| **Accessibility standard** | WCAG conformance target, required assistive-technology testing, automated tooling |
| **Definition of Done (DoD)** | The checklist every work item must pass before it can be called complete |
| **Definition of Ready (DoR)** | The criteria a backlog item must meet before the team commits to it in a sprint |
| **Incident severity definitions** | Severity 1–4 definitions, response SLAs, escalation paths |

---

## Documentation Quality Checklist

Use this checklist before publishing any document in the above categories.

- [ ] **Audience identified** — the reader is named and the document serves their specific need.
- [ ] **Purpose stated** — the first paragraph explains what the document is for and when to use it.
- [ ] **Accurate** — every claim has been verified against the current state of the system or project.
- [ ] **Complete** — no placeholder text, no TODOs left unresolved.
- [ ] **Consistent** — terminology matches the project glossary and other related documents.
- [ ] **Versioned** — the document has a version number or a last-updated date.
- [ ] **Reviewed** — at least one subject-matter expert other than the author has reviewed it.
- [ ] **Discoverable** — it is stored in the agreed location and linked from the project index.
- [ ] **Maintained** — an owner is named and a review cadence is defined.

---

## Tooling Reference

| Category | Common tools |
|----------|-------------|
| **Requirements** | Jira, Linear, Azure DevOps, Confluence |
| **Architecture diagrams** | draw.io, Mermaid, Structurizr, Lucidchart |
| **API specs** | Swagger / OpenAPI, Stoplight, Redocly |
| **Design** | Figma, Storybook |
| **Source docs** | JSDoc, TypeDoc, Javadoc, Sphinx, Docusaurus |
| **Test management** | TestRail, Zephyr, Xray |
| **Knowledge base** | Confluence, Notion, Backstage TechDocs, GitHub Wiki |
| **Runbooks / playbooks** | PagerDuty, OpsGenie, internal Confluence / Notion |

---

*Document maintained by the copilot-governance initiative. For questions or corrections, open a PR against this file.*
