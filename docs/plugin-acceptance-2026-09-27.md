# Desktop plugin acceptance — 2026-09-27

Targets: DSH Omni 2.0.15-next and official DeepSeek Harness 0.1.7-rc.2 on macOS.

| Check | Result |
| --- | --- |
| Omni navigation | Plugins, automation, workflow and paper workbench use native panel rows with shared geometry; panel opening and sidebar toggle verified through Computer Use. |
| Omni sessions | Workspace/history lists load, New Session selects Chat, Copy Session Reference shows success. |
| Workflow on both applications | Imported a dedicated artifact workflow through the native file picker, ran it, and observed completed status. Output file contains `DESKTOP_WORKFLOW_OK`. |
| Official browser | Official native sidebar rendered Example Domain as interactive HTML; restored tab available after restart. |
| Automated workflow regression | 53 passed. Includes execution, debugging, resume, checkpoints and repeat boundaries with test adapters. |
| Browser regression | 42 passed, 2 skipped. |
| Official application integrity | macOS strict deep signature verification passed. Plugin files and profile configuration carry compatibility changes. |

Omni setup aligns existing runtime overlays with the bundled runtime and keeps replaced packages in a timestamped backup directory. Workflow and paper navigation register with `sidebar.panellist`. Browser integration detects the official desktop bridge and retains the native sidebar owner.

Scope: deterministic workflow execution and UI integration. Live model generation, third-party publication and every historical workflow configuration are outside this acceptance run.
