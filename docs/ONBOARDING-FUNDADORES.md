# LEX AI — guía de entrada para fundadores

Escrita el 2026-11-06 para Pedro y Lorenzo. Es un mapa, no una promesa: dice qué existe, qué se midió y qué no.

## Qué es
Asistente jurídico de escritorio para despachos mexicanos: conversa con naturalidad y, cuando afirma algo jurídico, cita un artículo oficial recuperado de una biblioteca local (35.452 artículos, 303 leyes federales y una selección estatal). Gestiona asuntos, documentos y horas. Dirección vigente del dueño (2026-11-05): inferencia híbrida; el almacenamiento y la recuperación privados siguen locales. Léela completa en `docs/architecture/hybrid-private-workspace-2026-11-05.md`.

## Dónde mirar primero (en este orden)
1. `docs/agents/STATE.md` — dónde estamos hoy y qué sigue. Es la memoria compartida entre personas y agentes.
2. `docs/agents/DECISIONS.md` — decisiones con su motivo. No las deshagas sin leerlo.
3. `AGENTS.md` — reglas del proyecto (datos sintéticos, privacidad, quién puede hacer qué). Mandan sobre todo lo demás.
4. `docs/qa/dialogue-loop-2026-11-04.md` — cómo se midió la calidad, versión por versión.
5. `docs/architecture/conversational-product-contract-2026-11-03.md` — el producto que queremos.

## Ramas (importante)
- **`main` despliega la landing pública en Vercel.** No empujes ahí sin hablarlo con Santiago.
- **`rescate-0.4.13`** tiene todo el trabajo reciente (app 0.4.14). Trabaja en ramas nuevas que salgan de ella y abre un Pull Request hacia ella.

## Probar la app
- Instalador de prueba: `LEX-AI-0.4.14-universal.dmg` (Mac Apple Silicon e Intel, sin notarizar: clic derecho > Abrir la primera vez). Santiago lo comparte aparte, pesa 2,2 GB y no está en el repo.
- Windows no existe.
- Usa solo datos inventados. Nunca documentos ni nombres de clientes reales.

## Correr el código
```sh
npm install
node --test tests/*.test.mjs          # 425 pruebas; una de dictado por voz es intermitente y está documentada
node scripts/eval-dialogue.mjs run --label mi-prueba   # examen ciego de 36 casos; necesita la app instalada
```

## Qué se midió y qué no
- Medido: examen ciego contra la versión base con un juez automático de doble orden (v11 le ganó a la base 11 a 8 con 4 empates, en 23 de 36 casos). La fidelidad jurídica no mejoró de forma demostrada.
- No medido: rendimiento en una Mac física de 8 GB o Intel real; validación por abogados; vigencia de las leyes; notarización de Apple.
- La destilación (entrenar el modelo pequeño con ejemplos de un modelo grande) está en curso y no se ha entrenado nada todavía.

## Reglas para no romper nada
- Nada de claves, tokens ni datos de clientes en el repo. Las claves viven fuera, en `~/.config/`.
- Antes de commitear: pruebas en verde.
- Al terminar una sesión, deja una nota en `docs/agents/LOG.md` (con `node scripts/dsystem/dmem.mjs log --agent owner --title "…"` o a mano, al final del archivo).
