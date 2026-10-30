# Dirección visual — Claude Opus 5.5

# LEX AI · Composer: diseño

**Sujeto.** Es un despacho que redacta y consulta sobre sus propios expedientes, en local. El composer actúa como mesa de trabajo, no como chat de consumo. La única pieza memorable es el anillo metálico del botón enviar. Todo lo demás queda sobrio.

## Tokens
- **Blanco** `#FFFFFF`: superficie del composer.
- **Piedra** `#E4E3DF`: fondo de la app y del borde de reposo.
- **Pizarra** `#3B5266`: foco, chip activo y texto de acción.
- **Tinta** `#1E2A33`: texto.
- **Acero** `#AEB6BD` → `#6C7781`: el anillo, en dos tonos fríos y sin arcoíris.
- **Lacre** `#8E3B2F`: solo para errores.

**Tipografía.** IBM Plex Sans para controles y entrada. Source Serif solo en las respuestas y citas que ya existen. Todo en sentence case, sin mayúsculas sostenidas.

## Layout
**Desktop** (Inicio centrado, máx. 720 px; en Asistente, anclado al pie de la columna, sin invadir el aside de citas):
```
┌──────────────────────────────────────────────┐
│ Textarea autogrow 1–6 filas, luego scroll    │
│                                              │
│ [📎] [Habilidad: Revisar contrato ▾] Local [◉]│
└──────────────────────────────────────────────┘
  Abre un asunto para enviar        (ayuda)
```
**Móvil 320:** la textarea ocupa el ancho completo. La fila inferior queda así: adjuntar 44, chip de habilidad flexible con elipsis, enviar 44. "Local" pasa a un icono de candado con nombre accesible "Procesado en este equipo". Ningún control se oculta.

## Comportamiento
- **Componente controlado.** `question` vive en la App y solo se borra tras un éxito. Si hay fallo o cancelación, el texto se conserva íntegro, cursor incluido.
- **Teclado.** Enter envía si está habilitado. Shift+Enter inserta un salto de línea. Cmd/Ctrl+Enter también envía. Durante la composición IME no se envía nada. Orden de tabulación: textarea → adjuntar → habilidad → enviar.
- **Deshabilitado.** El anillo se aplana a piedra. Una línea de ayuda, enlazada con `aria-describedby`, nombra lo que falta: motor, documento o asunto. Nunca solo color.
- **En curso.** Enviar se convierte en Detener, en el mismo sitio y con un cuadrado. El anillo hace un barrido lento. El loader y las citas existentes no cambian.
- **Foco.** Contorno pizarra de 2 px por fuera del anillo, siempre visible.
- **Adjuntar** reutiliza la importación con alcance al asunto. **Habilidad** es el selector real. No hay chip Auto ni selector de modelo, y no se muestra ningún nombre de proveedor.

## Shader
Es opcional y se carga en local, sin CDN. Con `prefers-reduced-motion` o si WebGL falla, se usa un gradiente cónico estático en CSS con el mismo par de aceros. El reflejo sobre los chips es un brillo de 1 px, nunca un halo.

## Revisión
Mi primer plan añadía un halo pulsante a todo el composer y chips "Auto". Eso es lo genérico de cualquier chat con IA, así que lo reduje a un único elemento metálico ligado a la acción, y el estado "Local" pasó a ser un hecho, no un selector.

## Ajustes de integración de Codex

Se conserva el nombre Cancelar existente. El shader se desmonta mientras LEX AI procesa para liberar GPU; la acción conserva el anillo estático. El tema claro de la app se pasa explícitamente a MetalFx; no se implementa un hook de tema que el recurso no aporta. La pregunta y la selección pertenecen al estado existente de App y solo se limpia la pregunta tras éxito.
