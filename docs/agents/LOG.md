# Bitácora de agentes — LEX AI

Solo se añade al final. Formato: `## fecha — agente — título` y viñetas con hechos verificados. Usa `dmem log`.

## 2026-11-04 22:47 — claude — Memoria compartida en Markdown, modo SF y Kimi al límite

- Creada esta memoria (dmem) para que Claude, Codex, Gemini, Kimi y Cursor lean y escriban lo mismo sin pagar un servicio de memoria.
- Modo SF: decisores = Gemini, Claude, Codex, Kimi, Cursor (Grok); obreros gratuitos = Groq, Gemma, OpenRouter. Primer panel real (Gemini + Groq) objetó el filtro de distractores: descarta excepciones que no repiten el tema en la primera frase.
- Kimi: plan de pago con límite de uso de 5 horas, alcanzado tras 764 semillas. No se compra uso extra sin orden del dueño.
- Repos instalados: EGM (plugin en Codex y Claude), hallmark, motionsites; bama y claude-seo descargados sin activar (sh ~/.agents/repos/activate.sh).

## 2026-11-04 22:54 — claude — OpenRouter desactivada: la cuenta no es gratuita

- La API de OpenRouter reporta total_credits=45 USD y total_usage=38,68 USD (unos 6,32 USD de saldo) e is_free_tier=false. El dueño había dicho que tenía 3 centavos; la activación se hizo con esa premisa.
- Se desactivó (dsystem disable openrouter). El código seguía impidiendo cobros (solo :free con precio cero y max_price 0), pero la atestación de cuenta gratuita no era cierta.
- Groq medido en vivo: 1.000 solicitudes por día y 8.000 tokens por minuto (openai/gpt-oss-120b).
