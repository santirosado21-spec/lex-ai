# Investigación de producto: Harvey y agentes jurídicos similares (2 nov 2026)

## Alcance y límites
Solo información **pública** (páginas del fabricante, centro de ayuda y comparativas de terceros) obtenida por búsqueda web. **No** se descompiló, interceptó ni accedió a ningún producto de terceros, y no se copió código, prompts, textos ni assets. Las herramientas REA del entorno exigen adjuntarse a un Chrome con depuración abierta sobre una página concreta; no se usaron contra Harvey: analizar el paquete propietario de un competidor no es necesario para aprender su estructura de producto y plantea riesgos de términos de uso. Varias fuentes son comparativas de competidores y de directorios: tratarlas como direccionales, no verificadas.

## Qué dicen las fuentes públicas
- **Harvey** se organiza en cuatro productos: *Assistant* (redacción, resumen y preguntas con enlace de cada respuesta a las fuentes usadas), *Vault* (espacio de documentos por proyecto, preguntas dirigidas y resumen masivo), *Knowledge* (investigación con fuentes jurídicas/regulatorias de terceros) y *Workflows* (rutinas prediseñadas o a medida, incluidas tablas de revisión de conjuntos de documentos). Su ayuda indica que no tiene internet en tiempo real: depende de documentos subidos o fuentes de conocimiento.
- **Legora**: «revisión tabular» (cuadrícula de contratos con columnas extraídas por IA), complemento de Word con *playbooks*.
- **CoCounsel**: ligado a contenido de Westlaw/Practical Law; *playbooks* contra políticas internas; se reporta alguna cita incorrecta.
- Patrón común: **respuesta ligada a fuente**, **espacio documental por asunto**, **flujos repetibles (playbooks)** y **revisión tabular masiva**. Todas las fuentes recomiendan verificar siempre las citas.

## Lo que ya tiene LEX AI frente a ese patrón
| Patrón del mercado | LEX AI hoy |
|---|---|
| Respuesta con fuente | Respuestas con cita y pasaje; compuerta de validación de citas |
| Espacio por asunto | Asuntos locales aislados por despacho/asunto |
| Knowledge | Biblioteca oficial federal (corpus 30/10/2026), local |
| Flujos / playbooks | Habilidades jurídicas + Checklist por asunto |
| Revisión de cambios | Comparador de versiones con redline DOCX |
| Privacidad | Todo local; nada sale del equipo (diferenciador real) |

## Brechas candidatas (para priorizar, no compromisos)
1. **Revisión tabular local**: extraer campos (partes, fechas, importes, cláusulas) de varios documentos de un asunto en una tabla con enlace al pasaje. Determinista primero; el modelo ligero solo con verificación.
2. **Playbooks editables por despacho** (reglas de revisión de contratos) sobre el checklist actual.
3. **Resumen masivo** de un asunto con límites honestos y citas.
No copiar interfaces ni textos de terceros; el diseño propio está en `docs/brand/redesign-brief-2026-11-02.md`.

## Entrenamiento
La investigación de competidores no aporta datos de entrenamiento (sus modelos y datos son propietarios y no se usan). El entrenamiento sigue únicamente con fuentes públicas y tareas sintéticas con procedencia, según AGENTS.md.

Fuentes consultadas: help.harvey.ai («Getting Started with Harvey»), páginas de producto de harvey.ai, directorios y comparativas públicas (gc.ai, spellbook.com, aitoolsatlas.ai, bindlegal.com).
