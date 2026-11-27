He auditado los dos archivos en solo lectura. No modifiqué nada en el directorio auditado (mtimes y SHA-256 sin cambios; los renders de verificación quedaron en el directorio temporal aprobado).

## Base de la auditoría

| Dato | Valor |
|---|---|
| PDF | 90 páginas, `sha256 bcdfcd90…d77812` |
| TXT | 5.548 líneas, 90 form feeds (`U+000C`), `sha256 16e05725…a90f6b` |
| Relación | El TXT es **byte a byte idéntico** a `pdftotext -layout Reg_LAdua.pdf` |
| Consecuencia | Todo defecto del TXT está en la capa de texto del PDF. No es un error de conversión posterior. |
| Página | Footer `N de 90`. Verifiqué visualmente pp. 14, 15, 16, 32, 33, 34, 44, 45, 49, 53, 69, 70, 81, 82, 86, 89 a 110–130 dpi |

## Tabla: página / evidencia / corrección propuesta

### A. Separación cuerpo / transitorios

| Pág. | Evidencia (literal) | Corrección propuesta |
|---|---|---|
| 81 | `TRANSITORIOS` tras `Artículo 249.` Cierra el decreto original de 2015 (Primero a Sexto + firma). Separación limpia. | Sin cambios. |
| 82–88 | Bajo `ARTÍCULOS TRANSITORIOS DE DECRETOS DE REFORMA` el contenido son **anexos de la RGCE** (`ANEXO 2 de las Reglas Generales de Comercio Exterior para 2018…`, `ANEXO 13 … para 2024…`), no transitorios de decretos. | Etiquetar el bloque como «Anexos RGCE – cantidades actualizadas (2017–2026)». No ingerirlo como transitorios del Reglamento. |
| 89 | Segundo `TRANSITORIOS`, ahora del `DECRETO … 23 de febrero de 2026`. | Prefijar alcance: `TRANSITORIOS DEL DECRETO ORIGINAL (2015)` y `TRANSITORIOS DEL DECRETO DE REFORMA (23-02-2026)`. |
| Todo el archivo | El único separador de página es `U+000C`; no hay anclas textuales de nivel (título/capítulo/sección). | Añadir anclas explícitas de página y de jerarquía al artefacto de biblioteca. No depender solo de blancos y `\f`. |

### B. Numerales y sufijos perdidos

| Pág. | Evidencia (literal) | Corrección propuesta |
|---|---|---|
| 34 (L2135) | `Artículo. 88. Para efectos del artículo 61…` | `Artículo 88. Para efectos…` (el punto va después del numeral, no antes) |
| 32 (L2024, L2027, L2030) | `l.` / `ll.` / `lll.` en Art. 84, fracciones I–III | `I.` / `II.` / `III.` |
| 42 (L2691) | `artículo 65, fracción lll de la Ley` | `fracción III` |
| 42 (L2655-2656) | `artículo 36-` ↵ `A de la Ley` | `artículo 36-A` (unir sin des-guionar) |
| 43 (L2727) | `la fracción l del artículo 59 de la Ley` | `fracción I` |
| 43 (L2738) | `artículo 68, fracción ll de la Ley` | `fracción II` |
| 45 (L2843) | `l.     Acreditar el impuesto al valor agregado…` (Art. 134) | `I.` |
| 49 (L3128, L3132, L3134) | `l.` / `ll.` / `fracción l` / `fracción ll` (Art. 145) | `I.` / `II.` / `I` / `II` |
| 53 (L3373, L3375) | `Ill.` / `lV.` en Art. 158, fracciones III y IV | `III.` / `IV.` |
| 82–88 (L5215, 5250, 5284, 5318, 5354, 5395, 5439) | Las siete enumeraciones de anexos arrancan en `II.`; no existe `I.` ni la tabla de multas (solo línea de puntos). | Restaurar `I.` y la tabla, o registrar la omisión de forma explícita. No renumerar para «cuadrar». |
| 89 (L5498-5499) | `con los artículos 235-` ↵ `A; 235-B; …` | `235-A` (sufijo partido por salto de línea) |

**Nota medida:** los casos de la columna «l/ll/lll/lV/Ill» (12 tokens) están bien **renderizados** en el PDF (`I., II., III., IV.` visibles en pp. 32, 49 y 53). El daño está en la capa de texto (mapeo ToUnicode). La corrección es de extracción, no de composición.

### C. Encabezados partidos o pegados al pie

| Pág. | Evidencia (literal) | Corrección propuesta |
|---|---|---|
| 14 → 15 | `Sección Séptima` (fin de p.14) y `Vía Postal` (inicio de p.15, bajo el header) | Mantener ordinal y título juntos, y con el primer párrafo de la sección |
| 33 → 34 | Bloque `Capítulo II / Exenciones / Sección Primera / Cuerpo Diplomático, Consular y Misiones Especiales` al pie de p.33; el cuerpo empieza en p.34 | No dejar el bloque de encabezado sin cuerpo en la misma página |
| 34 → 35 | `Sección Segunda / Abastecimiento y Mercancías de Rancho` al pie de p.34; Art. 92 en p.35 | Idem |
| 44 → 45 | `Sección Primera` (fin de p.44) y `Cuentas Aduaneras y Cuentas Aduaneras de Garantía` (inicio de p.45) | Idem |
| 69 → 70 | `Capítulo IV` (fin de p.69) y `Del Consejo Asesor` (inicio de p.70) | Idem |

### D. Notas de reforma huérfanas (se separan de su párrafo)

| Pág. | Evidencia (literal) | Corrección propuesta |
|---|---|---|
| 8 (L460) | Primera línea de la página: `Párrafo adicionado DOF 23-02-2026`, justo antes de `Artículo 12.` | Reanclar al último párrafo del Art. 11 (p.7). Un parser la atribuiría al Art. 12. |
| 21 (L1297) | Primera línea: `Párrafo reformado DOF 23-02-2026`, antes del inciso `a)` | Reanclar a la fracción VI del Art. 53 (p.20) |

### E. Menores (no estructurales)

| Pág. | Evidencia | Corrección propuesta |
|---|---|---|
| 85, 86, 87 | `ARTICULO 144` sin acento (L5321, L5356, L5397), frente a `ARTÍCULO 144` en pp. 82 y 84 | Unificar `ARTÍCULO` |
| 89 (L5470) | `“Generalidades"` (comilla de cierre recta) | `“Generalidades”` |
| Todo el archivo | Termina en `\f`, sin salto de línea final | Añadir `\n` final si el contrato de bytes lo exige |

## Los dos puntos que pediste revisar en particular

**Artículo 34 (p.14).** El cuerpo está completo y bien numerado: `Artículo 34. Para efectos de los artículos 35, 36, 36-A, 37 y 37-A de la Ley…`, dos párrafos y la nota `Artículo reformado DOF 23-02-2026`. No hay pérdida de numeral ni de sufijo. El defecto cercano es el encabezado partido `Sección Séptima` / `Vía Postal` (fila C1).

**Artículo 38-C (p.16).** Correcto: `Artículo 38-C. Para los efectos del artículo 88 bis, quinto párrafo, de la Ley…`, con guion y sufijo íntegros y nota `Artículo adicionado DOF 23-02-2026`. La familia 38 está completa y en orden: 38 → 38-A → 38-B → 38-C → 39, y la lista del decreto en p.89 conserva `38, con un segundo párrafo; 38-A; 38-B; 38-C`. **No encontré defecto en 38-C.**

El defecto de la misma clase que 38-C sí aparece en **p.34**: `Artículo. 88.` (punto antes del numeral). Es el único caso de ese patrón en 90 páginas.

## Comprobaciones que salieron limpias

- Secuencia de artículos: 1–249 sin huecos. Sufijos presentes: 6-A/B, 7-A, 13-A, 17-A, 38-A/B/C, 54-A, 64-A, 76-A/B, 81-A, 134-A, 141-A, 165-A, 178-A, 189-A, 190-A, 211-A/B/C, 235-A a 235-K.
- Jerarquía: Títulos I–VIII y capítulos I–VII sin saltos. No hay encabezado con ordinal y título en la misma línea.
- No hay palabras pegadas (`LeyAduanera`), ni números pegados a palabras, ni caracteres de reemplazo o mojibake.
- Los artículos derogados aparecen como `Artículo 200. Derogado.` con su nota, de forma consistente.

## Límites de esta auditoría

- **No certifico vigencia.** El encabezado dice «Última Reforma DOF 23-02-2026»; no lo verifiqué contra el DOF.
- No hice interpretación jurídica ni comparé contra otra edición oficial.
- La revisión visual fue por muestreo dirigido (16 páginas). Las demás conclusiones salen del texto y de la estructura, no de inspección visual página por página.
- Las filas A1 y A2 describen lo que el archivo contiene; no afirmo si el original de la Cámara está así.