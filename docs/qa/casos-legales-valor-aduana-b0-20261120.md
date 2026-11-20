# Dos casos legales inéditos sobre varias obligaciones y excepciones (valor en aduana)

**20 de noviembre de 2026.** Estado: **anotados y congelados, NO probados.** No se corrieron en el piloto: faltan `resources/public-library.sqlite` y el modelo local (bloqueos ya reportados).

`eval/legal-b0/casos-valor-aduana-b0-20261120.json`, SHA-256 `91b240bce8bcc5b8d2f35bdebefd2e073ce52c4f6d8e571ab83ea541624bc0f8`.

Cubren los artículos 65 y 66 de la Ley Aduanera (ajustes que se suman al precio pagado y conceptos que no integran el valor si se desglosan). Cada caso trae la fecha de operación, la pregunta, los resultados esperados con fracción e inciso y las trampas. Las respuestas esperadas salen del texto de la Cámara (última reforma DOF 19-11-2025), leído en `resources/trade/ley-aduanera-2025.pdf`; no las revisó un abogado.

## Fecha de operación
- Caso A, 10-mar-2026: posterior a la edición de la Ley en el repositorio.
- Caso B, 15-jun-2025: anterior a la reforma del 19-11-2025. En los artículos 64 a 67 la edición sólo marca «Párrafo reformado DOF 25-06-2018» (art. 66). Esa ausencia de otras marcas no prueba que el texto de 2025 fuera idéntico; la versión del 15-jun-2025 no se verificó.
- El Reglamento antes del 24-feb-2026 no tiene texto previo en el repositorio (ver `reglamento-vigencia-por-fecha-20261120.md`).

## Cómo usarlos
Reserva: no ajustar prompts ni recuperación con estos casos. Cuando existan la biblioteca y el modelo, medir por separado si el piloto (a) recupera los incisos correctos, (b) separa lo que se suma de lo que no y (c) advierte la fecha. Sin respuestas esperadas en el prompt.

## Tercer caso: RGCE 2026, transitorios y vigencia condicionada (Anexo 22)
`eval/legal-b0/caso-rgce-transitorios-b0-20261120.json`, SHA-256 `85ff917fe7f5bb8b8c2faead3068d5629fde8df5c8f9fc67fb84dcb24871cc32`. Anotado, **no probado**.

- El Transitorio Décimo Primero de las RGCE 2026 (DOF 27-12-2025) se reformó dos veces: 14-may-2026 (plazo hasta 31-may-2026) y 22-sep-2026 (plazo hasta 30-sep-2026 y excepción de transmisión del art. 81 del Reglamento hasta 31-dic-2026 si se transmite conforme al art. 36-A). El texto original de 2025 no está en el repositorio.
- Las claves AL y C1 del apéndice 9 del Anexo 22 no tienen vigor por fecha: dependen de que la Ventanilla Digital libere el trámite y de un aviso o comunicado de Economía en SNICE. Esas fechas no se verificaron. Leído en SIDOF por resultados de búsqueda: https://sidof.segob.gob.mx/notas/5783929 (aluminio) y https://sidof.segob.gob.mx/notas/5788843 (azúcar, sin confirmar que sea el acuerdo de la clave C1).
- Consecuencia: una compuerta por fecha de publicación daría resultados incorrectos para AL y C1. No se implementó nada.
