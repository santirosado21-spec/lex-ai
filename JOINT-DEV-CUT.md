# Corte conjunto dev Rejon: DOF y Taller

24nov2026. Base exacta: 4ad70b41d74794e85bad9d297004ab9618cc11a6.

Candidato no publicado, no instalado en Mac y pendiente de revisión independiente. No activa biblioteca ni herramientas. Contiene el corte DOF con pin exacto comprobado anteriormente y la incorporación selectiva del Taller de Pedro con arreglo de importación asíncrona. Ver documentos separados para autoría y límites.

## Reconciliación

src/main.tsx conserva IntakePilot y App originales. Si al cargar review=dof, monta la revisión; si preview=workshop, monta previsualización aislada del Taller; en los demás casos conserva piloto/App. DOF tiene precedencia si se suministran ambas opciones. Estas opciones se evalúan AL CARGAR: cambiar solo el hash no cambia componente. La prueba de recorrido DOF→Taller→DOF recarga explícitamente. No se presenta como router reactivo.

App.tsx incorpora el Taller en menú y navegación usando solo cambios selectivos. Backend mantiene DOF opt-in, auth y pin exacto; no cambia library.*. Taller no consume backend ni datos de asunto. Se conservan corpus/privacidad del main sin modificaciones.

## Medido por autor sobre esta copia conjunta

- npm run build: TypeScript/Vite PASS, advertencia de tamaño de bundle.
- node --test tests/dof-app-review.test.mjs tests/tool-workshop.test.mjs tests/public-library.test.mjs tests/candidate-promotion-barriers.test.mjs: 48/48 PASS (7+18+23).
- node scripts/dof-app-smoke.mjs: bundle React/backend real, AVC/MVE/captura local/móvil/estado vacío y cambio de entradas con recarga. PASS, cero excepciones.
- node scripts/pedro-workshop-smoke.mjs: bundle real, contratos UI/importación/exportación/dependencias/carrera de importación/reload. PASS, cero API/red remota, cero excepciones y móvil sin overflow.
- node scripts/pedro-workshop-app-smoke.mjs: App completa con backend/despacho ficticio temporal, entrada Taller y vuelta a Biblioteca, sin generación ni inicio de modelo. PASS.
- Capturas conjuntas DOF desktop y Taller dentro de App inspeccionadas. Las comprobaciones móviles también pasaron; no es auditoría completa de accesibilidad.

No ejecutado en Mac/WKWebView/Tauri ni con datos reales. Inferencia sustituida en pruebas App, no evidencia de modelo. No clic DOF remoto. No revisión independiente de este corte conjunto todavía. Las pruebas anteriores independientes de DOF tienen su alcance limitado documentado, no cubren estas 48 pruebas.

## Reproducción para revisión

El ZIP contiene joint.patch aplicable a copia limpia del commit base, archivos completos, fuentes DOF y SQLite exacto. git apply --check primero; no apilar encima de paquetes anteriores ni WIP. Usar dependencias compatibles ya disponibles, build de esa copia separada y pruebas listadas. No se requiere reconstruir índice ni aceptar hashes nuevos. scripts/dof-app-dev.mjs usa datos nuevos temporales y puerto del sistema, sin modelos; abrir URL impresa sin compartir token. Los scripts de capturas usan Chrome Linux y /downloads, requieren adaptar esas rutas en otro entorno. No instalar sobre app activa.

Índice SHA256: 305306c419b8ed7ae8495822374d0a04c68bf6bb34535679d46a70b76ecf40d9. Apertura no modifica ni regenera sus bytes. Se incluye review.sha256 solo por compatibilidad de tests de continuidad; el lanzador NO lo lee y el adaptador rechaza cualquier pin alternativo. Alcance exclusivo nine-text-document-review-dev-only, no producción o certificación jurídica.
