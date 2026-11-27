# Ideas de Pedro: aprendizajes de Córdelius aplicables a Rejon.AI

**Fecha:** 2026-11-11 (CDMX). **Proponente:** Pedro; redacción inicial con ChatGPT.  
**Estado:** propuesta para discusión con Pedro, Santi y Lorenzo; **no aprobada, implementada ni priorizada definitivamente**.  
**Ámbito:** inspiración de producto/experiencia; **no** migración de código, archivos, prompts internos, assets, credenciales ni licencias de Córdelius. Toda reutilización concreta requiere autorización y revisión de derechos y seguridad.

## Tesis

Rejon.AI no debería limitarse a una ventana de chat jurídico: puede ser un **espacio de trabajo proactivo, verificable y controlado por el abogado**. Córdelius aporta patrones de experiencia para coordinar información, distinguir datos de sugerencias y transformar trabajo disperso en decisiones con trazabilidad. Rejon.AI mantiene su enfoque jurídico local-first y las barreras H4/H5/H6/H7 existentes.

## Propuestas de experiencia (orden sugerido)

| Concepto inspirado por Córdelius | Adaptación al despacho | Primera versión medible | Control obligatorio |
| --- | --- | --- | --- |
| **1. «Hoy jurídico»** | Inicio con próximos vencimientos, audiencias, tareas y cambios desde ayer; «Hoy en 60 segundos» opcional | Datos sintéticos y lista de asuntos accesibles; mostrar `Sin dato` sin inventar fechas | Toda fecha debe tener fuente, zona horaria, momento de consulta y responsable; sin recordatorios generados sin consentimiento |
| **2. Mesa de agentes especializados** | Una solicitud se distribuye *en borrador* a investigación, redacción, citas/pruebas y revisión; cada rol devuelve propuesta atribuida | Orquestación simulada con tarjetas «quién propone qué» y un paso explícito de revisión humana | Nada se presenta, envía, firma, publica, compra ni incorpora al expediente sin autorización; sin herramientas de ejecución arbitraria |
| **3. Memoria de asuntos con procedencia** | Resumen vivo de hechos, cronología, documentos, pendientes, versiones y decisiones; memoria aislada por despacho/asunto | Tarjetas que enlazan cada afirmación a documento/versión/página o anotación aprobada | Sin inferir hechos como verificados, sin cruces de despacho; cambios auditables, editables y reversibles |
| **4. «Por aprobar»** | Bandeja de propuestas generadas por agentes: texto, cambios de estrategia, tareas, borradores y alertas | Estado `propuesto / revisado / aprobado / descartado`, diffs y motivo | El modelo propone; las acciones requieren autorización humana con alcance y registro, nunca aprobación implícita |
| **5. Doctor del expediente** | Salud técnica y documental: integridad local, última copia verificada, restauración probada, fuentes sin vigencia comprobada, trabajos fallidos | Panel de estado de datos sintéticos: fuente, hora, último resultado y acción de diagnóstico | No etiquetar «respaldo seguro» sin prueba real exportar→restaurar; no exponer metadatos privados a telemetría |
| **6. Galaxia / mapa visual de conocimiento** | Navegación opcional entre asuntos, personas, documentos, hechos y artículos relacionados | Solo grafo sintético exploratorio con lista y búsqueda equivalentes | Enlaces basados en referencias verificables, permisos en cada nodo; nunca mostrar relaciones sensibles a usuarios no autorizados |

## Cómo aterrizarlo en el plan vigente sin bloquear seguridad

**Corte A — diseño público/sintético, habilitado ahora:** maqueta sencilla de «Hoy jurídico», bandeja «Por aprobar» y «Memoria con fuentes», más demostración accesible de un asunto ficticio. No hay integración con originales, motores cloud ni bóveda. Medir claridad con dos abogados; no afirmar aceptación jurídica.

**Corte B — funciones locales mínimas, DESPUÉS de los gates correspondientes:** tras F0 y controles H4/H5 validados, leer solo asuntos con permiso, actualizar memoria mediante confirmación humana y visualizar estado técnico real desde componentes existentes. El prototipo no puede saltarse cifrado, recuperación o aislamiento.

**Corte C — Mesa multimodelo, DESPUÉS de H4/H5/H6 y validación:** router por tarea con políticas locales y rutas explícitas, sin confundir «pensamiento del agente» con fuente. Toda solicitud remota: proteger datos originales localmente, comprobar sobre completo (pregunta, historial, adjuntos, nombres, metadatos, herramientas) y mostrar origen/destino aprobado antes de enviar. Preservar `legalAccuracy: not-evaluated` cuando aplique.

**Corte D — grafo visual y acciones avanzadas, DESPUÉS del flujo base:** conectar únicamente relaciones soportadas por documentos o decisiones del abogado, con modo accesible de lista; notificaciones solo bajo autorización específica. Ninguna presentación judicial o envío automatizado en esta propuesta.

## Recorrido de demostración ficticia

1. El abogado abre Rejon.AI: «Hoy» muestra **1 plazo ficticio por verificar** (fuente y hora) y **2 borradores por aprobar**. No dice que haya una audiencia real.
2. Abre el asunto sintético «Caso Demo A». La memoria muestra tres hechos **con enlace a documentos sintéticos** y una hipótesis claramente etiquetada «Sin verificar».
3. La Mesa prepara tareas separadas de investigación pública y revisión de citas, pero no ejecuta herramientas externas ni comparte la información privada sintética sin un control de salida.
4. El abogado revisa las propuestas y decide cuáles guardar. El historial identifica quién propuso cada cambio, fuente, versión y quién autorizó.
5. El Doctor muestra «restauración no probada» si no existe evidencia técnica, en lugar de una luz verde inventada.

## Reglas de producto no negociables

- El abogado tiene el control; **proactividad para observar y sugerir**, no para ejecutar consecuencias jurídicas.
- «Dato comprobado», «inferencia» y «acción propuesta» son estados distintos y visibles; sin fuente/hora, mostrar `Sin dato`.
- Cualquier estado compartido o memoria queda aislado por despacho/asunto y protegido según H4/H5. No copiar la memoria, el buzón, las notas, ni bases privadas de Córdelius.
- No utilizar datos de clientes, expedientes reales, claves, presupuesto de proveedores ni instaladores en esta propuesta.
- Los documentos legales exigen vigencia, procedencia y revisión profesional; gráficos vistosos no equivalen a veracidad ni calidad.
- UI ligera para equipos de 8 GB, reducción de movimiento y navegación accesible por teclado; medir rendimiento real antes de declarar compatibilidad.

## Extensión solicitada por Pedro: Taller de aplicaciones, n8n y herramientas herméticas

**Dirección actualizada (11-nov):** Rejon.AI no se limita a estas seis ideas visuales. Pedro propone una **aplicación configuradora por despacho** donde se carguen herramientas jurídicas herméticas y se ordenen según el trabajo de cada firma, con biblioteca modular, plantillas especializadas, radares públicos, recetas n8n, versiones y previsualización, todo bajo autorización.

El diseño ampliado está en **[Taller Rejon.AI — n8n, radares y herramientas jurídicas](taller-despachos-cordelius-n8n-radares-v1.md)**. Esa propuesta contiene catálogo inicial, contrato de módulos, reglas de privacidad, arquitectura y cuatro cortes de construcción. Ninguna integración n8n o ejecución sobre expedientes está autorizada por añadir esta documentación.

## Decisiones pendientes de Pedro y cofundadores

1. Elegir **dos experiencias iniciales** para maqueta: sugerencia `Hoy jurídico` + `Por aprobar`; memoria con fuente como siguiente.
2. Determinar si la Mesa será solo un panel interno de propuestas o una superficie visible al abogado.
3. Decidir si «Galaxia» se justifica en la primera beta o queda como exploración posterior.
4. Revisar atribución y derechos antes de trasladar cualquier activo concreto de Córdelius.

**Criterio de aceptación de esta PR documental:** una propuesta única, sin cambios en runtime ni datos, reconocida por Pedro como insumo y discutida con Santi/Lorenzo; la implementación se dividirá en PRs separados con tests y gates de privacidad. La redacción de este documento **no equivale** a dicha aceptación.
