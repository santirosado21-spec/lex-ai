# Repositorios mexicanos revisados

Consulta pública mediante conector GitHub y API pública el 29–30 de octubre de 2026. No se clonaron ni ejecutaron scripts de estos proyectos. No se usaron como autoridad jurídica ni se incorporó su código.

| Repositorio | Qué se comprobó | Uso en LEX |
|---|---|---|
| [renich/LeyesMexicanas](https://github.com/renich/LeyesMexicanas) | Compendio textual con directorio federal. README.rst describe extracción desde Diputados y versionado; declara GPLv3 o posterior. Metadatos observados: último push 2026-10-15. | Referencia de descubrimiento y trazabilidad; consultar directamente los originales oficiales. |
| [rafael-afie/leyes-fiscales-mx](https://github.com/rafael-afie/leyes-fiscales-mx) | README describe snapshots fiscales/laborales actuales e históricos, actualización por hashes y revisión de cambios. Último push observado 2026-08-19; licencia no identificada en metadatos de API. | Candidato para localizar fuentes fiscales y estudiar versiones por fecha; sin reutilizar resúmenes ni asumir vigencia. |
| [alfonsomp18/mx-law-code-v2](https://github.com/alfonsomp18/mx-law-code-v2) | README aclara que contiene un catálogo/tracker, no los textos completos. Último push observado 2026-08-15; licencia no identificada en API. | Candidato de enlaces oficiales; nunca confundir catálogo con corpus descargado. |

El primer descubrimiento automático obtuvo 11 repositorios únicos. Su lista puede cambiar y queda fechada en `artifacts/legal-repositories/status.json`. Una fecha reciente de push no demuestra que cada ley esté actualizada. Las licencias y términos deben revisarse antes de reutilizar código o material editorial.

Fuentes primarias del corpus: [Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/index.htm) y copia histórica identificada del Congreso de CDMX. El monitor no esquiva el error de certificado encontrado en el portal de CDMX. Ver `docs/legal-sync.md`.
