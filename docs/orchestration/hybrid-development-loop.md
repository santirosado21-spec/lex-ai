# Loop PSF para la transición híbrida

Fecha: 2026-11-09. PSF es el nombre actual de dsystem. Este es un ciclo de trabajo para una sesión de agente supervisada, no un servicio desatendido ya iniciado.

## Empezar

1. Leer [la arquitectura vigente](../architecture/hybrid-local-privacy-router-2026-11-09.md), `AGENTS.md` y `docs/agents/STATE.md`.
2. Crear una rama desde `rescate-0.4.13` que incluya los documentos de esta transición. Si todavía están en un PR sin integrar, usar la rama de ese PR como base temporal y declararlo.
3. Pegar [el prompt de arranque](hybrid-loop-prompt.md) en Codex o en el coordinador PSF elegido. Ejecutar primero H1 del [backlog](hybrid-development-backlog.md), no todas las fases en una sola entrega.
4. Abrir PR hacia `rescate-0.4.13` al tener una rebanada revisable. `main` despliega la landing y no es destino de este trabajo.

La documentación y preparación del ciclo no equivalen a haber iniciado H1 ni una sesión desatendida. El ejecutor local antiguo `scripts/loop/run.mjs` queda fuera de esta entrega: permite avanzar dependencias con revisión pendiente y no es la ruta recomendada. No iniciarlo automáticamente.

## Una iteración

**Leer → elegir tarea desbloqueada → declarar archivos y responsable → implementar → probar → revisar → corregir → registrar → commit → publicar rama/PR.**

- Una sola tarea en curso por responsable. Registrar responsable y rama en el backlog antes de editar. Con varios colaboradores, no compartir los mismos archivos o worktree al mismo tiempo.
- Definir el comportamiento observable y los archivos antes del encargo; los nombres propuestos del backlog pueden ajustarse tras leer el código y registrar la razón.
- Mantener el modo de producto local actual. Toda ruta remota nueva nace desactivada. No reemplazar directamente la instancia compartida de inferencia: existen conversación, análisis y propuestas proactivas.
- Usar pruebas negativas además del caso feliz. Una prueba de transporte verifica bytes de la solicitud completa, no solo coincidencias en la salida del detector.
- Ejecutar pruebas dirigidas por tarea, `npm test` y `npm run build` antes de marcar una rebanada integrable. Registrar resultados reales y separar fallos previos. No repetir toda la suite si no hay cambios o problemas nuevos.
- Solicitar revisión independiente del diff a un colaborador apto y disponible. Su informe no reemplaza las pruebas. Si no está disponible, continuar implementación y pruebas en Codex y dejar el resultado en `review-pending`; puede publicarse como borrador, pero no desbloquea dependencias ni se integra.
- Un máximo de tres intentos fallidos sobre la misma tarea; después, diagnóstico con evidencia y estado `blocked`. Sin comprar cuota, cambiar de modelo silenciosamente ni reiniciar un agente fallido en bucle.
- Cada entrega actualiza backlog y memoria con qué se implementó, qué se midió, limitaciones y siguiente paso. Una tarea marcada `done` incluye evidencia y revisión. Un pase de regex o mocks no valida privacidad del detector ni calidad jurídica.
- El coordinador concede `done` con aceptación demostrada, revisión registrada y commit probado. Para reabrir `blocked`, registra diagnóstico y decisión explícita de reanudación; no hay reinicio automático. Tras H3, ejecutar H3V como primer flujo completo simulado y conservar esa prueba al introducir detector, cifrado y adaptador.

## Reparto PSF

| Participante | Encargo permitido |
| --- | --- |
| Codex, coordinador de esta entrega | Alcance, implementación, decisiones, verificación e integración |
| Claude, cuando lo elija el coordinador y se verifique acceso/modelo | Diseño o revisión difícil acotados; permitido por la actualización vigente del proyecto, sin compras |
| Kimi o Gemini | Una revisión independiente útil de un paquete sintético/público revisado, sin asumir acceso al repo |
| Cursor | Archivos asignados y modelo no-Claude explícitamente verificado según su ruta; no usar Auto |
| Gemma por `localllm` | Resumen de logs o clasificación sencilla; verificar su resultado; no código entregable ni decisiones de seguridad/costo |
| Groq u OpenRouter `:free` de desarrollo | Apoyo sencillo si hace falta y la ruta gratuita está comprobada; no decidir ni reemplazar revisión |
| Lorenzo y Cordero | Revisar el PR y acordar tareas; esta guía no les asigna trabajo ni afirma que aprobaron |

Consultar la skill PSF instalada. Si otro equipo no la tiene, esta tabla y el prompt contienen las reglas necesarias para continuar; no depende de rutas absolutas de la Mac de Santiago. Una declaración de `psf seats` no prueba cuota ni acceso efectivo: registrar el resultado de la llamada real. No convocar a todos rutinariamente.

## Compartir con GitHub

Trabajar en ramas `feat/hybrid-Hn-descripcion`, con commits pequeños y PR a `rescate-0.4.13`. Para documentos de arranque usar una rama `docs/…`. Antes de publicar, revisar `git diff --cached` y añadir archivos por nombre. No usar `git add .`, force-push, cambios de visibilidad o de permisos, ni activar despliegues. Publicar commits propios probados en la rama de trabajo; no fusionar sin revisión.

El repo fue observado como público en esta sesión. Publicar únicamente código de desarrollo revisado, documentación y fixtures inequívocamente sintéticos. Excluir `.env`, claves, datos de clientes, almacenes locales, artefactos, pesos y logs con contenido privado. Las credenciales PSF no son credenciales de producción.

Para preparar un panel desde este repo existe `node scripts/dsystem/sf.mjs panel --request archivo.json --from codex --seats kimi`. Es una llamada real que consume la cuota existente del asiento elegido; no ejecutarla rutinariamente en cada iteración. Los resultados originales quedan en `artifacts/sf/`, sin publicar automáticamente. Publicar solo la síntesis revisada.

## Puertas del producto

H1–H7 se desarrollan y verifican offline con datos sintéticos. H3V prueba pronto la composición; H4 y H5 pueden avanzar en paralelo con responsables separados. H6 mantiene sus puertas de preparación de privacidad/almacenamiento. El proveedor simulado permite probar el adaptador sin red. Las llamadas remotas reales requieren acceso autorizado, ruta/modelo explícitos y presupuesto aprobado cuando haya cobro. Un piloto con clientes exige además autorización concreta del despacho y comprobación del tratamiento, cifrado y recuperación. El loop puede avanzar trabajo independiente sin convertir una espera en aprobación.

La primera salida esperada es un PR H1 con transporte simulado y pruebas; después H2 aplica el límite de salida antes de introducir el detector. Así ningún modelo obtiene por sí mismo la autoridad de enviar datos.
