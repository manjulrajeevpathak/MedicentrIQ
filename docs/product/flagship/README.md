# AI Patient Access and Continuity Platform

## Product Documentation Pack

This folder contains the product documentation for HealthcareOS's flagship application: the AI Patient Access and Continuity Platform.

The platform is intended for Indian healthcare providers and specialty networks. It owns the patient lifecycle from first contact through appointment booking, pre-visit preparation, post-visit follow-up, care-continuity journeys, leakage recovery, and staff daily work prioritization.

HealthcareOS owns the healthcare product, workflows, domain model, user experience, and integrations. DatacentrIQ powers the intelligence layer through Copilot APIs and Control Tower APIs embedded inside HealthcareOS workflows.

Implementation organization: HealthcareOS is a parent folder containing independent services. It should not behave like a package monorepo, and services should not depend on shared runtime packages.

## Product Frame

The platform should not be positioned as a generic healthcare CRM, chatbot, or appointment tool. It should be positioned as the patient lifecycle brain for Indian healthcare providers.

Core promise:

HealthcareOS helps providers convert patient demand, prevent drop-offs, recover follow-ups, and coordinate care journeys through AI-assisted workflows.

## Documentation Set

- [MVP PRD](./mvp-prd.md)
- [Workflows and Edge Cases](./workflows-and-edge-cases.md)
- [AI and DatacentrIQ Architecture](./ai-datacentriq-architecture.md)
- [Data Governance and Integrations](./data-governance-and-integrations.md)
- [Service Architecture](./service-architecture.md)
- [Technical Architecture and Stack](./technical-architecture-and-stack.md)
- [Implementation Status](./implementation-status.md)
- [GTM, Pilot, and Success Metrics](./gtm-pilot-and-success-metrics.md)

## Recommended Reading Order

1. Read the MVP PRD to understand scope and product requirements.
2. Read the workflow document to understand how users actually operate the product.
3. Read the AI and DatacentrIQ architecture to understand how intelligence is embedded.
4. Read the data governance and integrations document before implementation planning.
5. Read the service architecture before implementation planning.
6. Read the technical architecture and stack document before implementation planning.
7. Read the implementation status to see what is already built.
8. Read the GTM and pilot document before customer discovery or pilot design.

## Current Product Decision

Patient access and care continuity should be one flagship application. They should not be split into separate products at MVP stage because the same patient, staff, appointment, communication, and follow-up data powers both sides of the lifecycle.

## Current Scope Boundary

In scope for the flagship:

- Patient intake from WhatsApp, calls, missed calls, web leads, referrals, and walk-ins
- Patient identity and matching
- Appointment and access orchestration
- Pre-visit preparation
- Post-visit follow-up journeys
- Staff daily workbench
- Patient 360 timeline
- AI-assisted summaries, drafting, routing, prioritization, and leakage detection

Out of scope for the flagship MVP:

- Full HIS or EMR replacement
- Autonomous diagnosis or prescribing
- Full insurance claims automation
- Population health and community outreach
- Custom AI diagnostic models
- ABDM dependency as a launch blocker

## DatacentrIQ Usage Principle

DatacentrIQ should not appear to users as a separate analytics layer they need to operate. Its intelligence should appear inside HealthcareOS as practical workflow guidance:

- What needs attention
- Why it matters
- What action is recommended
- What data supports the recommendation
- What happened after the action

## Open Naming

The working product name is still open. Current candidate themes:

- CareLoop
- PatientLoop
- CareBridge
- CareFlow
- PatientPath
- Saarthi
- SevaFlow

The category label can remain "AI Patient Access and Continuity Platform" until a product name is chosen.
