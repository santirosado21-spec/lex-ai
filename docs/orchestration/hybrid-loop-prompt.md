# Prompt para iniciar el desarrollo con PSF / dsystem

Copiar el bloque siguiente al agente coordinador. No es un proceso que ya esté corriendo.

```text
Trabaja en PSF (antes dsystem) en LEX AI. Tu objetivo es implementar por
rebanadas la transición de docs/architecture/hybrid-local-privacy-router-2026-11-09.md.

Lee primero AGENTS.md, docs/agents/STATE.md,
docs/orchestration/hybrid-development-loop.md y
docs/orchestration/hybrid-development-backlog.md. Consulta la skill PSF instalada;
si no está disponible, usa las instrucciones autocontenidas de esos documentos
y registra la limitación. Respeta cambios de otros colaboradores.

Empieza por H1, o por la primera tarea todo cuyas dependencias estén done.
No declares el producto listo por terminar una rebanada. Conserva originales,
biblioteca, asuntos, chats y horas. No reanudes entrenamiento ni descargues
modelos por este encargo.

En esta sesión ejecuta como máximo dos rebanadas consecutivas y usa un máximo
de tres intentos fallidos por tarea. Antes de cada una registra objetivo,
responsable, rama, archivos y aceptación en el backlog. Implementa con datos
sintéticos, prueba y solicita revisión independiente acotada cuando proceda.
Consulta skills pertinentes antes de delegar. Los colaboradores externos solo
reciben paquetes revisados públicos/sintéticos, nunca secretos ni clientes.
Gemma ayuda con texto verificable; no le encargues código entregable ni
decisiones críticas. No convoques a todos ni inventes contribuciones.

Si un colaborador no está disponible o no tiene cuota, registra el fallo y
continúa en Codex sin reintentos automáticos, sustituciones silenciosas ni
compras. Si falta revisión independiente, marca review-pending: puede haber
un PR borrador, pero no integración ni dependencias desbloqueadas. Solo done
desbloquea la siguiente tarea. Tras tres fallos, diagnostica y deja blocked
con evidencia; avanza solo trabajo independiente.

Verifica primero las pruebas dirigidas; ejecuta npm test y npm run build antes
de cerrar cada rebanada integrable. No pruebes con datos reales. Toda ruta
remota comienza apagada y usa transporte simulado. Sin facturación, recargas,
clientes externos, comunicaciones ni cambios de permisos. Acceso/costo reales
y piloto tienen sus puertas explícitas en el backlog; no interpretar silencio
como aprobación.

Trabaja desde rescate-0.4.13 incluyendo el PR del plan si aún no se integra,
en una rama feat/hybrid-Hn-descripcion o un worktree propio cuando haga falta.
No modifiques main ni worktrees ajenos. No hagas reset --hard, clean,
force-push ni mezcles archivos pendientes ajenos.

Al terminar cada rebanada actualiza backlog y docs/agents/ con hechos,
pruebas, revisión, limitaciones y siguiente tarea. Revisa el diff y secretos,
añade solo archivos propios por nombre y crea un commit. Publica la rama
en origin y abre o actualiza un PR hacia rescate-0.4.13. No lo fusiones ni
despliegues. Si GitHub falla, conserva commits y comunica la causa.

Entrega enlace al PR, tareas terminadas y pendientes, pruebas reales,
colaboradores que efectivamente participaron y el siguiente paso concreto.
```
