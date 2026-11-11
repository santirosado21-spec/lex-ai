# Diseño del flujo DOF / decretos de reforma — 2026-11-11

**Estado: DISEÑO / PREPARACIÓN REVERSIBLE. No implementado, no adoptado, sin adquisición.**

## 1. Canal verificado (2026-11-11)

- `https://www.dof.gob.mx` tiene TLS roto (SAN sin www) → fail-closed, sin omisión. El host raíz `https://dof.gob.mx` es el canal válido.
- `https://dof.gob.mx/robots.txt` (HTTP 200): 136 Disallow, TODOS endpoints de consulta por fecha (`nota_detalle.php`, `nota_to_doc.php`, `copias_cert.php`, `index*.php?year=...&month=...&day=...`). Las rutas estáticas de PDF no están prohibidas.
- PDF estático de muestra verificado: `https://dof.gob.mx/2026/PRESREP/RCRJL_03032026_VES.pdf` (HTTP 200, application/pdf, 40,744 B) — edición vespertina del martes 3 de marzo de 2026.
- La portada `index.php` enlaza los PDF estáticos del día. La navegación histórica usa las URLs de consulta prohibidas por robots → el historial profundo requiere localizar una ruta de archivo permitida (índice anual estático, si existe) o quedar acotado a ediciones recientes enlazadas desde portada. No se navegaron URLs prohibidas.

## 2. Estructura observada de una edición (muestra real)

```
(Edición Vespertina) / DIARIO OFICIAL / Martes 3 de marzo de 2026
PODER EJECUTIVO
PRESIDENCIA DE LA REPUBLICA
DECRETO por el que se reforman las fracciones IV y XI del Apartado A del Artículo 123
  de la Constitución Política de los Estados Unidos Mexicanos, en materia de reducción
  de la jornada laboral.
  ... preámbulo ("EL CONGRESO GENERAL ... DECRETA") ...
Artículo Único.- Se reforman las fracciones IV y XI ... para quedar como sigue:
  Artículo 123. ... (texto reformado del precepto)
TRANSITORIOS / ARTÍCULOS TRANSITORIOS (artículos Primero, Segundo, ...)
```

Una edición puede contener varios documentos (decretos, acuerdos, avisos, convocatorias) agrupados por órgano emisor.

## 3. Modelo de registros propuesto

Dos niveles, ambos en cuarentena por defecto con la proveniencia completa ya usada en el pipeline (snapshot hasheado, `sourceUrl` del PDF estático, `retrievedAt`, `pdfSha256`, `declaredAmendedAt` nulo — la fecha de la edición NO es fecha de reforma declarada de ninguna ley):

1. **Registro de edición** (`MX-FED-DOF@{fecha}+{edicion}`): metadatos de la edición (fecha parseada del encabezado, edición MAT/VES, lista de documentos detectados, cobertura de páginas).
2. **Registro de documento/decreto** (hijo de la edición): texto completo del documento SIN segmentar por artículo de código. Metadatos extraídos por patrón determinista:
   - tipo (`DECRETO|ACUERDO|AVISO|CONVOCATORIA|...` del encabezado);
   - órgano emisor (bloque de sección en mayúsculas que lo antecede);
   - instrumentos objetivo y preceptos: del cuerpo "Se reforma(n)|adiciona(n)|deroga(n) ... Artículo N ... de la {Ley|Código|Constitución} ..." → lista de citas `{instrumento, artículos, acción}` (evidencia textual, no interpretación);
   - artículos transitorios del propio decreto como bloque interno (formas "Artículo Primero/Único.-", ya reconocibles).

## 4. Reglas de extracción propuestas

- Segmentación por encabezados de documento (líneas de tipo + órgano en mayúsculas), NUNCA por "Artículo N.-" del texto reformado embebido: el texto de los preceptos reformados queda íntegro dentro del registro del decreto, con su cita original ("Artículo 123. ...").
- Frontera por documento = siguiente encabezado de órgano/tipo o fin de edición; ausencia de encabezado claro → anomalía y cuarentena del tramo (fail-closed, como el extractor de códigos).
- Sin reintentos creativos: cualquier edición sin fecha/órgano parseable queda en cuarentena con anomalía, no se infiere.

## 5. Relación con los textos consolidados (regla de no-mezcla)

El contenido de un decreto es EVIDENCIA de reforma, nunca texto vigente aplicado. Ningún flujo sobrescribe ni "actualiza" automáticamente los códigos consolidados del corpus a partir de decretos: la aplicación de una reforma a un texto consolidado requiere su propia validación (y la comparación contra la versión consolidada vigente publicada por la fuente oficial). Esto preserva la regla de no mezclar texto histórico como vigente.

## 6. No-objetivos

- Sin navegación de endpoints prohibidos por robots; sin omisión de TLS; sin inferir rutas de archivo histórico no verificadas.
- Sin afirmar vigencia, aplicabilidad ni interpretación jurídica de las reformas.
- Sin gasto, sin adquisición masiva: cualquier ejecución sigue el flujo del manifiesto (fuente, bindings, límites) como las fuentes anteriores.
