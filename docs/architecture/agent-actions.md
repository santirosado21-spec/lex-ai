# Internal typed agent actions

The in-app agent has no shell, filesystem, network, URL, process, or arbitrary-dispatch capability. It can request only the closed registry in `server/agent-actions.mjs`. Read-only actions (`matter.list`, `research.search`, `reminder.list`, and `planner.today`) execute immediately and are logged. All writes create a local pending proposal and require an explicit `agent.approve` call by a person.

Each proposal is bound to the active firm and, where applicable, one matter. Approval re-loads the proposal in a SQLite transaction, validates its schema and origin again, checks the current workspace/matter scope, then invokes a static internal action branch shared with the normal service paths. It never re-dispatches a proposal-supplied action name. Proposals expire after 15 minutes using the injected clock; approval is idempotent.

Document import is restricted to base64 content supplied by the user in the request. An agent-originated import is rejected. Imported text, including prompt-injection-like text, is data only: it is never interpreted as an action, never auto-approves anything, and is excluded from the append-only action log. The log records origin, action, argument hash, decision, scope, and timestamps, not content or secrets.

Residual risks: a person can approve a harmful but schema-valid proposal, document bytes remain locally stored until normal retention/deletion policy applies, and an attacker with direct SQLite write access can corrupt local state (approval still rechecks scope). This boundary does not replace OS account security, malware protection, or professional legal review.

## Canal del agente (añadido en revisión)

`dispatch` es el canal de la interfaz y de la persona usuaria: ahí `agent.approve`/`agent.reject` son válidos y `origin` es una declaración del llamador. Un agente dirigido por un modelo **nunca debe recibir `dispatch`**, solo `service.agentChannel`, que admite únicamente `agent.propose`, `agent.pending` y `agent.log`, fuerza `origin:'agent'` (rechaza que el agente declare otro) y no expone aprobar ni rechazar. Sin esa separación un agente podría declararse `user` o aprobar sus propias propuestas. Todo transporte HTTP/IPC que se añada para un agente debe enrutar a `agentChannel`; el endpoint actual con token único no distingue llamadores y no es ese canal. Aún no existe un bucle de agente que use este canal.
