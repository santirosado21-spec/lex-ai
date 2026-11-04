# Escritorio 0.4.5 — un asistente, fuentes automáticas

Petición del dueño, 2 de noviembre de 2026: una sola experiencia conversacional, entrenamiento de Qwen con el corpus jurídico propio y análisis de Harvey/alternativas mexicanas mediante REA.

## Interfaz e integración

La app instalada en `/Applications/LEX AI.app` es 0.4.5. Se eliminó el selector Conversar/Con fuentes. El usuario escribe en un solo hilo; la habilidad predeterminada es Automática. El servidor selecciona conversación, consulta jurídica, análisis documental o solicitud de contexto. La selección automática actual usa reglas locales y contexto acotado del turno anterior; no se presenta como un planificador aprendido ni como un agente autónomo general.

El hilo combina respuestas conversacionales y fundamentadas del mismo ámbito. Las citas aparecen según la validación real. Las consultas de legislación pública funcionan sin asunto; el acceso a documentos privados exige un asunto autorizado, y exportación/feedback mantienen ese requisito. Si falta el documento, la jurisdicción o una fuente local disponible, se pide contexto antes de generar una conclusión sin evidencia.

Se corrigieron dos defectos detectados por revisión independiente: una Constitución local expresamente solicitada no activa el alias federal; los seguimientos mantienen el ámbito jurídico del turno anterior. Una búsqueda explícita de un código estatal no disponible solicita su fuente. Los controles de aprobación de acciones y aislamiento de documentos se conservan.

## Evidencia de software

- TypeScript/Vite y bundle Tauri: PASS.
- Suite Node final: 243/243 en `/private/tmp/lex-045-final-tests.log`; incluye pruebas CPU de preparación de entrenamiento, no se atribuyen a inferencia.
- Smoke unificado: presentación → artículo CCF → seguimiento, sin elegir modo; documentos del asunto, cancelación y borrador; 1440/768/390/320 px. Usa respuestas sintéticas explícitas y API real.
- Inferencia real separada con la base instalada: presentación → artículo CCF1797 → «Hazlo más breve»; conversación seguida de dos respuestas con citas aceptadas. Tiempos 4.052 / 3.463 / 4.401 ms. Resultado `artifacts/desktop-audit/unified-workflow-real.json`. No valida razonamiento jurídico.
- Verificador final del paquete PASS: hashes actuales, firma ad hoc, versión, biblioteca y arranque con almacén nuevo sin descarga de modelo. Resultado `artifacts/desktop-audit/package-045-final.json`.
- Ventana nativa observada después de instalar: habilidad Automática, un compositor, sin selector de modos y conversación general accesible. No se generó inferencia adicional durante el entrenamiento.
- Se conservó el primer paquete 0.4.5 como supersedido porque las correcciones de jurisdicción llegaron después de su preparación; su verificación detectó correctamente hashes de fuente distintos. No fue instalado ni publicado.

Instalador final `artifacts/LEX-AI-0.4.5-arm64.dmg`: **2.202.179.024 bytes**, SHA-256 `cb48782e18cd769a519531f280adbedf6c12ff51401d595d01810ecb3c4ec72e`. Incluye el candidato ligero base y motor privado. Firma ad hoc; no se afirma notarización ni prueba en otro Mac físico de 8 GB.

La instalación previa y una copia SQLite consistente están en `artifacts/desktop-update/before-0.4.5-20261103T004111Z/`, con acceso restringido al usuario. Se conservaron los datos de la app. No se publicó un nuevo release web.

## Entrenamiento y corrección del corpus

El entrenamiento es una entrega separada de la interfaz. **El modelo predeterminado de la app no se sustituyó por un candidato sin evaluar.**

El primer piloto y la primera continuación usaron por error `exports/corpus.jsonl`, la exportación bruta de 36.839 artículos. La documentación existente indicaba que ese bruto tenía fallos de extracción y había sido sustituido por `exports-v2`. La revisión principal detectó la selección incorrecta, se detuvieron únicamente los procesos de entrenamiento propios, se conservaron informes/checkpoints como supersedidos y se reinició la preparación desde la base congelada. Los resultados del bruto no acreditan un candidato entregable ni se reutilizan como pesos iniciales del entrenamiento corregido.

La fuente aprobada es `artifacts/legal-library/exports-v2/corpus.jsonl`: **35.452 artículos de 303 instrumentos**, SHA-256 `e97adb6bda336c1dac25c0369a6553977fae3993384bdb20c9acbeaf6f052c11`, con auditoría independiente 910/910 muestras. La auditoría es técnica por muestreo, no validación jurídica. La preparación corregida comprueba los hashes del corpus, manifiesto, auditoría y exclusiones; reserva leyes para evaluación y etiqueta las tareas sintéticas como redactadas por Codex, sin atribuir revisión humana inexistente.

El [informe de entrenamiento vigente](qwen-curated-training-2026-11-02.md) conserva fuentes, exclusiones, métricas y comandos de reproducción. El piloto depurado completó 500 pasos y aprobó 8/10 casos mecánicos estrictos; falló los dos casos de evidencia insuficiente. La continuación local recorre 137.173 pasos y ya produjo un checkpoint completo de 1.000 pasos; continúa separada de la app, con evaluación final automática y sin activación automática. El ajuste aprende principalmente copia contextual/formato y patrones conversacionales; una pérdida baja o una cita literal no acredita razonamiento jurídico.

## Investigación REA

[Harvey](../product/harvey-rea-2026-11-02.md) mostró su pantalla de acceso. La alternativa solicitada se ejecutó con [productos mexicanos y el recorrido público de IANM](../product/mexico-rea-2026-11-02.md). Los informes separan observación, afirmaciones comerciales e inferencias. No se incorporaron código, contenido editorial de competidores, documentos privados ni instrucciones propietarias al entrenamiento.

Participaron Codex principal, un trabajador de interfaz, uno de entrenamiento y otro de investigación mexicana. El principal integró y verificó la app, revisó datos y métricas y detectó el uso del corpus bruto. Se mantuvo la indisponibilidad de Claude ya registrada, sin repetir consultas de cuota.
