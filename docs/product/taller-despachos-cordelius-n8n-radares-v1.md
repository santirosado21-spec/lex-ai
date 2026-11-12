# Taller Rejon.AI: herramientas herméticas, radares y automatizaciones con n8n

**Propuesta de Pedro (ideas de Córdelius) · 11 de noviembre de 2026, CDMX.**  
**Estado:** diseño por aprobar, sin conexiones, tareas programadas, rutas de escritura o datos reales.  
**Coordinación:** Pedro propone; Santi y Lorenzo evalúan prioridades, implementación y riesgos. Los roles no implican que ya hayan aprobado esta arquitectura.

## 1. Ambición del producto

Rejon.AI debe ser un **sistema operativo jurídico configurable**. En lugar de un catálogo cerrado o un chat genérico, un despacho puede abrir el **Taller** y crear una composición propia: elegir su especialidad, instalar herramientas del catálogo, definir flujos de trabajo, conectarlas a radares públicos y reordenar el panel según sus necesidades. Un despacho inmobiliario puede necesitar contratos, arrendamientos, inmuebles y vencimientos; uno litigante, escritos, pruebas y criterios judiciales; otro regulatorio, DOF, permisos, gacetas y cambios normativos. Se empieza con paquetes comunes que se combinan, no con una aplicación desarrollada desde cero para cada cliente.

La inspiración funcional proviene de Córdelius: **Hoy, Mesa, radares, n8n, catálogo de módulos, por aprobar, Doctor, memoria con procedencia y un mapa de conocimiento opcional**. No se copiará código, datos, estilos o activos protegidos de Córdelius sin autorización y revisión expresa. La marca de esta aplicación es **Rejon.AI**.

## 2. Arquitectura por capas

```text
TALLER REJON.AI (configuración visible; prototipo sin datos privados)
    |
    +-- Catálogo firmado/versionado de herramientas y plantillas
    |     +-- Radares públicos (n8n autorizado para observación pública)
    |     +-- Herramientas herméticas locales (sin red ni ejecución arbitraria)
    |     +-- Herramientas asistidas (habilitadas sólo después de H4/H5/H6)
    |     +-- Integraciones del despacho (siempre bajo autorización delimitada)
    |
    +-- Composición por despacho (manifiesto v1: módulos, orden y política)
    |     +-- Vistas: Hoy, Expedientes, Investigación, Escritos, Por aprobar
    |     +-- Recetas por área y rol; borradores versionados / rollback
    |
    +-- Frontera de privacidad / autorización (FUERA del modelo y de n8n)
          +-- Identidad y ACL despacho/asunto (H5)
          +-- Protección local del sobre completo antes de egress (H4)
          +-- Fuentes, vigencia y trazabilidad
          +-- Puerta de ejecución humana y registros auditables
```

**Regla fundamental:** n8n inicialmente solo ve datos jurídicos **públicos**, no originales, nombres de clientes, números de expediente, consultas sensibles, mapas de seudonimización ni credenciales del despacho. La coincidencia entre un radar público y asuntos del despacho ocurre localmente tras controles de acceso y cifrado. Un n8n autoalojado **no prueba por sí solo** privacidad; es un sistema externo a la bóveda y tiene logs, credenciales, webhooks y capacidades de ejecución que se deben limitar.

## 3. Taller: aplicación configuradora que piden los despachos

### Experiencia

1. **Crear perfil de despacho**: tipo (litigio, corporativo, inmobiliario, laboral, fiscal, regulatorio, familiar, mixto), jurisdicciones y objetivos. En el prototipo, sólo perfiles sintéticos y sin guardar información real en almacenamiento no cifrado.
2. **Elegir una plantilla**: Litigio/contencioso; Contratos y arrendamientos; Corporativo; Comercio exterior y regulación; Oficina general.
3. **Explorar herramientas especializadas**: filtro por área, función, estado de privacidad y dependencia. Cada módulo lleva ficha: objetivo, entradas/salidas, fuente legal, vigencia, versión, capacidades, límites, tests y dueño.
4. **Agregar y ordenar**: configuración declarativa del escritorio, sin ejecutar nada; mostrar conflictos de dependencias y estados «simulación», «por validar», «disponible».
5. **Definir recetas**: ejemplo: Radar DOF → cambio detectado → contraste de fuente → coincidencia local (solo cuando H4/H5 sean válidos) → borrador → «Por aprobar» → tarea después de autorización.
6. **Previsualizar**: un «Hoy jurídico» y un panel del despacho con datos ficticios.
7. **Exportar propuesta**: manifiesto JSON de configuración, versión, orden y política, **sin claves ni datos de asuntos**; importación validada en una fase siguiente. Guardar realmente requiere bóveda y control de cambios por despacho.
8. **Publicar**: queda bloqueado en fase piloto hasta pasar revisión técnica y jurídica. Configurar nunca autoriza ejecutar acciones externas ni consumir modelos.

### Manifiesto versionado sugerido

```json
{
  "schemaVersion": 1,
  "kind": "rejon.workshop.blueprint",
  "templateId": "litigio",
  "modules": ["radar.sjf", "tool.compare-law", "tool.evidence-matrix", "workbench.approvals"],
  "layout": ["workbench.approvals", "radar.sjf", "tool.compare-law", "tool.evidence-matrix"],
  "mode": "simulation",
  "privacy": "public-or-synthetic-only",
  "integrationsEnabled": false
}
```

Sin secretos, clientes, rutas locales, endpoints de webhooks ni estructuras reutilizables con ID de asunto. **Las versiones de módulos se deben fijar en una fase posterior** antes de activar perfiles. Se evita ejecutar JSON importado como código, SQL, n8n workflow o instrucción de agente.

## 4. Qué es una herramienta hermética

Una **herramienta hermética** es un componente de propósito preciso cuya entrada, salida y permisos están definidos. No recibe libertad general para abrir archivos, ejecutar comandos o visitar servidores; el kernel de autorización, no el texto del modelo, decide sus capacidades.

**Ficha de módulo (contrato futuro):** identificador único, versión, dominio, `inputSchema` y `outputSchema` cerrados, alcance `public | synthetic | private-local`, efecto `read | propose | write`, permisos explícitos, dependencias fijadas, límite de tiempo/memoria, fuente y vigencia, presupuesto, test sintético, estrategia de rollback, responsable y estado.

**Prototipo v1:** solo catálogo y composición. No se cargan plugins arbitrarios, no hay `eval`, shell, `child_process`, HTTP dinámico, SQL a elección del agente ni IPC sensible. El runtime hermético con sandbox real, firmado/verified y límites OS es un trabajo distinto posterior. Que un módulo declare `hermetic: true` no demuestra que esté aislado.

**Fallo cerrado:** manifiesto inválido, módulo no registrado, dependencia ausente, versión inesperada, cruce de despacho, dato no público o permiso no concedido → no ejecutar. Las herramientas de escritura permanecen «propuesta» hasta revisión y confirmación humana.

## 5. Catálogo inicial: llenar Rejon.AI de herramientas útiles

| Familia | Herramienta / radar | Resultado visible para el abogado | Fase segura inicial |
|---|---|---|---|
| Fuentes oficiales | **Radar DOF** de nuevas disposiciones y reformas | Cambio, fuente y fecha; comparación manual | Público, observación |
| Judicial | **Radar SJF/SCJN** de tesis y jurisprudencia | Criterio relevante + materia + vínculo oficial | Público, observación |
| Local | **Radar Gaceta CDMX**; gacetas estatales por etapas | Publicación nueva y área afectada | Público, observación |
| Legislativo | Seguimiento de iniciativas, decretos y reformas | Estado del proyecto, **no tratar iniciativa como norma vigente** | Público, observación |
| Administrativo/regulatorio | Alertas de acuerdos, reglas y autoridades sectoriales | Cambios con versiones y autoridad emisora | Público, observación |
| Comercio exterior | Fracciones arancelarias, SENASICA, SE, aduanas | Checklist de documentos y fuentes, no dictamen definitivo | Herramienta sintética |
| Litigio | Matriz de hechos, pretensiones, pruebas y contradicciones | Tabla trazable a anexos/folios | Sintético; local tras gates |
| Litigio | Constructor de cronología + vencimientos | Eventos con fuente y fecha a confirmar | Sintético; no inventar plazos |
| Litigio | Comparador de demanda / contestación / pericial | Diferencias y argumentos enfrentados | Sintético; local tras gates |
| Investigación | Buscador por artículo/fracción, precedentes y criterio | Respuesta con versión, citas y límites | Fuente pública; legalAccuracy no evaluada |
| Escritos | Constructor de contratos, demandas, promociones y recursos | Borrador revisable y exportable, nunca presentación | Sintético |
| Contratos | Comparador de cláusulas, obligaciones, penalidades y riesgos | Diffs y lista de riesgos con fundamento | Sintético |
| Inmobiliario | Administrador de locales, superficies, rentas y garantías | Plantilla parametrizada + inventario de medidas | Sintético |
| Corporativo | Actas, poderes, sociedades y obligaciones periódicas | Paquete documental y checklist | Sintético |
| Laboral | Alertas de plazos y obligaciones laborales | Agenda de revisión con fuente | Sintético |
| Fiscal | Calendario y radar de reglas, sin presentaciones automáticas | Cambios y pendientes a revisar | Público, observación |
| Derechos humanos | Matriz hechos→derechos→test→jurisprudencia | Análisis estructurado con citas | Sintético |
| Operación | Horas, cotizaciones, facturación y tareas | Panel del despacho | Lectura/gestión local con permisos |
| Auditoría | Doctor: última sincronización pública, integridad, copia/restore | Estado real por subsistema; «Sin dato» si no hay evidencia | Sintético |

**Jurisdicciones:** empezar con fuentes federales y CDMX identificadas/permitidas, sin prometer cobertura nacional, vigencia ni horarios de actualización. Acceso a expedientes judiciales autenticados, boletines restringidos o portales con captcha no se automatiza sin evaluación jurídica, autorización y API oficial.

## 6. Recetas n8n, propuestas **sin activar**

| Receta | Disparador público | Pasos | Límite |
|---|---|---|---|
| Reforma detectada | Nueva entrada DOF admitida | Normalizar → hash y deduplicar → guardar fuente pública → proponer ficha de cambio | No concluir aplicabilidad ni modificar expedientes |
| Nuevo criterio | Consulta permitida del SJF | Distinguir tesis/jurisprudencia/contradicción → fecha → contraste humano → radar | No afirmar obligatoriedad sin análisis competente |
| Gaceta local | Publicación estatal nueva | Extraer versión → clasificar materia → preparar alerta pública | No cargar documentos privados a n8n |
| Calidad del corpus | Documento público admitido | Revisar URL, licencia, metadatos, paginación, texto, versiones → cuarentena o cola de revisión | Nunca promocionar a fuente aprobada solo por IA |
| Digest diario | Eventos públicos verificados | Resumen «Qué cambió» con enlaces y «Sin dato» | Sin notificaciones externas sin opt-in |

**Semántica de eventos (futura):** `eventId` determinista, `radarId`, `sourceUrl`, `publishedAt`, `observedAt`, `sourceDigest`, `status:unverified|verified|quarantined`, `version`, `evidence[]`. No incluir identificadores internos de asuntos, usuarios o clientes. Distinguir «fuente falló» de «sin novedades». Deduplicación por fuente+digest, cursor estable, reintentos acotados, límites de frecuencia/costo, reloj claro, pausa, DLQ, historial y supervisión.

**Hardening futuro:** n8n dispone de nodos con riesgos de ejecutar código/leer archivos, webhooks y almacenamiento de ejecuciones; bloquear nodos peligrosos, restringir red/egress, usar cuentas de bajo privilegio, validar firmas/cabeceras de webhooks, no guardar payloads sensibles, revisiones/auditorías periódicas, entornos separados y permisos por workflow. Nada de instalar flujos o entregar credenciales por esta PR. Referencias técnicas a revisar antes de implementar:
- https://docs.n8n.io/hosting/securing/security-audit/
- https://docs.n8n.io/workflows/executions/all-executions/
- https://docs.n8n.io/workflows/sharing/

## 7. «Mesa» y «Por aprobar»: cooperación visible

El despacho puede configurar roles especializados **como vistas de trabajo**: investigador de fuentes, abogado redactor, revisor de citas, analista de pruebas, auditor de privacidad, coordinador de plazos. Un rol no equivale necesariamente a un modelo distinto, y no obliga a usar una API remota.

**Estados:** `observado` → `borrador` → `en revisión` → `aprobado` o `descartado` → `ejecutado` solo por servicio autorizado. Todo paso señala fuente, revisión, usuario/alcance y fecha. Registrar un clic de «aprobar» en el prototipo **nunca** ejecuta la acción subyacente.

**Caso demostrativo ficticio:** despacho litigante crea plantilla; incorpora Radar SJF, comparador normativo, matriz probatoria y cola de aprobaciones; configura orden; observa evento público ficticio; recibe propuesta de revisar asunto ficticio sin acceso real; exporta su blueprint para conversación con los cofundadores.

## 8. Fases y aceptación sin saltarse Rejon.AI vigente

- **T0 · Diseño y registro (ahora):** catálogo público/sintético, esquemas validados, configurador visual sin persistencia de asuntos, exportación JSON segura, pruebas de malformed manifests/duplicados/dependencias, CI portable; una PR independiente.
- **T1 · Radares públicos (después de revisar fuentes):** adaptadores públicos individuales, ensayos de frecuencia/errores/reintentos, observaciones con fecha y enlace; n8n limitado a prueba sintética o datos públicos verificados.
- **T2 · Composición local por despacho:** **solo después de H4/H5/F0**; ACL reales, bóveda, cifrado, versiones, recuperación y 8 GB medidos.
- **T3 · Agentes y tareas privadas:** después de H4/H5/H6 y revisión independiente; autorización humana/egress del sobre completo, reversión, budgets.
- **T4 · Distribución de plantillas:** firma, revisiones, compatibilidad, provenance y permisos; sin instalar código tercero automáticamente.

**Aceptación T0:** (a) 12+ herramientas sintéticas/públicas con estado correcto, (b) al menos 3 plantillas de despacho, (c) agregar, quitar, mover módulos con dependencias validadas, (d) exportar blueprint sin información privada, (e) ningún endpoint/red ni efecto de escritura, (f) pruebas de manifiestos inválidos, (g) UI accesible con movimiento reducido, (h) documentación y revisión distinta del autor. «T0 aprobado» no implica bóveda, n8n ni hermeticidad de sistema operativo ya operativos.

## 9. Decisiones que se piden al despacho

1. Tipo de despacho y herramientas concretas que necesita el primer piloto.
2. Si los módulos se ven por **asunto, por área, por persona o por equipo**.
3. Qué acciones pueden proponerse automáticamente y cuáles requieren doble revisión.
4. Jurisdicciones/fuentes permitidas y cadencia de radares; políticas de privacidad de cada fuente.
5. Priorizar las primeras tres recetas antes de instalar cualquier flujo n8n.
6. Definir presupuesto de notificaciones/modelos y dueños de operación sin habilitarlos aún.

**Decisión de producto sugerida por ChatGPT, pendiente de Pedro:** el Taller no es un menú de plugins arbitrarios. Debe funcionar como un **constructor de despachos por bloques verificables** donde un catálogo común se personaliza bajo política y revisión, con una vista de «lo que viene» para herramientas aún no listas.
