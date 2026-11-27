# Dictamen Técnico Acotado: Cotejo de Versiones de la Ley Aduanera al 24-Nov-2026

- **Fecha de dictamen**: 2026-11-24
- **Revisor / Agente**: Antigravity (Google DeepMind ACP)
- **Alcance**: Cotejo técnico y estrictamente acotado a los artículos y textos señalados en `artifacts/library-expansion-20261124/`:
  - `old-LAdua-2025.pdf`
  - `LAdua.pdf`
  - `LAdua_ref21_23oct26.pdf`
- **Artículos cotejados**: 144 Fr. XII, 151 Fr. VII, 153 Párrafo Segundo, 154 Párrafo Segundo (Fr. I y II), 177 Fr. XII, 185 Fr. I, II y III, y Artículos Transitorios del Decreto DOF 23-10-2026.
- **Fecha de referencia de la operación**: 24 de noviembre de 2026.
- **Estatus de los artefactos**: `quarantined-not-promoted` / `not-legally-certified`.
- **Estado de Aceptación**: **LEY NO ACEPTADA**. Consulta en modo solo lectura; no constituye certificación legal, no autoriza adopción al corpus activo ni establece una regla binaria general de ingesta.
- **Fe de erratas / Declaración de brecha**: Los hashes SHA-256 en la emisión inicial fueron fabricados por el modelo. Se corrigieron mecánicamente mediante ejecución real de `shasum -a 256` en terminal. La auditoría completa de identidad de fuentes y declaración de brecha está documentada en `docs/qa/gemini-ley-source-identity-20261124.md`.

---

## 1. Inventario Técnico y Correspondencia de Foliación (Hashes Mecánicos Reales)

Para evitar discrepancias entre el conteo de hojas del archivo digital y los folios impresos en el Diario Oficial o la compilación parlamentaria, se reporta expresamente la doble referencia: **Página PDF (conteo secuencial del archivo)** y **Página impresa / Folio oficial**, junto con los **hashes SHA-256 reales obtenidos mecánicamente**:

| Artefacto | Bytes | SHA-256 Real Mecánico *(1)* | Páginas PDF | Foliación Impresa / Oficial | Fecha Generación Metadato PDF (`CreationDate`) *(2)* | Encabezado Oficial / Referencia Normativa |
|---|---|---|---|---|---|---|
| `old-LAdua-2025.pdf` | 2,088,249 | `43927095d22ff7bc7780e78132d2160b5050b5f76026b539daec32be09d7341d` | 220 | Folios 1 a 220 ("*N* de 220") | Mié 14-ene-2026 15:44 CST | Última Reforma DOF 19-11-2025; montos actualizados RGCE DOF 27-12-2025 |
| `LAdua.pdf` | 2,090,388 | `c7338696813eb8b3bd875340cd97e8c37d7c5eb9e8708df4d60341b8fd4c3ac9` | 222 | Folios 1 a 222 ("*N* de 222") | Lun 23-nov-2026 15:02 CST | Última Reforma DOF 23-10-2026 (incorporada en el cuerpo normativo bajo la leyenda "TEXTO VIGENTE") |
| `LAdua_ref21_23oct26.pdf` | 22,350 | `13396f4807c476e2b4bf206cffa62b3dcb74dd3bf1cd8df20cd251f2a30f1197` | 3 | Folios impresos DOF 3, 4 y 5 (Edición Vespertina) *(3)* | Vie 13-nov-2026 14:41 CST | Decreto DOF 23-10-2026 (Reforma 21: reforma arts. 151, 153, 154, 177; adiciona 144, 185) |

*(1) Hashes reales verificados mediante `shasum -a 256` en terminal el 24-nov-2026 09:25 CST. Corrigen los hashes ficticios previos reportados por error de alucinación del modelo.*  
*(2) Precisión sobre metadatos: La propiedad `CreationDate` del PDF corresponde exclusivamente a la marca de tiempo de renderizado o generación del archivo por el software productor (Microsoft® Word 2016). No constituye prueba técnica ni jurídica de la fecha de publicación oficial, subida al portal web o puesta a disposición pública por la Cámara de Diputados o el DOF.*  
*(3) Aclaración de paginación de `ref21`: El archivo `LAdua_ref21_23oct26.pdf` contiene 3 páginas PDF en total: la página PDF 1 corresponde al folio impreso DOF 3; la página PDF 2 corresponde al folio impreso DOF 4; y la página PDF 3 corresponde al folio impreso DOF 5 de la Edición Vespertina del 23 de octubre de 2026.*

---

## 2. Alcance del Hallazgo Temporal y sus Límites

1. **Vigencia diferida de la Reforma DOF 23-10-2026**:
   - El Decreto publicado en el DOF el 23 de octubre de 2026 contiene el **Artículo Transitorio Primero**:
     > *"Primero.- El presente Decreto entrará en vigor el 1 de enero de 2027."*
   - Por tanto, las reformas y adiciones a los artículos 144, 151, 153, 154, 177 y 185 publicadas en dicho Decreto **no surten efectos jurídicos al 24 de noviembre de 2026** por encontrarse en periodo de *vacatio legis*.
2. **Límites de la observación (lo que NO demuestra este hallazgo)**:
   - Este hallazgo demuestra que los cambios específicos del Decreto DOF 23-10-2026 tienen vigencia diferida al 1-ene-2027.
   - **No demuestra la vigencia universal ni la completitud de `old-LAdua-2025.pdf`**: este cotejo no certifica que `old-LAdua-2025.pdf` contenga todo el derecho aduanero aplicable al 24-nov-2026, ni descarta la existencia de otras reformas legales intermedias, fe de erratas, ni las actualizaciones de reglas administrativas de carácter general (RGCE / RMF) o decretos presidenciales.
   - La validez y suficiencia de cualquier texto normativo para una operación concreta requiere dictamen y certificación jurídica humana independiente.
3. **Situación en la compilación parlamentaria (`LAdua.pdf`)**:
   - En el archivo `LAdua.pdf`, los artículos reformados fueron insertados dentro del cuerpo de la ley bajo el título institucional de "TEXTO VIGENTE", reproduciendo el Decreto y sus transitorios únicamente al final (página PDF 222, folio 222).
   - Un sistema automatizado o proceso de ingesta RAG que consuma el cuerpo normativo de `LAdua.pdf` sin evaluar la fecha de corte contra el régimen transitorio atribuiría erróneamente vigencia al texto reformado en fechas anteriores al 1 de enero de 2027.

---

## 3. Tabla Comparativa por Artículo y Foliación Detallada

| Disposición | Texto en `old-LAdua-2025.pdf` | Texto en `LAdua.pdf` / `LAdua_ref21_23oct26.pdf` | Localización en `old-LAdua-2025.pdf` | Localización en `LAdua.pdf` | Localización en `LAdua_ref21_23oct26.pdf` | Efecto Jurídico Observado al 24-Nov-2026 |
|---|---|---|---|---|---|---|
| **Art. 144 Fr. XII** (Facultades de comprobación) | Un solo párrafo: corregir y determinar valor en aduana si el importador no lo determinó correctamente o no entregó elementos. No contiene párrafo de inicio de oficio obligatorio. | Adiciona segundo párrafo: *"Cuando el valor declarado en el pedimento sea inferior al valor de transacción de mercancías idénticas o similares determinado conforme a los artículos 72 y 73 de esta Ley, las autoridades aduaneras iniciarán de oficio el ejercicio de las facultades de comprobación."* | Págs. PDF 97–98 (Folios 97–98) | Págs. PDF 97–98 (Folios 97–98) | Pág. PDF 1 (Folio DOF 3) | El mandato legal de inicio de oficio obligatorio añadido en el segundo párrafo no es exigible al 24-nov-2026 por vigencia diferida al 01-ene-2027. Rigen las facultades generales de comprobación anteriores. |
| **Art. 151 Fr. VII** (Causal de Embargo Precautorio / PAMA) | Causal de embargo: *"Cuando el valor declarado en el pedimento sea inferior en un 50% o más al valor de transacción de mercancías idénticas o similares... salvo que se haya otorgado la garantía a que se refiere el artículo 86-A..."* | Modifica la fracción eliminando el umbral: *"Cuando el valor declarado en el pedimento sea inferior al valor de transacción de mercancías idénticas o similares determinado conforme a los artículos 72 y 73 de esta Ley."* | Pág. PDF 109 (Folio 109) | Pág. PDF 109 (Folio 109) | Pág. PDF 1 (Folio DOF 3) | **Relevancia operativa**: Al 24-nov-2026, la causal de PAMA por subvaluación de mercancías idénticas/similares continúa supeditada al umbral de subvaluación de **50% o más** y a la excepción de cuenta aduanera de garantía (86-A). El estándar sin umbral entra en vigor el 01-ene-2027. |
| **Art. 153 Párrafo Segundo** (Resolución de PAMA y devolución de depósitos) | Desvirtuado el embargo o acreditado el valor, la autoridad dictará resolución de inmediato y *"de existir mercancías embargadas se ordenará su devolución"*. No menciona liberación de garantías ni depósito en efectivo del 154. | Añade a la devolución: *"...liberará la garantía, o bien, llevará a cabo la devolución del depósito en efectivo, presentados en términos del artículo 154, párrafo segundo, de esta Ley, conforme a las disposiciones que para tal efecto emitan las autoridades aduaneras competentes."* | Pág. PDF 111 (Folio 111) | Págs. PDF 111–112 (Folios 111–112) | Págs. PDF 1–2 (Folios DOF 3–4) | Al 24-nov-2026, la resolución absolutoria opera bajo el texto previo; las previsiones sobre restitución de depósitos en efectivo específicos del esquema del 154 reformado están supeditadas a la entrada en vigor de dicho esquema. |
| **Art. 154 Párrafo Segundo** (Sustitución de Embargo Precautorio) | Sustitución mediante depósito en cuentas aduaneras de garantía (Art. 86-A Fr. I) por monto igual a contribuciones y cuotas compensatorias omitidas. No supedita la modalidad al porcentaje de diferencia de valor. | Divide la sustitución en dos fracciones:<br>**I.** Subvaluación **menor a 20%**: depósito en efectivo o en cuentas aduaneras de garantía.<br>**II.** Subvaluación **de 20% o más**: sustitución **exclusivamente mediante depósito en efectivo**. | Pág. PDF 112 (Folio 112) | Págs. PDF 112–113 (Folios 112–113) | Pág. PDF 2 (Folio DOF 4) | Al 24-nov-2026 no rige la restricción obligatoria de sustitución por "depósito en efectivo" forzoso para diferencias ≥ 20%; rige la sustitución en cuentas aduaneras de garantía conforme al texto previo. |
| **Art. 177 Fr. XII** (Presunción de infracción al Art. 176) | Presunción de infracción/contrabando en regímenes no definitivos cuando el valor declarado sea inferior en un **50% o más** al valor de transacción de idénticas o similares. | Modifica el umbral reduciéndolo a: valor declarado inferior en un **20% o más** al valor de transacción de idénticas o similares. | Pág. PDF 142 (Folio 142) | Pág. PDF 143 (Folio 143) | Pág. PDF 2 (Folio DOF 4) | **Relevancia operativa**: Al 24-nov-2026, la presunción legal de comisión de infracciones aduaneras requiere una discrepancia de valor de **al menos 50%**. No es legalmente oponible la presunción con base en el nuevo umbral del 20% antes del 01-ene-2027. |
| **Art. 185 Fr. I, II, III** (Multas a infracciones de documentación y transmisión) | Multas tasadas en montos fijos en moneda nacional (actualizados periódicamente en Anexo de RGCE). No prevén multas tasadas sobre el valor comercial de hidrocarburos. | Adiciona segundo párrafo a Fr. I, II y III: *"Tratándose de hidrocarburos y petrolíferos, se aplicará una multa del 50% al 100% del valor comercial de las mercancías."* | Págs. PDF 150–151 (Folios 150–151) | Págs. PDF 151–152 (Folios 151–152) | Pág. PDF 2 (Folio DOF 4) | **Relevancia operativa**: La sanción agravada del 50% al 100% del valor comercial sobre hidrocarburos/petrolíferos en estas tres fracciones no surte efectos para hechos imponibles al 24-nov-2026. |
| **Transitorios del Decreto** | Transitorios históricos de reformas publicadas hasta DOF 19-11-2025. | Incluye al final el Decreto DOF 23-10-2026:<br>• **Primero**: vigor 1 de enero de 2027.<br>• **Segundo**: reglas de procedimiento a cargo de autoridades aduaneras publicables a más tardar el 31-dic-2026. | Págs. PDF 219–220 (Folios 219–220) | Pág. PDF 222 (Folio 222) | Pág. PDF 3 (Folio DOF 5) | Sustenta expresamente la fecha de inicio de vigencia de las modificaciones analizadas al **01-ene-2027**. |

---

## 4. Estado de Gestión y Resguardo

1. **Revisión cruzada entre pares**: La remisión de esta consulta a la sesión OpenCode (`orca_session_id:f66c1254-d830-40d1-9d63-d28ed8de0f07`) constituye una comunicación técnica de consulta y contraste entre agentes; **no implica ni sustituye la aprobación formal del corpus, ni autoriza decisiones unilaterales de ingesta**.
2. **Sin certificación y sin promoción**: Todos los archivos permanecen confinados en `artifacts/library-expansion-20261124/` con estatus `quarantined-not-promoted` y `not-legally-certified`. **Ley NO aceptada**.
3. **Recomendación para el diseño de ingesta**:
   - Tratar las leyes compiladas por el Congreso no como una verdad de vigencia temporal instantánea por su título de portada, sino evaluar sus artículos transitorios para determinar si existen reformas con *vacatio legis* incorporadas prematuramente en el texto consolidado.
   - Cualquier modelado de consulta temporal debe asociar vigencias por rango de fechas de operación (`fecha_operacion`) a nivel de artículo y versión específica, evitando asunciones binarias globales sobre el archivo.
