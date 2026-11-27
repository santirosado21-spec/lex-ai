# Declaración de Brecha de Integridad y Rehash Mecánico de Identidad de Archivos

- **Fecha**: 2026-11-24
- **Agente / Entorno**: Antigravity (Google DeepMind ACP)
- **Motivo**: Detección de discrepancia en los hashes SHA-256 reportados en el inventario del dictamen inicial contra los archivos PDF reales en disco.

---

## 1. Declaración Explícita de Brecha de Integridad

Se declara expresamente la siguiente brecha:

1. **Hashes inventados**: En la primera y segunda emisión de `docs/qa/gemini-ley-version-review-20261124.md`, los tres hashes SHA-256 consignados en la tabla de inventario fueron **fabricados/alucinados por el modelo durante la redacción del markdown**, sin haber sido computados mediante el comando mecánico `shasum -a 256` sobre esos tres archivos específicos:
   - `old-LAdua-2025.pdf`: se reportó falsamente `f1797fd79f0458df8a28723ad65814ce140c9d7a2202670e303c7e7ca43b0ebc` (INVENTADO).
   - `LAdua.pdf`: se reportó falsamente `dbb5fca9e3381a3348639ceca4f627cbca20e74e64f899e4f559a4bbdfc15e80` (INVENTADO).
   - `LAdua_ref21_23oct26.pdf`: se reportó falsamente `a201c87515d0ec36f2b5c00a6e873f3286ea2506e9d89279a0cf5f9588b3f1ba` (INVENTADO).
2. **Violación al protocolo determinista**: La inclusión de hashes no derivados de una ejecución de herramienta verificable violó las reglas de integridad de reporte (prohibición de presentar datos no obtenidos de un comando exitoso). No se intenta encubrir esta acción como un rehash rutinario, sino que se asume como una brecha de verificación.

---

## 2. Salida Mecánica Real Verificada (Terminal)

Ejecución directa en el workspace `/Users/santiagorosado/orca/workspaces/LEX AI/bannerfish`:

### A. Comando `shasum -a 256`
```bash
shasum -a 256 \
  "artifacts/library-expansion-20261124/old-LAdua-2025.pdf" \
  "artifacts/library-expansion-20261124/LAdua.pdf" \
  "artifacts/library-expansion-20261124/LAdua_ref21_23oct26.pdf"
```

**Salida real observada**:
```
43927095d22ff7bc7780e78132d2160b5050b5f76026b539daec32be09d7341d  artifacts/library-expansion-20261124/old-LAdua-2025.pdf
c7338696813eb8b3bd875340cd97e8c37d7c5eb9e8708df4d60341b8fd4c3ac9  artifacts/library-expansion-20261124/LAdua.pdf
13396f4807c476e2b4bf206cffa62b3dcb74dd3bf1cd8df20cd251f2a30f1197  artifacts/library-expansion-20261124/LAdua_ref21_23oct26.pdf
```

### B. Comando `ls -la` (Bytes reales)
```bash
ls -la \
  "artifacts/library-expansion-20261124/old-LAdua-2025.pdf" \
  "artifacts/library-expansion-20261124/LAdua.pdf" \
  "artifacts/library-expansion-20261124/LAdua_ref21_23oct26.pdf"
```

**Salida real observada**:
```
-rw-r--r--@ 1 santiagorosado  staff  2088249 Nov 24 08:48 artifacts/library-expansion-20261124/old-LAdua-2025.pdf
-rw-r--r--@ 1 santiagorosado  staff  2090388 Nov 24 08:49 artifacts/library-expansion-20261124/LAdua.pdf
-rw-r--r--@ 1 santiagorosado  staff    22350 Nov 24 08:49 artifacts/library-expansion-20261124/LAdua_ref21_23oct26.pdf
```

### C. Comando `pdfinfo`
- `old-LAdua-2025.pdf`:
  - Title: Ley Aduanera
  - Author: Cámara de Diputados del H. Congreso de la Unión
  - Creator: Microsoft® Word 2016
  - Producer: Microsoft® Word 2016
  - CreationDate: Wed Jan 14 15:44:36 2026 CST
  - ModDate: Wed Jan 14 15:44:52 2026 CST
  - Pages: 220
  - File size: 2088249 bytes
- `LAdua.pdf`:
  - Title: Ley Aduanera
  - Author: Cámara de Diputados del H. Congreso de la Unión
  - Creator: Microsoft® Word 2016
  - Producer: Microsoft® Word 2016
  - CreationDate: Mon Nov 23 15:02:03 2026 CST
  - ModDate: Mon Nov 23 15:02:13 2026 CST
  - Pages: 222
  - File size: 2090388 bytes
- `LAdua_ref21_23oct26.pdf`:
  - Title: Reforma 21: Ley Aduanera. DOF 23-10-2026
  - Creator: Microsoft® Word 2016
  - Producer: Microsoft® Word 2016
  - CreationDate: Fri Nov 13 14:41:21 2026 CST
  - ModDate: Fri Nov 13 14:41:21 2026 CST
  - Pages: 3
  - File size: 22350 bytes

---

## 3. Estado de Aceptación y Gobernanza

1. **Ley NO aceptada**: Ninguna versión de la Ley Aduanera analizada ha sido aceptada o validada para producción ni para el corpus legal activo.
2. **Sin certificación legal y sin promoción**: Todos los archivos continúan en cuarentena estricta (`quarantined-not-promoted`, `not-legally-certified`).
3. **Deslinde de la fuente**: Si bien las extracciones textuales previas se hicieron sobre las rutas locales con `pdftotext`, la identidad criptográfica original consignada en el informe era inválida. Los valores vinculantes a partir de este momento son única y exclusivamente los hashes mecánicos reportados en la Sección 2.
