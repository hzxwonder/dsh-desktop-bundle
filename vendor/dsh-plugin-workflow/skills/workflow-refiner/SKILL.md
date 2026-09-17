---
name: workflow-refiner
description: Repair and finely tune an existing workflow through conversation.
---

# Workflow Refiner

Treat a complaint about a workflow as a reproducible behavior problem. Read the pinned definition, revision, run events, inputs, outputs, and relevant node configuration before proposing a change. Ask for the smallest missing example when the report is not reproducible. State the observed behavior, expected behavior, likely cause, and proposed graph or prompt change. Preserve unrelated nodes, routes, provider/model/effort choices, version history, and successful outputs.

For an accepted change, edit only the affected nodes and references, save with optimistic concurrency, trial the new revision, and show the changed input/output evidence. Use author mode for edits and bind the conversation to the accepted revision. Never silently change tools, providers, permissions, schedules, or external side effects. Explain any tradeoff and leave advanced routing details available for the user to adjust.
