# Pareja congelada de biblioteca en staging desktop

Base: 30cf84f. Sin adquisición ni reconstrucción. No cambia ningún manifest,
corpus, texto, cita, edición o selección de fuentes. No aprueba runtimes.

Fallo previo reproducido: git ls-files omite la DB ignorada por Git y permite
su manifiesto. prepare-desktop podía terminar sin DB; incluirla explícitamente
en el inventario se rechazaba por no rastreada. verify-package la exigía después,
pero no forma parte de build-desktop. No prueba que una app ya distribuida o
verificada carezca de biblioteca. El empaquetador ZIP local tiene otra ruta y
ya exige el archivo explícitamente.

V2 cierra reserva detectada en revisión: V1 solo comprobaba coherencia del par.
Se fija en código SHA-256 del manifest versionado, hash de índice, hash de
corpus y tamaño de esta edición; otra pareja autoconsistente se rechaza aunque
sus hashes figuren en el inventario. Sin override CLI ni variable de entorno.
La inyección programática usada en tests es como run/host existentes, no una
opción del build ejecutable.

Reparación: excepción por DOS rutas exactas, no carpeta nueva permitida. El
inventario generado y el staging exigen DB+manifest. Ambos archivos deben ser
regulares, sin enlaces en ancestros; manifest con identidad pública y estado
sin afirmación de vigencia, tamaño/hash de la DB coherentes. El staging sigue
exigiendo ambos hashes en el inventario revisado y verifica copia y pareja
antes de reemplazar el payload anterior. No abre ni modifica SQLite: esto es
integridad de empaquetado, no búsqueda/fidelidad del artefacto real.

Medido con filesystem temporal sintético y git/lipo/npm inyectados como las
pruebas previas. Omisión DB o manifest, DB ausente/alterada/symlink, manifiesto
inconsistente aunque su nuevo hash figure en inventario: rechazan antes de
cambiar staging anterior. Copia válida conserva bytes de ambos. Fallo de
instalación offline conserva payload; generador determinista incluye la DB no
rastreada y sigue devolviendo files vacíos/unreviewed. Tests de identidad de
manifest rechazan metadatos privados/bytes negativos/hashes malformados.

Regresión: desktop-target + runtime-source-inventory + public-library +
landing-downloads: 28 PASS, 1 SKIP (arquitectura real Mac), 0 fallos.
Linux Node 22.23.5. Paso portable completo de CI (35 archivos) con
OMP_THREAD_LIMIT=1: 266 PASS, 3 SKIP, 0 fallos, 269 tests.
Build TypeScript/Vite PASS. Se añaden las dos pruebas de empaquetado existentes
a CI portable para que esta cobertura no dependa de una ejecución manual.

Límite real: el generador ahora falla ENOENT por la DB ausente en este clon,
como debe. No se obtuvo el índice de 153,014,272 bytes; no se ejecutaron las tres
pruebas antiguas que lo necesitan ni se verificó búsqueda real, paquete Mac,
GUI o modelos. Restaurar el archivo exacto fijado por manifest es distinto de
indexar exports-v1/v2. Los defaults de investigación no restauran este artefacto.
Su disponibilidad actual en otra ubicación permanece sin verificar.
