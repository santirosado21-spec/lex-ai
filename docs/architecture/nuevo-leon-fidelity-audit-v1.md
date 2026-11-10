# C2b — protocolo de cotejo offline de extracción de Nuevo León

2026-11-10. Propuesta implementada en `scripts/audit-nuevo-leon-fidelity.mjs`, con configuración fija `resources/nuevo-leon-fidelity-audit-v1.json` y pruebas sintéticas `tests/nuevo-leon-fidelity.test.mjs`. **La auditoría real no se ha ejecutado en esta entrega.** El coordinador debe revisar y congelar estos archivos antes de ejecutarla. Se aplicaron PSF y la skill PDF para lectura/verificación; no hay creación o edición de PDF ni marcador de autoría.

C2a conservó evidencia de las 619 páginas según PDF.js, con revisión independiente de integridad/reconstrucción. Esa cobertura no demostró fidelidad textual frente al PDF, integridad semántica de artículos, vigencia jurídica o permiso comercial. Este corte mide desacuerdos entre dos motores de extracción y prepara evidencia visual limitada; no decide qué motor tiene razón ni corrige las salidas. Los originales, perfil C2a, parser federal, registro nacional y cliente quedan intactos.

## Muestra cerrada antes del cotejo

Se fija la página física PDF, numerada desde uno; no se usa la numeración impresa. Por documento se toman ocho anclas distribuidas: `1 + floor(k*(N-1)/7 + 0.5)`, para `k=0..7`, y cuatro páginas de contexto/riesgo ya conocidas. La unión ordenada es la lista final de doce. No se cambia una página después de ver métricas, errores o resultados visuales; una página fallida permanece pendiente.

| Documento | Páginas físicas fijas | Contexto adicional predeclarado |
| --- | --- | --- |
| Civil, 396 páginas | 1, 2, 57, 114, 170, 227, 283, 340, 373, 374, 375, 396 | 2 y entorno 373–375 del inicio candidato de transitorios en 374 |
| Penal, 223 páginas | 1, 2, 26, 27, 28, 33, 64, 96, 128, 160, 191, 223 | 2 y entorno 26–28 del wrapping/referencia `ARTICULO96.` observado antes |

Las anclas distribuidas no constituyen una muestra aleatoria ni representativa estadísticamente. Las páginas de riesgo tienen selección deliberada y se informan como tales. Veinticuatro páginas de 619 no permiten extrapolar una tasa nacional, ni declarar fidelidad completa de estos dos documentos.

## Entradas congeladas y aislamiento

El ejecutor tiene ocho entradas de ruta y SHA-256 exactas: configuración, freeze C2a, informe C1b.3, informe C2a, dos PDF originales C1b.3 y dos JSON de evidencia C2a. Las constantes `PINS` y el recurso contienen los hashes; el recurso tiene además un digest fijado en código. Referencias principales:

- Informe C1b.3: `888972f9e20cfc17f573ed43b37d23ab3c00db4efc2b963ed7b1483478759246`.
- Informe C2a: `fcbcef8eb1e090e3ef2953bd694f07eaf7b8ec7cff5bb425445090f5cafff815`.
- Civil PDF: `a517709dd10664bbf7fc4ee77e32e4a0da7fdfbce45b662166dc706ead3c8af7`; evidencia JSON: `5cb4872ebf40dec7edf9447a037b2df500ffd903632429fdf8bc3c275a8ba216`.
- Penal PDF: `440f28ca7515f63c35e5e9034086e843e126bed75f6d07dfe1067537607c3d76`; evidencia JSON: `426311dc88b95d0a5d8dec78d66c0ec2b357ed30ff8659dc3c2ab8411cd5c343`.

Se verifican bytes, hashes, prefijo `%PDF-`, documento, hash PDF y número/hash de texto de cada página seleccionada antes de abrir procesos. Se conserva el vínculo al `pageSha256`, `documentEvidenceSha256` y SHA del JSON completo. El hash de evidencia de página sigue siendo un hash del objeto C2a, no bytes originales de una página PDF. No se vuelve a ejecutar PDF.js: se usa su evidencia congelada.

Se rechazan entradas/salidas no regulares, symlinks y rutas que escapan. La hoja de salida debe ser nueva y exclusiva bajo `artifacts/public-corpus`; no se sobrescribe un intento anterior. Los PDF se copian con bytes originales y modo de solo lectura. Se verifican otra vez todas las entradas, los PDF copiados y los ejecutables al finalizar, incluso en fallos parciales. Solo lectura no promete WORM frente al dueño del sistema. Los seams de fixture requieren ejecutor falso inyectado; la CLI no acepta rutas de entrada, páginas, herramientas, URLs o pins alternativos.

Las queries originales de captura permanecen literales en el recurso y el informe original. No se solicitan URLs ni se interpretan sus fechas como versión jurídica. No hay red, credenciales, OCR, modelos, proveedores, descarga o instalación. Solo se llaman ejecutables Poppler ya presentes. Una herramienta ausente/alterada bloquea; no se busca ni instala una alternativa.

## Procesos y límites

Los paths solicitados son `/opt/homebrew/bin/pdftotext`, `/opt/homebrew/bin/pdftoppm` y `/opt/homebrew/bin/pdfinfo`. Se resuelven para registrar el binario real dentro de `/opt/homebrew/`, con hash y tamaño; no se recibe una ruta arbitraria desde CLI. Se registran versiones mediante `-v`, Node/plataforma/arquitectura, argumentos, tiempos, códigos de salida y hashes/tamaños de stdout/stderr. No se vuelca el entorno privado. El entorno pasado explícitamente contiene solo `PATH=/usr/bin:/bin`, `LANG=C`, `LC_ALL=C`; macOS puede añadir su variable de codificación interna. No hay shell, stdin, proxy, cookies o autenticación.

| Recurso | Tope del lote |
| --- | --- |
| Documentos / páginas seleccionadas | 2 fijos / 24, sin sustitución |
| Comparaciones de texto | 48: modo default y layout por página |
| Versiones / renders opcionales | 3 / 6; máximo 57 procesos |
| Simultáneos / reintentos | 1 / 0 |
| Tiempo por proceso / lote | 15 s / 120 s; cada llamada usa también el tiempo restante del lote |
| stdout de texto por llamada / stderr | 1 MiB / 64 KiB |
| Texto persistido combinado | 4 MiB, contando versiones, PDF.js, Poppler y derivados normalizados |
| JSON combinado | 32 MiB; reserva de hasta 256 KiB para recibo final |
| PNG individual / combinado | 8 MiB / 32 MiB |
| Render | 96 dpi; cada dimensión positiva y ≤2.048 píxeles; no reescalado silencioso |
| Entrada individual / combinada | 32 MiB / 40 MiB |
| Binario de herramienta individual | 64 MiB |

Timeout o exceso de salida termina el grupo del proceso con SIGKILL y espera su cierre antes de continuar el cierre del lote. No se lanza otro proceso después de un fallo. Heap/RSS del sistema no se miden en este protocolo; los topes de bytes/tiempo no son una garantía de RAM máxima ni aceptación de un equipo físico de 8 GB. La comprobación final de integridad y persistencia del recibo pueden añadir tiempo acotado por archivos después del deadline; ningún nuevo proceso se inicia fuera de plazo.

Para cada página, los argumentos se construyen como arrays, sin interpolación en shell:

```text
pdftotext -f N -l N -enc UTF-8 -eol unix PDF_LOCAL_COPIADO -
pdftotext -f N -l N -enc UTF-8 -eol unix -layout PDF_LOCAL_COPIADO -
# Solo --render, en las seis páginas fijas:
pdftoppm -f N -l N -singlefile -r 96 -png PDF_LOCAL_COPIADO
```

`N` viene exclusivamente de la muestra congelada y `PDF_LOCAL_COPIADO` de las dos copias verificadas. La salida de `pdftoppm` va a stdout y se acepta solo con firma PNG/IHDR y dimensiones acotadas. Los bytes originales PNG se preservan; la inspección humana aún debe abrir y comprobar la imagen. No se inserta ni modifica el PDF.

## Artefactos y comparación

Una ejecución completa conserva dos copias PDF, ledger de entradas y tres recibos de versión. Por página guarda el texto PDF.js UTF-8, JSON de líneas/items/coordenadas/rangos C2a y, por cada modo Poppler, stdout UTF-8 literal, ambas vistas normalizadas y métricas con referencias de página/hashes. El informe contiene ledger SHA-256/tamaños de cada artefacto, recibos por proceso y denominadores/piezas pendientes. No se guardan textos corregidos, ni se edita evidencia anterior.

La decodificación es UTF-8 estricta, sin reemplazo silencioso de bytes inválidos. Se conservan BOM, NBSP, form-feed, finales de línea y cada carácter del stdout original. La vista `ascii-whitespace-v1` pliega únicamente U+0009..U+000D y U+0020 a un espacio, luego recorta ese espacio en extremos. No hay NFC/NFKC, case folding, eliminación de tildes, dehyphenation, corrección de números/puntuación, reordenamiento, exclusión de notas o descarte de encabezados/pies. La igualdad normalizada puede ocultar diferencias de whitespace; siempre se informa aparte de igualdad literal.

Las métricas son descriptivas, sin umbral de aprobación:

- Igualdad literal, bytes, SHA-256, longitud en escalares Unicode y cantidad de U+FFFD por motor; hashes/bytes/escalares de las vistas normalizadas.
- Intersección multiconjunto de tokens separados solo por espacios ASCII después del plegado. Precisión direccional observada PDF.js = intersección/tokens PDF.js; recall del comparador Poppler = intersección/tokens Poppler. Denominador cero devuelve `null`. **Poppler no es verdad de referencia.**
- Igualdad de la secuencia de tokens e índice del primer token desigual; coincidencias de caracteres normalizados en la misma posición con denominador explícito. Una bolsa de tokens idéntica no demuestra orden de lectura.
- Prefijo/sufijo literal común y primera diferencia con índice de escalar Unicode, offsets UTF-8 independientes y número de línea por motor; ventanas acotadas de 80 escalares anteriores/160 desde la diferencia. Son un localizador, no todas las diferencias. Los archivos completos preservados permiten reproducir todo el desacuerdo. Los offsets C2a en UTF-16 se etiquetan por separado; no se mezclan con estos offsets.

No se produce distancia semántica, exactitud legal, porcentaje de artículos completos ni un `fidelityPass`. La comparación entre motores comparte el mismo PDF y posibles errores comunes; ni coincidencia exacta ni un token score alto sustituyen revisión independiente del contenido visual.

## Plan visual fijo y revisión humana posterior

Sin `--render` las seis páginas quedan `pending-not-rendered`. Con la opción explícita se renderizan **Civil 1, 374, 396 y Penal 26, 27, 223**, sin escoger páginas según las métricas. Los seis renders permanecen `review=pending`, sin aprobación automática. Otros desacuerdos pueden proponer una muestra v2 separada; no se cambia retrospectivamente esta.

El revisor abre cada PNG completo, verifica página física/origen y legibilidad, y contrasta título/header, primera y última línea del cuerpo, párrafos centrales, notas/editoriales y secuencia de lectura con ambos textos literales. En Penal 26–27 registra específicamente referencia terminal `ARTICULO96.` frente a encabezados `.-`; en Civil 374, el límite candidato de transitorios. No decide aplicabilidad/vigencia. Debe señalar omisiones, duplicaciones, joins/splits, alteración de signos/números, ligaduras/acentos, orden o clipping; `not-observed-in-sample` no equivale a ausencia global.

Cada observación posterior debe tener documento/página física, SHA PDF y PNG, dimensiones, revisor/fecha, literal de cada motor, referencias a sus líneas/rangos y rectángulo entero `[x,y,width,height]` dentro de la imagen, origen superior izquierdo. Las coordenadas PDF.js son evidencia aparte; **no se transforman directamente a píxeles sin conocer viewport/crop/rotación**, y este corte no dibuja overlays ni afirma correspondencia geométrica automática. Si la imagen no permite leer algo, queda `unreadable/pending`; no se adivina. Las observaciones se escriben en un artefacto de revisión nuevo, sin modificar el informe congelado del ejecutor.

La ejecución técnica, comparación léxica, inspección visual, evaluación semántica y aprobación jurídica son estados separados. Revisión jurídica y de derechos, vigencia, fidelidad completa, publicación, indexación y entrenamiento permanecen pendientes o `false` en todos los casos. El corpus no se promueve por este trabajo.

## Comandos y criterios para congelar/ejecutar

```sh
# Disponibles ahora: sin leer capturas ni ejecutar Poppler/auditoría.
node scripts/audit-nuevo-leon-fidelity.mjs --plan
node --test tests/nuevo-leon-fidelity.test.mjs

# Solo coordinador, después de revisión independiente y freeze de código/recurso/protocolo:
node scripts/audit-nuevo-leon-fidelity.mjs --audit --out-name nl-fidelity-revision-01
# Alternativa explícita con los mismos 24 cotejos y seis PNG fijos; hoja distinta/exclusiva:
node scripts/audit-nuevo-leon-fidelity.mjs --audit --out-name nl-fidelity-visual-revision-01 --render
```

No ejecutar ambas alternativas por rutina. Para evitar repetir las 48 extracciones, el coordinador puede decidir desde el freeze ejecutar una vez con `--render`. Si eligió la variante textual, los renders posteriores requieren un corte autorizado aparte; este ejecutor no reanuda ni escribe dentro de una hoja existente.

Las pruebas usan PDF/JSON sintéticos, ejecutor falso y pins de fixture. Cubren Unicode/offsets, orden, numeración física, hashes/prefijo/rutas, no sobrescritura, fallo de proceso/timeout/salida vacía/UTF-8 inválido, límites, recibos, deriva final y renders inyectados. Solo el helper de timeout/salida se comprueba con un proceso Node mínimo; no se invoca Poppler sobre un PDF real en pruebas. Las primeras fixtures corrigieron una ruta temporal macOS que pasa por `/var` symlink y la variable de codificación añadida por el sistema; no se relajaron guardas de entradas reales.

Un fallo preserva artefactos completos previos, deja estado `partial-quarantine`, categoría finita y pendientes explícitos de **48 comparaciones/24 páginas/6 renders**. No se eliminan páginas difíciles del denominador ni se reintenta/cambia motor/normalización. Una discrepancia es un resultado de la auditoría, no un error a reparar en este corte. Una ejecución `complete-quarantine` solo acredita que se produjo la evidencia planeada bajo estos límites; todos los flags de aprobación permanecen falsos.
