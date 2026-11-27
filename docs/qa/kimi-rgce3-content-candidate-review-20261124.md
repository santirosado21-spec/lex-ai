# Revisión sustantiva: candidato aislado de 9 textos RGCE3

- Fecha: 2026-11-24. Revisor: Kimi (sesión Orca f14e396b). Versión final (sustituye al parcial de las 10:04).
- Objeto: `docs/qa/rgce3-isolated-content-candidate-2026-11-24.md`, `rgce3-isolated-content-candidate.json`, `rgce3-candidate-source-clean.txt`, `experiment/build-rgce3-content-candidate.py` y fuentes referidas.
- Sin desarrollo, sin adopción, sin cambios al corpus. No se repiten claims ni acks.

## 1. Reproducción

- **Repro del script del autor: bloqueada por entorno.** `python3 build-rgce3-content-candidate.py` → `ModuleNotFoundError: No module named 'bs4'`; BeautifulSoup4 no está en `/usr/bin/python3` ni en homebrew python3.14 y la política vigente no me autoriza instalaciones.
- **Verificación equivalente con stdlib (ejecutada):** las 8 aserciones del autor replicadas contra los artefactos existentes — **8/8 PASS**: 9 IDs únicos; roundtrip offset→texto→sha256 en los 9 registros (más prefix/suffix de 70 chars); `adoptable:false` y `legalSearchEnabled:false` en todos; sin CSS/script en textos; límite AVC sin `SEGUNDO.` ni `4.6.28.`; filas Tulum (`53 4 …`) y CL exactas; orden Primero→Quinto; 6 fechas del décimo primero presentes.
- **Integridad de fuente añadida:** sha256 del HTML original = `sourceHtmlSha256` del contrato y de cada ancla; sha256 del texto derivado = `derivedTextSha256`; los 9 spans ordenados y sin solapamiento.

## 2. Cotejo sustantivo

| Punto del gate | Resultado |
|---|---|
| Límite AVC y vecinos | **Sin absorpción ni pérdida.** El registro AVC (span 8816–12462) inicia en `3.1.43.` y termina antes del encabezado "Tránsito internacional…Corredor Interoceánico". La regla vecina 4.6.28 queda íntegra en el texto derivado, entre el registro AVC y el SEGUNDO (segmento de 1 721 chars que la contiene); solo quedó excluida del registro, no del texto. La primera aparición de `4.6.28.` (offset 1391) está en la parte resolutiva temprana, fuera del span AVC |
| Carácter parcial del artículo SEGUNDO | **Confirmado en el texto:** inicia "Se reforma el primer párrafo, y se adiciona un segundo párrafo al Transitorio Décimo Primero…", incluye la renumeración "pasando los actuales segundo y tercer párrafos a ser tercero y cuarto" y cierra con marcadores de omisión `... ...`. No es el transitorio consolidado. **Observación menor:** a diferencia de las filas Tulum/CL (`notCompleteAppendix: true`), el registro SEGUNDO no lleva bandera de parcialidad machine-readable (`kind: 'provision'` genérico; sus condiciones son fechas/retroactividad). La parcialidad es evidente en el texto pero un consumidor que lea solo `conditions` no la vería. Sugerencia al autor, sin desarrollo por mi parte |
| Filas Tulum/CL no consolidadas | **Confirmado.** `kind: 'changed-table-row'` con `notCompleteAppendix` y `notStandaloneSubstantiveCertificateObligation`; los prefijos/sufijos muestran omisiones `...` del propio DOF (filas no modificadas omitidas en la fuente), no pérdida del candidato |
| Limpieza de anticipada | **Sin pérdida normativa.** Fragmentos eliminados: 3× nota al pie "Nota: El presente documento… regla 1.1.2." (mobiliario repetido por página), 3× "Página N de 3", y etiquetas marginales de versión (Primera/Segunda/Versión/Anticipada). Ningún fragmento normativo eliminado; la receta coincide con el script |
| Diff anticipada/final | **Recomputado desde los bloques crudos del JSON; operaciones idénticas a las almacenadas.** AVC: `typographyNormalizedEqual: true`, 0 operaciones (crudo desigual, declarado). MVE: `typographyNormalizedEqual: false` con exactamente 1 operación — un espacio antes del marcador de omisión tras "importación definitiva." (anticipada `". ......"`, final `.".......`). Coincidencia de fechas y palabras; no es diff de resolución íntegra, como declara el autor |
| Correspondencia de condiciones con final y avisos | **Consistente.** Registro AVC: boletín No. 3 (5 categorías, `noticeDate: 2026-11-20`, `notUniversalOperationalProof`) — verificado contra el boletín en mi revisión de condiciones §6. Los cinco tipos de condición de transitorios (`general-next-day-and-anticipadas`, `maritime-activation-unverified`, `avc-operations-announced-by-anam`, `doda-reference-only-in-applicable-avc-operations`, `estimated-vutce-calendar-new-vs-existing-proceedings`) coinciden con el texto literal del final y el registro operativo |
| Textos contra HTML original | Los 9 textos aparecen verbatim (normalización de espacios) en el HTML original tras strip crudo de etiquetas independiente del pipeline del autor |

## 3. Límites

- `legalSearchEnabled: false` es declaración del experimento, no barrera contra lectura directa del JSON (ya señalado por el autor).
- Los offsets son puntos de código Unicode del texto derivado, no bytes del HTML; la reproducibilidad depende de la receta de canonicalización declarada (verificada por hashes, no re-ejecutada por falta de bs4).
- Las pruebas comprueban mecánica y límites conocidos; ni este PASS ni el del autor autorizan adopción, vigencia ni búsqueda jurídica.

## 4. Veredicto

**PASS sustantivo como candidato aislado**, con una observación menor (bandera de parcialidad del SEGUNDO no machine-readable). Nueve textos íntegros contra el HTML original, sin pérdida ni absorpción de vecinos, limpieza de anticipada sin pérdida normativa, diffs reproducidos exactamente y condiciones consistentes con final y avisos. El corpus sigue en cuarentena.
