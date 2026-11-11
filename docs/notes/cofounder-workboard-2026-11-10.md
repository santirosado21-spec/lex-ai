# Coordinación de trabajo — Lorenzo, Pedro y Codex

Actualizado: 2026-11-10. Fuente de verdad: `main`, `docs/agents/STATE.md` y `docs/orchestration/hybrid-development-backlog.md`. Esta nota de trabajo evita que dos personas editen el mismo frente sin avisar; no sustituye una revisión jurídica ni los gates de privacidad.

| Frente | Dueño actual | Archivos o decisión reservados | Estado y siguiente entrega |
| --- | --- | --- | --- |
| OpenRouter H6, adaptador técnico | Codex | `server/providers/`, `tests/openrouter-provider.test.mjs`, contrato/QA H6 | Implementar y probar con transporte falso, apagado por defecto. Credencial de producto independiente de PSF. Ningún documento real ni inferencia facturable. |
| Privacidad H4 Nym V3-R2 | Sin asignar | Identidad `pyvenv.cfg` y Python base en V3 | Bloquea freeze y prueba real; no ejecutar modelo hasta revisión independiente. |
| Bóveda H5 | Sin asignar | Mapas H3 tipados, aprobación atómica, custodia | Primera subserie sintética de lectura pasó; matriz completa, cifrado y recuperación pendientes. Código nativo nuevo sólo en VM pública limpia. |
| Revisión jurídica S2b.2 | Lorenzo y Pedro, si aceptan el frente | 30 casos ficticios y fuentes oficiales; no cambiar el examen | Registrar para cada caso exactitud, citas, utilidad y errores. Sin expedientes reales ni afirmar validación por una sola muestra. |
| Corpus oficial MX | Sin asignar | Selección, fidelidad, vigencia y permisos por fuente | PDF federales y NL siguen en cuarentena. Registrar discrepancias antes de indexar. |
| Instaladores | Sin asignar | Mac Silicon, Mac Intel y Windows | Sólo hay enlace al DMG ARM anterior; no publicar URLs hasta verificar cada artefacto y equipos de 8 GB. |

Antes de empezar: añadir nombre, rama, archivos propios y criterio de aceptación en esta tabla o en el PR. Trabajar en una rama corta desde `main`, preservar cambios ajenos, usar sólo datos ficticios/públicos y dejar pruebas más revisión distinta del autor. Después actualizar backlog y memoria y subir el avance a `main` cuando sea revisable. El flujo actual de la app sigue local y SQLite no está cifrada; la conexión de OpenRouter no autoriza enviar asuntos de clientes.

Nota de disponibilidad: esta copia en Git es la coordinación compartida. Una nota equivalente quedó en la app Notas del dueño; no se ha comprobado que esa nota esté compartida con Lorenzo y Pedro.
