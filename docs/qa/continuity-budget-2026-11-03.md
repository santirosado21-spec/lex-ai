# Ejecución de continuidad con cuota reducida — 2026-11-03

Encargo del dueño: ejecutar el [plan dsystem](../orchestration/usage-plan-2026-11-03.md). Codex implementó y verificó; un ayudante local resumió documentación y Gemini aportó una crítica acotada. No hubo trabajadores adicionales.

## Corte y preservación

HEAD inicial `68eb716`; versión de código **0.4.8**. Se inventariaron **253 archivos previos**: 36 versionados modificados y 217 sin seguimiento. Se guardaron hashes, diff versionado, versiones previas de los archivos intervenidos, alcance explícito y parche aislado en [artifacts/continuity-budget/20261103T191744Z](../../artifacts/continuity-budget/20261103T191744Z/). Los autores del trabajo previo siguen sin verificar; no se reasignaron por conjetura ni se incorporó todo a un commit.

Se alinearon README, tablero y reparto dsystem con las instrucciones vigentes de AGENTS.md. El historial 0.4.3 permanece en el tablero. El plist instalado declara **0.4.8**, pero su router difiere del árbol corregido; el único DMG encontrado en la raíz de artifacts es **0.4.6**, de 2.189.000.727 bytes. No se instaló ni empaquetó esta corrección y no se ejecutó smoke nativo. Una versión coincidente no demuestra contenido coincidente.

## Corrección de continuidad

El router no reconocía ciertas peticiones breves como «El siguiente» o «El anterior», aunque el reescritor ya podía resolverlas a partir del mismo hilo. Además, si faltaba el índice derivado, la búsqueda de respaldo podía reutilizar el artículo de anclaje para una petición de navegación.

- `server/assistant-router.mjs`: reconoce navegación breve como seguimiento cuando el turno previo tiene fuentes. Las tareas explícitas conservan su prioridad; sin turno con fuentes no inventa una autoridad.
- `server/retrieval/query.mjs`: conserva el tipo de petición de navegación incluso si su anclaje no se puede resolver.
- `server/retrieval/automatic.mjs`: exige el índice derivado con hash coincidente para navegar; si falta, no coincide o la ruta no lo admite, devuelve cero fuentes en vez de repetir el artículo anterior. La búsqueda directa conserva su respaldo.
- `tests/continuity-navigation.test.mjs`: cuatro pruebas nuevas con artículos sintéticos, sufijo Bis, numeración dispersa, extremo sin vecino, contexto ausente/ambiguo, cambio expreso de ley y un recorrido real de servicio con inferencia simulada. La navegación sigue el vecino almacenado: no calcula n+1 ni demuestra continuidad de la publicación oficial.

El nuevo archivo de pruebas falla **4/4 contra los archivos originales** en una copia aislada y pasa **4/4 con la corrección**. Se conserva también la primera corrida, cuyo fixture tenía un texto demasiado corto; se corrigió el fixture sin relajar el validador. No se usaron las preguntas W1 para escribir estas pruebas.

## Verificación

| Comprobación ejecutada | Resultado |
|---|---|
| Pruebas dirigidas de router, recuperación, conversaciones e hilos | **37/37** |
| Suite completa final, después de corregir el fixture | **346/346**, cero fallos/omitidas |
| Build TypeScript/Vite | Correcto |
| Evaluación de recuperación actual W1 | 200 casos, cero errores, sin cambios de implementación durante la corrida; directas **60/60**, coloquiales **32/60**, seguimientos **25/40**, artículo global **117/160**, fragmento **81/160** |
| Dry-run RAFT de diez pasos solicitados | `DRY_RUN_VALIDATED_NOT_TRAINED`; cero pasos ejecutados, pesos no cargados, base intacta |

W1 ya fue observado y se usa como diagnóstico/regresión, no como evaluación final ciega. Su simulador mide recuperación, no respuesta jurídica real. La medición histórica W5 reportaba 33/60 coloquiales; esta corrida da 32/60 y conserva los fallos. La comparación contra los tres archivos originales en una copia aislada con el mismo índice dio **los mismos resultados antes y después**: 60/60 directas, 32/60 coloquiales, 25/40 seguimientos, 117/160 artículos y 81/160 fragmentos; ningún caso cambió sus comprobaciones de recuperación. La diferencia con el informe histórico no es efecto de este parche en esta comparación. Evidencia: `paired-retrieval-comparison.json`. La primera copia carecía del índice derivado opcional y midió el respaldo: esa comparación es inválida para atribuir cambios al parche y se conserva con su incidente. No se modificaron casos ni tesauro a partir de estos resultados.

Los logs, resultados por turno, hashes y controles de preservación están en el directorio de evidencia. No hay afirmación nueva de calidad jurídica, vigencia, inferencia real ni validación física de 8 GB.

## Entrenamiento preparado; pendiente de recursos

Se reutilizaron **5.000 ejemplos train y 200 valid**; el dry-run volvió a verificar base, manifiesto, exclusiones, tokenización y máscaras, con cero truncamiento y `baseFilesModified: []`. No se regeneraron los diálogos. La receta conserva rango 16, 24 bloques, base de cuatro bits y guardas originales.

El preflight midió **5,41 GiB** disponibles; durante la preparación se observaron **3,13 GiB** y al finalizar **5,85 GiB**. El mínimo de inicio es **10 GiB**. No había locks de entrenamiento en el preflight. **No se inició el piloto**, no se cargaron pesos ni se dejaron procesos esperando recursos. No se cerraron aplicaciones ni se bajó la guarda. El ayudante local también consume RAM: no debe ejecutarse en paralelo con un futuro piloto.

Dry-run guardado en [artifacts/raft/dry-run-continuity-20261103T191744Z](../../artifacts/raft/dry-run-continuity-20261103T191744Z/). Cuando haya memoria medida suficiente y no haya otro entrenamiento, el piloto autorizado puede usar una salida nueva:

```sh
.venv-training/bin/python scripts/qwen-training/raft_train.py --run --steps 10 --wall-seconds 300 --output artifacts/raft/pilot-continuity-YYYYMMDDTHHMMSSZ
```

Sustituir el sufijo por una fecha única; la receta rechaza salidas existentes y comprueba otra vez recursos. Diez pasos son un piloto técnico, no una mejora demostrada. Después hacen falta comparación con el base mediante inferencia real y una evaluación independiente antes de proponer promoción. El candidato predeterminado sigue intacto.

## Uso real de ayudantes y siguiente encargo

- Se consultó dsystem y se entregó su guía a los ayudantes sin acceso a archivos.
- El modelo pequeño ya instalado, elegido explícitamente mediante `LOCALLLM_MODEL`, resumió los documentos en **8 s**. Codex rechazó su confusión entre las cifras directas y coloquiales y verificó la fuente. No se cargó Gemma de 16 GB ni se descargó otra.
- Una llamada a `opinion` terminó con salida 0. Gemini señaló ambigüedad de anclas, turnos intermedios, extremos y listas frente a artículos. Se cubrieron anclas ambiguas, vecinos dispersos y extremos. Resolver referencias abiertas tras turnos intermedios o distinguir cualquier lista explicativa sigue fuera de este arreglo acotado.
- Para retomar: leer este corte y el tablero; elegir un módulo del inventario, usar una reproducción sintética mínima, ejecutar sus pruebas y mostrar sólo totales/errores. Conservar logs completos en disco. No volver a redactar RAFT ni releer todo el historial.

No hubo commit, push, descarga de modelos, entrenamiento, activación, envío de correo, despliegue ni cambio de instalación. La integración Git por módulos ajenos y el piloto con memoria suficiente siguen pendientes; no se presentan como completados.
