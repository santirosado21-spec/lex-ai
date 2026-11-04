# Escritorio autónomo 0.4.4

El paquete de distribución incorpora el motor privado y el candidato ligero fijado en `resources/model-catalog.json`. El usuario final no necesita instalar Ollama ni descargar los pesos después de obtener la app. La inclusión aumenta el tamaño del instalador: los archivos del modelo suman **1.945.781.358 bytes**, además del motor, la biblioteca y la interfaz.

## Compilación reproducible

`scripts/prepare-desktop.mjs` obtiene el candidato de un caché existente. El origen predeterminado es `~/Library/Application Support/mx.lexai.desktop/models`; se puede sustituir mediante `LEX_BUNDLED_MODEL_SOURCE`. Si falta el candidato aprobado o sus hashes no coinciden, el empaquetado falla: no descarga modelos ni incorpora otro modelo automáticamente.

El script usa `stageBundledModel` de `server/bundled-model.mjs`. Comprueba el manifiesto fijado, la suma exacta de tamaños y SHA-256 de cada archivo. Copia solo su configuración, capas, licencia y manifiestos a `.desktop/app/resources/bundled-model`. Otros modelos del caché, incluyendo candidatos históricos grandes, quedan excluidos. La copia preparada se vuelve a verificar antes de reemplazar el bundle generado previo.

El motor sigue incluyéndose en `resources/runtime` desde `LEX_RUNTIME_SOURCE` o la instalación de compilación existente. Esta dependencia de la máquina que construye no se impone al usuario final. Se conservan las licencias y avisos técnicos, incluida la capa de licencia Apache-2.0 del modelo y los avisos del motor.

## Primera ejecución

`ensureBundledModel({bundleDir,modelsDir,catalog,signal})` valida el bundle y prepara un almacén de modelos modificable, exclusivo del usuario. Publica cada archivo mediante un temporal y renombrado; restaura únicamente el tag fijado y sus capas. Conserva modelos, archivos y documentos ajenos. Comprueba tanto el índice clásico como el índice migrado para evitar que un tag previo oculte los pesos aprobados.

El helper devuelve `{available,seeded,files,bytes}`. Un bundle ausente devuelve `available:false` para mantener utilizable el entorno de desarrollo; un bundle presente e inválido provoca un error. Los candidatos experimentales `localOnly`/índice v2 no son distribuibles mediante este helper. `AbortSignal` permite cancelar antes de publicar el siguiente archivo; las copias temporales no se confunden con archivos completos.

La preparación ocupa espacio adicional para el almacén del usuario. No carga el modelo para inferencia por sí misma. El responsable de inicio llama al helper y arranca el motor privado; el usuario ve preparación y progreso de LEX AI, sin nombres técnicos ordinarios.

## Verificación

- `node --test tests/bundled-model.test.mjs`: aislamiento del allowlist, corrupción de origen/bundle, preservación de datos, reparación del tag, cancelación, rechazo de directorios enlazados y archivos extra.
- `node scripts/verify-package.mjs`: hashes de módulos actuales y pesos incluidos, firma técnica del bundle, backend en almacén nuevo, lectura de biblioteca y preparación automática sin entrar al estado de descarga.
- La comprobación del paquete no certifica calidad jurídica, notarización ni funcionamiento en un equipo físico de 8 GB. Esas evidencias se registran por separado.

Procedencia técnica: candidato Qwen3.5 2B Q4_K_M, manifiesto fijado `1e2d21a4f03ab9e4a9c1976a4b7e88f21de61d65f2c5485d8fde8942be73f1e7`, licencia y URLs en el catálogo. Runtime Ollama privado redistribuido con sus avisos. No se atribuye a LEX AI la autoría exclusiva de esos componentes.
