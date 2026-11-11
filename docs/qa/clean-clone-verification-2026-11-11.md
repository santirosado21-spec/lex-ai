# Verificación de clon limpio y reconstrucción — 11 de noviembre de 2026

Se verificó el estado del repositorio público en un contenedor Linux limpio (Node v22.23.4, npm 10.9.9) tras la pérdida del entorno de trabajo anterior. Ningún resultado de esta página acredita macOS, hardware de 8GB, la biblioteca legal de producción, el tokenizer de producción, calidad de modelo ni fidelidad de producción: los activos de producción no existen en este entorno y el alcance de las pruebas reproducibles es exclusivamente sintético.

## Base limpia d1518eb

Clon completo de https://github.com/santirosado21-spec/lex-ai en `d1518eb06cc5361f34666365386aced089eda897` (docs/hybrid-psf-development-loop), `npm ci` y `npm test`: 1108 pruebas, 1075 pasan, 23 fallan, 10 se omiten. Los 23 fallos son la señal deliberada de prerrequisitos ausentes, no regresiones: 14 de fidelidad de corpus por activos de producción ausentes, 6 de IPC que requieren `sandbox-exec` de macOS, 2 del tokenizer de producción y 1 de vocabulario. La clase de cada fallo se confirmó leyendo cada prueba; no se silenció ninguna.

## Rama instinct/continuity-rebuild (5 commits reconstruidos)

Reconstruidos y re-derivados de la fuente actual, no recuperados del parche perdido: compuerta de plataforma Darwin para las 6 pruebas IPC (`c74b572`), desacoplamiento de fidelidad con `fidelityGate` — skip explícito por defecto, fallo nombrado con `LEX_REQUIRE_FIDELITY=1`, sólo ENOENT cuenta como ausente (`645259d`), las 6 pruebas IPC movidas a la compuerta para que el modo requerido también falle nombrado por prerrequisito de plataforma (`be90454`), corrección visual del panel móvil a 44px con aserciones de marca y retiro del smoke duplicado de landing (`c11e59d`), y guardia de deriva entre los conteos de la matriz de 32 filas documentados en el README del vault y la compuerta de paridad en código (`fe073dd`).

Validación en este estado: `npm test` por defecto 1113 pruebas, 1080 pasan, 0 fallan, 33 se omiten con razón explícita (exit 0). `npm run test:fidelity` (modo requerido) falla cerrado con exit 1: 1113 pruebas, 1080 pasan, 23 fallos todos nombrados `FIDELITY PREREQUISITE MISSING` (17 de activos, 6 de plataforma), 10 omitidas. `npm run build` exit 0. Los smokes de UI (ui-smoke, ui-dashboard, ui-hig) pasan; el panel abierto a 390px se inspeccionó visualmente con filas de 44px sin desbordamiento.

## Verificación desde clon fresco independiente

El parche acumulado de los 6 commits se aplicó con `git am` sobre un segundo clon fresco de GitHub en `d1518eb`, sin reutilizar el directorio de trabajo: aplicación limpia, `npm ci` exit 0, `npm test` 1113/1080/0 fallos/33 omitidas exit 0, `npm run test:fidelity` exit 1 con exactamente los 23 fallos nombrados de prerrequisito, `npm run build` exit 0. El hash del commit resultante difiere del de la rama de trabajo sólo por fecha de committer, como espera `git am`; el contenido aplicado es idéntico.

## Límites

Los conteos documentados en el README del vault y en la matriz de código coinciden hoy (3/27/2, `VAULT_PARITY_COMPLETE=false`); la guardia nueva sólo detecta deriva futura, no cambia el estado de paridad. Las conclusiones de reproducibilidad del índice público y de fragmentos aplican sólo a fixtures sintéticos en este entorno; los hashes exactos de artefactos de producción quedan intactos y no se re-fijó nada. Este documento no autoriza push, despliegue ni ejecución de adquisición de corpus.
