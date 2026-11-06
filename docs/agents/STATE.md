# Estado del proyecto — LEX AI

> Memoria compartida entre agentes (Claude, Codex, Gemini, Kimi, Cursor…). Lee esto al empezar; al terminar, actualiza "Ahora" y "Siguiente" y deja una entrada en LOG.md con `dmem log`. Reglas del proyecto: AGENTS.md (mandan sobre este archivo). Sin claves, sin datos de clientes.

**Última actualización:** 2026-11-06 09:17 por claude: Repo preparado para compartir con Pedro y Lorenzo

## Objetivo
Asistente jurídico conversacional, privado y ligero para despachos mexicanos en equipos de 8 GB. Dirección del dueño 2026-11-05: aceptar inferencia híbrida con prioridad en integración oficial ChatGPT, conservar biblioteca jurídica, habilidades/recursos, expedientes, archivos y horas. Almacenamiento y recuperación locales por defecto; solo contexto autorizado al proveedor. Propuesta vigente: `docs/architecture/hybrid-private-workspace-2026-11-05.md`; los requisitos jurídicos y conversacionales del contrato anterior continúan.

## Ahora (2026-11-05, dirección híbrida)
- Propuesta y fuentes oficiales registradas; elegibilidad comercial de integración de suscripciones aún no comprobada. API por despacho es alternativa separada; no se activó facturación ni se verificaron créditos de la cuenta.
- Se confirmó en código almacenamiento SQLite con permisos restringidos; falta cifrado propio de base/índices/temporales. Ya existen funciones locales de horas/tarifas/reportes.
- Sin cambios de runtime, cargas de clientes ni inferencia externa en esta tarea. La arquitectura híbrida y el cifrado siguen como trabajo de implementación, no validación comercial.

## Ahora (2026-11-04 noche)
- App instalada 0.4.13. Todo el trabajo desde 0.4.4 está en la rama **`rescate-0.4.13`** (no en `main`; `main` despliega la landing). 417 pruebas pasan.
- **Examen ciego** `eval/dialogue/cases.jsonl` (36 casos, retenidos; nunca usarlos para entrenar) con `scripts/eval-dialogue.mjs run|judge`. El juez fiable es `judge --both-orders` (temperatura 0). Los veredictos de juez antes de `0dae09a` son orientativos. Última medición completa: v11 vs base **11 / 8 / 4** en 23 de 36 casos. La fidelidad jurídica aún no mejora de forma demostrada.
- Mejoras ya en el código: artículo exacto de la Constitución, calculadora local, validador que descarta párrafos sin respaldo en vez de rendirse, filtro de distractores (**frágil según el panel SF**, ver LOG), reutilización de fuentes en "más corto".
- **Destilación** (capa 4, autorizada por el dueño): `scripts/distill/` y `docs/qa/distillation-2026-11-04.md`. Hay **764 semillas** en `artifacts/distill/seeds-v1.jsonl` (artículo 440, situación 244, faltan hechos 80). Faltan unas 900 (resto de situación y faltan-hechos, abstención, seguimiento, charla). Kimi llegó a su **límite de uso de 5 horas** (plan de pago, sin compras de uso extra); los generadores se detuvieron limpio y se reanudan con `--resume`.
- **PSF** (fábrica de software de dsystem): comando `psf` (panel de decisores; `dsf` sigue como alias) y `dmem` (esta memoria). Guía: skill `~/.agents/skills/psf/SKILL.md`.

## Siguiente
Prioridad nueva: confirmar acceso oficial ChatGPT para el producto comercial; preparar adaptador y prueba pública/sintética con política de salida por asunto, medición y cifrado recuperable. El entrenamiento local deja de ser requisito previo; los pasos históricos siguientes se conservan para referencia y no implican una reanudación automática.

1. Reanudar la generación de ejemplos cuando Kimi se libere: `node scripts/distill/generate.mjs --seeds artifacts/distill/seeds-v1.jsonl --out artifacts/distill/examples-v1-sN.jsonl --shard N/2 --model kimi-code/k3.1-pro --resume` (N = 0 y 1). Luego generar las semillas restantes con `seeds.mjs --only … --append`.
2. Construir el conjunto: `scripts/distill/build-dataset.mjs`; LoRA corto con `mlx_lm.lora` sobre `artifacts/training/qwen-base-2b-4bit` (base preservada, candidato inactivo).
3. Medir el candidato contra la base con el examen ciego en el formato de la app. Falta convertir a GGUF: **llama.cpp no está instalado** (pedir aprobación al dueño).
4. Probar la hipótesis del panel SF sobre el filtro de distractores (puntaje del recuperador, mínimo de 2 fuentes).

## Bloqueos y decisiones pendientes del dueño
- Aprobar instalar llama.cpp (conversión a GGUF).
- Sin Mac física de 8 GB no se puede validar el objetivo; sin notarización Apple (USD 99/año) macOS bloqueará el instalador.
- OpenRouter activado con modelos `:free` (el dueño tiene 3 centavos de saldo; el código impide cobrar), pero sus dos primeras llamadas dieron 429. Pendiente repetir más tarde.

## Dónde está cada cosa
- Ciclo de mejora y su registro de versiones: `docs/qa/dialogue-loop-2026-11-04.md`.
- Colaboradores remotos: `docs/orchestration/remote-collaborators.md`; Cursor/Kimi de escritorio: `docs/orchestration/desktop-collaborators.md`.
- Pruebas: `node --test tests/*.test.mjs`. La prueba de dictado `stt.test.mjs` («concurrent job…») es intermitente y ya documentada.
