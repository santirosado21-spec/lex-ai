# Rejon: corte de revisión documental DOF

24 de noviembre de 2026

## Propósito

Vista de desarrollo aislada para consultar nueve fragmentos de la tercera resolución de modificaciones a las RGCE de 2026, publicada en el DOF el 23 de noviembre de 2026. No está activada en la biblioteca principal ni sustituye una norma consolidada. No responde consultas jurídicas ni certifica vigencia o aplicabilidad.

## Contenido y límites

Incluye la regla 3.1.43 sobre Aviso de Cruce, la modificación parcial del transitorio de manifestación de valor, cinco transitorios finales y dos filas modificadas del Anexo 22 (Tulum y clave CL).

Las condiciones deben acompañar siempre al texto:

- La modificación de manifestación de valor es parcial. Los párrafos no citados no se reconstruyeron. Las fechas anteriores a la publicación final requieren contexto de las versiones anticipadas, sin presumir retroactividad.
- El alcance operativo del AVC depende de las operaciones anunciadas por ANAM, las funciones habilitadas y las disposiciones aplicables. No se afirma funcionamiento universal.
- No se localizó evidencia suficiente del aviso de habilitación de los sistemas marítimos. Esto no prueba que el aviso no exista ni que los sistemas estén deshabilitados.
- La migración de Ventanilla Digital tiene calendario estimado. Deben distinguirse trámites nuevos y expedientes en curso.
- Las filas de anexo no son apéndices completos ni prueban por sí solas una obligación sustantiva de certificado.

## Integridad del corte

Se fijaron los bytes concretos verificados de forma independiente para el alcance exclusivo `nine-text-document-review-dev-only`:

| Artefacto | SHA-256 |
| --- | --- |
| Candidato de nueve textos | `893a70f67a3f85c04538882bb2edfc1dd7f05a95456d128d4bed49645942e015` |
| Captura HTML original | `d75b8279d1491c95473175300e04553c4ab954852407a8ba7888fa0af694fd38` |
| Índice SQLite | `305306c419b8ed7ae8495822374d0a04c68bf6bb34535679d46a70b76ecf40d9` |

La apertura comprueba esos hashes exactos. No regenera el índice, no aprende un hash nuevo ni admite otro hash de configuración. El contrato también exige condiciones y clases exactas por registro y rechaza campos adicionales o valores distintos.

El hash fijado es parte esencial de esta garantía: si alguien puede modificar código y sustituir también el hash esperado, no hay una garantía externa contra esa modificación. No es una certificación jurídica, firma del DOF ni aprobación para producción.

## Qué se comprobó

- El autor ejecutó TypeScript/Vite y el flujo React con backend real en Linux. Probó búsqueda AVC y manifestación de valor, clic en la captura original, vista móvil, limpieza del panel sin resultados y ausencia de excepciones de página.
- El autor obtuvo 30/30 pruebas: siete de integración y 23 existentes de biblioteca y barreras. El último cambio de pin añadió pruebas de rechazo de índice, candidato y captura alterados, incluyendo sustitución por un hash recalculado.
- Una revisión independiente reprodujo seis pruebas de integración, examinó una UI React aislada con dependencias restantes simuladas y verificó nueve registros/FTS e igualdad de hashes. No reprodujo el build completo ni las 30 pruebas ni el último cambio de fijación del pin.
- Una prueba anterior del prototipo portable en Mac obtuvo 5/5 y captura AVC en Chrome headless. No prueba la integración React actual en la app instalada.

## Pendiente

Prueba de este corte en Mac, WKWebView/Tauri y app instalada; accesibilidad completa y lector de pantalla; clic y destino de publicación DOF remota. No hay activación de biblioteca principal, despliegue ni aprobación de producción.

Las capturas que acompañen este documento deben identificarse por la versión que muestran. Una captura anterior a la fijación del pin no demuestra ese control interno.
