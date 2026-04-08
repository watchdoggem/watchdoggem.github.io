# TAO Arb Control

Preliminary control dashboard for a future `wTAO / wstTAO` basis bot.

Current scope:

- watch-only operator console
- mock spread / NAV monitor
- epoch and oracle timing panel
- route playbook for premium vs discount capture
- risk envelope and event log

Next logical wiring steps:

1. Replace mock price state with real `wTAO` and `wstTAO` market feeds.
2. Add actual mint / redeem NAV math and queue timing from the protocol.
3. Add wallet state, balances, and paper-trade ledger.
4. Only then consider execution hooks.
