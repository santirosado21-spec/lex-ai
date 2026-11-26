# Dictation smoke with reasoning OFF, 2026-11-25

Base: `16f77931e36554d4935f8209358e87d7f13238fa` (PR27).

The old script required Preguntar enabled after dictation. This contradicts the product reasoning boundary. The repaired smoke leaves product behavior unchanged and tests the real VoiceInput and composer with explicitly fake microphone frames and fake STT responses. It is not a speech model test.

## Measured

- Real source UI via Vite, authenticated local HTTP/SQLite for workspace/state, product startServer boundary. Temporary DB/cache removed after execution.
- Fake microphone opens, emits frames and closes. Actual client WAV serialization has RIFF/WAVE headers, mono 16kHz 16-bit format, nonempty payload and matching data length.
- One fake STT response appends to existing text. Manual editing and Enter preserve it. Preguntar remains disabled, state/engine expose reasoning unavailable.
- Discarding a second recording closes fake stream/context without another transcription or changing the text.
- Zero model starts/generations/analyze requests; no chat or answer records. Two fake mic opens/stops/closes. No page errors or horizontal overflow at 1280/390.
- Author: smoke PASS twice; stt and reasoning-role backend suites 7/7 PASS; build PASS.
- Mutation removes onTranscript delivery from VoiceInput. Smoke fails on missing inserted text, then restored source passes. No functional source changes remain in patch.

Desktop and narrow screenshots inspected: edited text retained, inactive submit, OFF explanation legible. No layout changes.

## Limits

No real microphone capture, speech recognition accuracy, STT model loading, permissions dialogue, native app, model inference, production deployment or network STT server measured. Fake STT routing only proves client UI/serialization flow. This does not certify all voice error paths or the real speech backend. Separate review results are not claimed here.
