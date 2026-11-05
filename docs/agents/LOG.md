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

## 2026-11-04 23:05 — claude — Gemma local era Qwen; ahora es Gemma 4 E4B

- Hallazgo: localllm usaba el primer modelo de Ollama, que era qwen3.5:2b, no Gemma. El gemma4:26b-a4b (16 GB) llevaba 6 días descargado sin usarse.
- Prueba medida: el 26B responde bien (24,8 s) pero bajó la memoria disponible de 30 % a 11 % y dejó el swap en 14,2 de 15 GB. Se descargó de memoria con 'ollama stop'.
- Descargado gemma4:e4b-it-q4_K_M (6,6 GB, orden del dueño): 3,5 s por respuesta, memoria 54 % libre tras la prueba. localllm ahora lo prefiere y acepta --model (copia de respaldo ~/.local/bin/localllm.bak-20261104).
- OpenRouter sigue desactivada hasta que el dueño la reactive sabiendo que tiene unos 6,32 USD de saldo real.

## 2026-11-04 23:08 — claude — La skill de la fábrica se llama PSF

- Por orden del dueño, el modo SF pasa a ser la skill PSF (~/.agents/skills/psf/SKILL.md, enlazada también en ~/.claude/skills/psf). Comando: psf seats | psf panel; dsf queda como alias.
- La skill dsystem sigue siendo el reparto general de modelos y apunta a PSF para funciones nuevas y cambios en varios archivos.
- No se expandió la sigla PSF: el dueño no la definió.

## 2026-11-04 23:10 — claude — dsystem pasa a llamarse PSF en todo el método

- Orden del dueño: ya no se llama dsystem; todo el método (reparto de modelos, fábrica de software, memoria) es PSF.
- Skill única: ~/.agents/skills/psf/SKILL.md (con references/remote-collaborators.md). dsystem queda como aviso que remite a psf. Respaldo de la skill vieja en scratchpad/dsystem-skill-backup.
- Comando unificado: psf seats|panel (fábrica) y psf status|key|enable|models|ask (colaboradores remotos). dsystem y dsf siguen como alias.
- Actualizados: instrucciones globales de Claude y Codex, AGENTS.md del proyecto (nota al final), memoria de Claude y ayuda de remote.mjs.

## 2026-11-04 23:11 — claude — Oxylabs: clave guardada pero rechazada (401)

- La clave está en ~/.config/lexai/oxylabs.env (permisos 600, 44 caracteres, formato normal). Una sola llamada de prueba a webapi.oxylabs.io/v1/scrape (Bearer) sobre un índice público de diputados.gob.mx devolvió HTTP 401: Oxylabs la rechaza. Sin reintentos.
- Posibles causas: clave de otro producto de Oxylabs, o de una instancia de Web API sin activar. La documentación pide crear una instancia de Web API y copiar SU clave.
- Reglas de uso acordadas: solo fuentes que ya se descargan sin evadir bloqueos (OJN, diputados.gob.mx); no usarla para saltar el 403 de la SCJN ni el bloqueo del DOF sin orden explícita del dueño; los créditos se ven solo en el panel de Oxylabs, así que fijar un tope de consultas por corrida.
