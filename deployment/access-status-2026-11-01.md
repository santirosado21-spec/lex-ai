# Estado de acceso — 1 de noviembre de 2026

El dueño autorizó Supabase en su organización personal y confirmó la autorización de Vercel. Solo se alojarán metadatos públicos del producto y la landing; documentos, asuntos, recuperación e inferencia permanecen locales.

## Supabase

Plugin instalado y habilitado, pero las llamadas anunciadas `list_organizations` y `list_projects` devolvieron MCP `-32001 Unknown tool`. No se pudo identificar la organización ni consultar coste. No se creó ningún proyecto ni se ejecutó SQL remoto.

La apertura autorizada de supabase.com fue rechazada por la revisión automática: un permiso guardado deniega acceso de red al dominio. No se intentaron CLI, red directa ni otras superficies para eludirlo. El dueño pidió consultar a Claude; la consulta acotada se ejecutó con Claude Opus 5.5, sin herramientas ni credenciales. Distinguió el fallo de enrutamiento del conector del bloqueo del navegador; sus hipótesis de causa no son hechos confirmados.

Hace falta corregir el permiso guardado o recuperar la conexión del plugin en el host antes de una nueva comprobación. La autorización escrita del dueño no cambió ese ajuste técnico.

## Vercel

La conexión identifica la cuenta y el equipo personal esperados, pero listar proyectos o consultar ese equipo devuelve 403. Se emitió un nuevo enlace oficial para la misma conexión. Tras la respuesta del dueño se repitió la lectura, todavía con 403.

La inspección de ese enlace en el navegador mostró la cuenta/equipo correctos y el botón Allow aún pendiente. Se dejó la pestaña abierta para completar esa acción. Esto aporta evidencia más concreta que las hipótesis de propagación o sesión del diagnóstico de Claude. No se sustituyó la conexión, token o equipo.

No hay proyecto ni deployment de LEX AI creados en esta comprobación. La solicitud revisable sigue en `vercel-project-request.json`. Después de una confirmación visible, repetir la lectura con esta misma conexión antes de crear o desplegar.

## Preparación independiente

Landing y catálogo local actualizados a 0.3.8, preservando versiones históricas del seed y URLs de descarga NULL. El repositorio de desarrollo sigue privado. La landing no ofrece descargas públicas ni envía documentos a la nube. Las pruebas locales no equivalen a despliegue remoto.
