# S2a — Piloto pareado medido, sin selección de producto

Fecha local: 2026-11-09, America/Mexico_City. **Piloto terminado; S2 completo sigue abierto.** Bajo esta configuración no se demuestra una mejora general al añadir las skills S1 y no se promueve ningún modelo. [Resultados y recibos agregados](legal-task-skills-S2-2026-11-09.json), [protocolo V2](../architecture/legal-tasks/paired-evaluation-v2.md), [freeze V2](legal-task-skills-S2-freeze-v2-2026-11-09.json).

## Qué se ejecutó

Seis casos nuevos de autor Sol independiente: tres de investigación y tres de revisión contractual; dos modelos Groq explícitos (`openai/gpt-oss-20b`, `openai/gpt-oss-120b`), con/sin skill, una repetición: **24 generaciones V2**. Inputs, esquema, reglas mecánicas comunes, temperatura 0, máximo 2.500 tokens de salida y timeout 45 s iguales entre brazos; solo cambia la instrucción de la skill. No JSON nativo ni ajuste de reasoning-effort. Las skills y el contrato S1 permanecieron inalterados. Catálogo e identidad solicitada/observada coinciden en 24/24; sin retries, cambios de modelo o fallback pagado.

Dos pasajes oficiales cortos del CCF, artículos 1796/1797, se cotejaron con el PDF de C1a (página física 175, SHA-256 `4d4090f60137ce0d82bf321c24c962f698c407910fc94ebeb34b49d0a4236a76`). Resto de reglas/documentos ficticios; preguntas inventadas. No valida vigencia, cobertura nacional o asuntos reales ni promueve la cuarentena C1a. Las rúbricas nunca se enviaron a los candidatos.

V1 fue cancelado tras **seis generaciones** por un error de nuestra guía común: exigía rol conocido también en investigación, donde S1 exige `partyRole=null`. Sus seis respuestas no miden capacidad de modelos/skills y se excluyen de eficacia. Código, datos, freeze y replay quedaron preservados en `69ebff1`; [diagnóstico V1](legal-task-skills-S2-cancelled-v1-2026-11-09.json). V2 corrigió la misma regla para ambos brazos y usó seis casos nuevos sin reutilizar los expuestos. Total de sesión: **30 generaciones**, dentro del techo inicial de 32. No se afinó contra V2 después de observar respuestas.

## Resultados V2

Cada fila tiene seis respuestas y 24 criterios de contenido. “Contrato” exige salida S1 íntegra, incluidas citas exactas; “contenido” es revisión SF sobre criterios congelados, incluso texto parcial observable. No se reparó ninguna salida.

| Modelo | Skill | Contrato /6 | Criterios /24 | Todos los criterios /6 | Truncadas /6 | Tokens reportados | Latencia p50 / p95 |
|---|---|---:|---:|---:|---:|---:|---:|
| gpt-oss-20b | Con | 0 | 5 | 0 | 5 | 31.835 | 3.173 / 3.482 ms |
| gpt-oss-20b | Sin | 2 | 13 | 0 | 1 | 21.768 | 3.011 / 3.512 ms |
| gpt-oss-120b | Con | 1 | 7 | 1 | 5 | 32.044 | 5.520 / 6.747 ms |
| gpt-oss-120b | Sin | 2 | 4 | 0 | 3 | 22.024 | 4.725 / 5.677 ms |

Totales: JSON válido 10/24, contrato estricto **5/24**, 14 respuestas truncadas y diez sin contenido visible. Fallos estrictos: 14 `INCOMPLETE_RESPONSE` y cinco `Citation span mismatch`. Se intentaron los doce pares; ninguno tuvo ambos brazos válidos estructuralmente. Criterios satisfechos: 29/96. **Una respuesta pasó contrato y todos sus criterios**, pero incluyó una discusión no sustentada sobre condición suspensiva señalada por el revisor. El pase de una rúbrica incompleta no aprueba la respuesta entera ni su precisión jurídica.

Se observaron además atribuciones del CCF a la Constitución, consecuencias automáticas no contenidas en el pasaje, confusión entre preferencia comercial y regla ficticia, falta de hechos necesarios y abstenciones que omitieron lectura documental posible. Son resultados de este ensayo; no declarar incapacidad general del modelo. Con seis casos y una repetición no hay significación general; los p95 son descriptivos de seis observaciones por fila.

Las skills añadieron tokens y aquí coincidieron con más truncamientos. El límite de salida, razonamiento por defecto y el contrato de citas con posiciones son factores a estudiar; este experimento no aísla su causalidad. No elegir un ganador comparando solo fragmentos útiles o el único pase. El prompt completo máximo fue 12.588 UTF-16; este piloto SF separado **no amplía M1** ni sus límites de producto.

## Consumo y revisión

V2: 55.260 tokens de entrada + 52.411 de salida = **107.671 tokens reportados**, con 47.736 de razonamiento ya incluidos en la salida. No sumarlos otra vez. Duración con esperas: 727.099 ms; 48 solicitudes HTTP (24 catálogos y 24 generaciones). V1 consumió 20.163 tokens. Sesión total **127.834 tokens**: 15 generaciones/63.684 tokens en 20b y 15/64.150 en 120b. Atestación Free vigente para la credencial Groq existente; **cargo facturado desconocido**, no se auditó factura ni cuota restante. [Límites oficiales consultados](https://console.groq.com/docs/rate-limits); el ensayo no garantiza acceso de producto.

PSF: tres contextos asignados explícitamente a **gpt-6.1-sol**, autor, builder y revisor independiente; Codex coordinó e integró. Cero asignaciones Astra y cero consultas nuevas a Claude/Gemini/Kimi/Cursor/Perplexity. Tokens/cuota de estos contextos SF no expuestos; no confundirlos con el consumo API anterior. El revisor aprobó arnés con 26/26 pruebas y puntuó 24 opciones/96 criterios sin acceder al mapa modelo/brazo. Sus grados se congelaron antes de desvelarlo (SHA-256 `c8dd662bad83b87d21f1222b2475d187cdebfa9b12134afb3b714327556e9531`). Ocultar etiquetas no impide que el estilo sugiera la procedencia. Revisión jurídica profesional pendiente.

Builder: 44/44 dirigidas combinadas S1/S2; coordinador: **631/631 y build TypeScript/Vite OK**, antes del live. Replay offline valida cadena de starts/recibos, respuestas y reporte, sin red; conserva todos los fallos. Un test previo a que existiera el dataset V2 falló ENOENT y quedó superado al integrar los casos; no hubo llamadas live entonces. Sin dependencias nuevas o cambios al arranque/UI/proveedor de producto. Revisión final independiente Sol **APPROVE**: repitió replay offline y recalculó hashes, cuatro grupos, pase conjunto con reserva, tokens, latencias y separación del ZIP; no modificó grados ni hizo nuevas llamadas remotas.

## Evidencia y paquete profesional

Respuestas, cuerpos de solicitud sin credenciales, recibos y mapping permanecen en directorios locales ignorados:

- `artifacts/legal-task-skills-s2-20261109-pilot-v1/` y `artifacts/legal-task-skills-s2-20261109-pilot-v2/`.
- `artifacts/legal-task-skills-s2-access-v2-20261109/`: replay, logs técnicos y análisis desvelado.
- `artifacts/legal-task-skills-s2-blind-review-v2-20261109/`: seis casos, 24 opciones A–D, grados SF congelados y `review.html` para abogados. Entregar solo el ZIP `revision-cofounders.zip` o HTML + `LEER-PRIMERO.md`, sin grados/mapa, si se conserva cegamiento.

Visor estático derivado del renderer de skill-creator, con datos escapados y sin dependencias externas/servidor de feedback. Playwright comprobó navegación, descarga local de `feedback.json`, 24 estados de revisión, cero errores JS y cero solicitudes de red; screenshot inspeccionada. Feedback de esa prueba es sintético técnico, **no participación de abogados**. Comentario vacío distingue visita de ausencia de revisión y nunca aprobación. No se contactó a Lorenzo/Pedro ni se registró su validación.

Los archivos congelados permanecen iguales. [Retiro V1](../../eval/legal-tasks/s2/RETIREMENT.md) y [retiro V2](../../eval/legal-tasks/s2-v2/RETIREMENT.md) impiden reutilizarlos como aceptación fresca; pueden conservarse como regresiones históricas públicas.

## Siguiente corte S2b

Diseñar primero un experimento de desarrollo separado que compare JSON nativo, citas por anclas preindexadas y presupuesto de salida/razonamiento explícito, manteniendo pares y límites autorizados. No modificar S1 contra este examen. Después reservar aceptación nueva independiente y más amplia, con revisión de Lorenzo/Pedro; medir utilidad, inferencias sin respaldo, costes y latencias por tarea antes de seleccionar rutas/modelos de producto. Mantener errores observados y no confundir reparación de formato con calidad jurídica.

S2a cierra el piloto medido; S2/S2b, H4/H5/H6/H7, C1b/C2 y beta integrada conservan pendientes. Ningún documento de cliente, ruta de producto, biblioteca publicada, entrenamiento, despliegue o compra se activó.
