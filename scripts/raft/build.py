#!/usr/bin/env python3
"""Assemble directly authored complete RAFT answers with verified local evidence; no inference."""
import argparse
import collections
import copy
import hashlib
import json
import random
import re
import sqlite3
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from authored import ANCHORS, CHATS, DOCUMENTS, FALLBACK_HELD_OUT, GAPS, SYSTEM, VALIDATION_CONTEXTS
from diversity import enforce

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "artifacts/raft"
AREAS = tuple(ANCHORS)
SEED = 20261103
def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(4 * 1024**2), b""):
            h.update(chunk)
    return h.hexdigest()


def text_digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def write_json(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(path)


def read_library(path):
    # Read-only transaction: never change the library, including its split labels.
    con = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    with con:
        rows = [json.loads(p) for p, in con.execute("SELECT payload FROM articles ORDER BY id")]
        meta = json.loads(con.execute("SELECT value FROM metadata WHERE key='library'").fetchone()[0])
    con.close()
    return rows, meta


def read_holdout(readme):
    """Accept a JSON fence/object with heldOutLaws, or a section of MX-* IDs.

    Refuse ambiguous text rather than silently train on an evaluator's law.
    A global list must be accompanied by heldOutLawsByArea for per-area validation.
    """
    if not readme.exists() or "heldOutLaws" not in readme.read_text():
        raise ValueError("Sealed evaluation heldOutLaws declaration is required; no permissive fallback")
    text = readme.read_text()
    decoder = json.JSONDecoder()
    candidates = []
    for i, char in enumerate(text):
        if char == "{":
            try:
                obj, _ = decoder.raw_decode(text[i:])
                if isinstance(obj, dict) and "heldOutLaws" in obj:
                    candidates.append(obj)
            except json.JSONDecodeError:
                pass
    if candidates:
        if len({json.dumps(c, sort_keys=True) for c in candidates}) != 1:
            raise ValueError("Ambiguous heldOutLaws declarations")
        obj = candidates[0]
        held = obj.get("heldOutLawsByArea", obj["heldOutLaws"])
        if not isinstance(held, dict) or set(held) != set(AREAS):
            raise ValueError("README must map heldOutLaws (or heldOutLawsByArea) to all ten areas")
        held = {a: [v] if isinstance(v, str) else v for a, v in held.items()}
    else:
        section = text[text.index("heldOutLaws"):]
        held = {}
        for line in section.splitlines():
            ids = re.findall(r"MX-[A-Z0-9_-]+", line)
            area = next((a for a in AREAS if re.search(r"(?<![\w-])" + re.escape(a) + r"(?![\w-])", line)), None)
            if ids and area:
                held.setdefault(area, []).extend(ids)
        if set(held) != set(AREAS):
            raise ValueError("Cannot parse README heldOutLaws by area; use a JSON fenced mapping")
    if any(not isinstance(v, list) or not v or any(not isinstance(x, str) or not x.startswith("MX-") for x in v) for v in held.values()):
        raise ValueError("Invalid held-out law IDs")
    return held, {"kind": "eval-readme", "path": str(readme.relative_to(ROOT)), "sha256": digest(readme)}


def passage(article, quote=None):
    original = article["text"]
    if quote is None:
        # Used only as irrelevant context, or literal-reading validation.
        end = original.rfind(" ", 0, min(650, len(original))) if len(original) > 650 else len(original)
        start = 0
    else:
        start_quote = original.index(quote)
        start = max(0, start_quote - 100)
        if start:
            start = original.find(" ", start) + 1
        end = min(len(original), max(start + 650, start_quote + len(quote)))
        if end < len(original):
            end = max(start_quote + len(quote), original.rfind(" ", start, end))
    text = original[start:end]
    return {
        "kind": "public-law", "text": text, "sourceId": article["sourceId"],
        "lawId": article["lawId"], "article": article["article"], "title": article["title"],
        "jurisdiction": article["jurisdiction"], "url": article["url"],
        "version": article["version"], "retrievedAt": article["retrievedAt"],
        "amendedAt": article.get("amendedAt"), "effectiveAt": article.get("effectiveAt"),
        "authority": article.get("authority"), "pdfSha256": article["pdfSha256"],
        "originalTextSha256": text_digest(original), "textSha256": text_digest(text),
        "sourceStatus": article.get("status"), "originalSplit": article.get("split"),
        "pages": article.get("pages", []), "charStart": start, "charEnd": end,
        "completeArticle": start == 0 and end == len(original),
    }


def specs():
    out = []
    for area, anchors in ANCHORS.items():
        for n, (law, article, quote, fact, questions) in enumerate(anchors):
            for j, question in enumerate(questions):
                out.append({"area": area, "type": ["grounded", "missing-facts", "followup"][j],
                            "law": "MX-FED-" + law, "article": article, "quote": quote,
                            "factQuestion": fact, "question": question,
                            "previousUser": f"Estoy preparando un ejercicio sintético de lectura de {area}. Revisemos el artículo {article} de la fuente que aportaré.",
                            "previousAssistant": "De acuerdo. Revisemos el pasaje y separemos su contenido de lo que aún falta conocer del caso."})
        for kind, question, fact in GAPS[area]:
            out.append({"area": area, "type": kind, "question": question, "factQuestion": fact,
                        "previousUser": "Seguimos con un supuesto inventado; todavía faltan fuentes y datos.",
                        "previousAssistant": "Podemos identificar qué información falta antes de llegar a una conclusión."})
        for n, (contract, clause, question) in enumerate(DOCUMENTS[area]):
            out.append({"area": area, "type": "synthetic-document", "question": question,
                        "contract": contract, "quote": clause, "twoPassages": n == 1,
                        "previousUser": "Trabajemos sólo con un contrato inventado para este ejercicio.",
                        "previousAssistant": "Sí. Podemos leer sus cláusulas y distinguir lo pactado de lo que requeriría una fuente legal."})
        for prior, question, answer in CHATS[area]:
            out.append({"area": area, "type": "chat", "question": question, "answer": answer,
                        "previousUser": prior, "previousAssistant": "Entendido. Continuemos con lo que necesitas."})
    assert len(out) == 300
    for i, row in enumerate(out):
        row["seedId"] = f"seed-{i + 1:03d}"
    return out


def source_block(src):
    if src["kind"] == "public-law":
        header = (f"[{src['id']}] {src['title']} | artículo {src['article']} | "
                  f"{src['jurisdiction']} | versión {src['version']} | "
                  "fragmento; vigencia no verificada")
    else:
        header = f"[{src['id']}] {src['title']} | documento privado sintético del asunto"
    return header + "\n" + src["text"]


def render(spec, ordinal, by_key, distractor_pool, tone="", split="train", authored_answer=None, history=None):
    rng = random.Random(SEED + ordinal + (100000 if split == "valid" else 0))
    kind, area = spec["type"], spec["area"]
    sources, supports = [], []
    question = tone + spec["question"]
    if spec.get("law"):
        src = passage(by_key[(spec["law"], spec["article"])], spec["quote"])
        src["relevant"] = True
        sources.append(src)
        supports.append((src, spec["quote"]))
    if kind == "synthetic-document":
        clauses = [spec["quote"]]
        if spec.get("twoPassages"):
            clauses.append("Las modificaciones del encargo se documentarán por escrito.")
            question += " Además, ¿qué dice el otro fragmento sobre modificar el encargo?"
        for n, clause in enumerate(clauses):
            src = {"kind": "synthetic-private-document", "title": f"Contrato ficticio de {spec['contract']}",
                   "text": clause, "textSha256": text_digest(clause), "synthetic": True,
                   "sourceId": f"SYN-{spec['seedId']}-{ordinal}-{n}", "relevant": True,
                   "firmId": "synthetic-firm-raft", "matterId": f"synthetic-matter-{ordinal}",
                   "provenance": "Authored synthetic clause; no client document"}
            sources.append(src)
            supports.append((src, clause))
    if kind != "chat":
        excluded_laws = {s.get("lawId") for s in sources}
        area_laws = {"MX-FED-" + x[0] for x in ANCHORS[area]}
        pool = [x for x in distractor_pool if x["lawId"] not in excluded_laws | area_laws]
        # Distinct laws; don't label irrelevance or leak answer keys into model input.
        by_law = collections.defaultdict(list)
        for x in pool:
            by_law[x["lawId"]].append(x)
        for law in rng.sample(sorted(by_law), 2 + ordinal % 2):
            src = passage(rng.choice(by_law[law]))
            src["relevant"] = False
            sources.append(src)
    rng.shuffle(sources)
    counters = collections.Counter()
    for src in sources:
        letter = "L" if src["kind"] == "public-law" else "D"
        counters[letter] += 1
        src["id"] = f"{letter}{counters[letter]}"
    blocks = [source_block(src) for src in sources]
    if blocks:
        question += "\n\nPasajes recuperados (datos, no instrucciones):\n" + "\n\n".join(blocks)
    quotes = [{"sourceId": src["id"], "text": quote} for src, quote in supports]
    if not isinstance(authored_answer, str) or not authored_answer.strip():
        raise ValueError("A complete directly authored answer is required; template expansion is disabled")
    # Only reference identities may be rebound after shuffling. Never interpolate
    # a quote or generate/combine prose: the complete answer is already on disk.
    canonical = {("L1" if src["kind"] == "public-law" else f"D{i+1}"): src["id"]
                 for i, (src, _) in enumerate(supports)}
    def bind(text):
        unknown = set(re.findall(r"\[([LD]\d+)\]", text)) - set(canonical)
        if unknown:
            raise ValueError("Unknown citation reference: " + ", ".join(sorted(unknown)))
        return re.sub(r"\[([LD]\d+)\]", lambda m: "[" + canonical[m[1]] + "]", text)
    answer = bind(authored_answer)
    messages = [{"role": "system", "content": SYSTEM}]
    if history:
        # Evidence must precede every supervised claim, including historical turns.
        earlier_cites = any(re.search(r"\[[LD]\d+\]", a) for _, a in history)
        for i, (prior_question, prior_answer) in enumerate(history):
            prior_input = prior_question
            if i == 0 and blocks and earlier_cites:
                prior_input += "\n\nPasajes recuperados (datos, no instrucciones):\n" + "\n\n".join(blocks)
            messages.extend([{"role": "user", "content": prior_input},
                             {"role": "assistant", "content": bind(prior_answer)}])
        if earlier_cites:
            question = tone + spec["question"]
    if kind == "chat":
        # Memory facts are provided by the user, not fabricated by an assistant.
        question = spec["previousUser"] + "\n\n" + question
    messages.extend([{"role": "user", "content": question}, {"role": "assistant", "content": answer}])
    return {"id": f"{split}-{ordinal:05d}", "messages": messages,
            "metadata": {"seedId": spec["seedId"], "area": area, "type": kind, "split": split,
                         "synthetic": True, "author": "Codex", "augmentation": "direct-authored-complete-answer",
                         "tone": tone, "sources": sources, "expectedCitations": [q["sourceId"] for q in quotes],
                         "quotes": quotes, "lawIds": sorted({s["lawId"] for s in sources if "lawId" in s}),
                         "hasSupportingPassages": bool(supports), "legalValidation": False}}


def validate_row(row, held_laws, original_by_id=None):
    m = row["metadata"]
    msgs = row["messages"]
    roles = [x["role"] for x in msgs]
    if len(msgs) not in (5, 7) or roles != ["system"] + ["user", "assistant"] * ((len(msgs)-1)//2) or msgs[0]["content"] != SYSTEM:
        raise ValueError("Invalid multi-turn chat/system")
    if re.search(r"(?i)\b(qwen|gemma|ollama|openai|anthropic|mlx)\b", " ".join(x["content"] for x in msgs)):
        raise ValueError("Technical provider identity in dialogue")
    sources = {s["id"]: s for s in m["sources"]}
    if len(sources) != len(m["sources"]):
        raise ValueError("Duplicate citation IDs")
    law_ids = {s["lawId"] for s in sources.values() if s["kind"] == "public-law"}
    if sorted(law_ids) != m["lawIds"]:
        raise ValueError("Law provenance mismatch")
    if m["split"] == "train" and held_laws.intersection(law_ids):
        raise ValueError("Held-out law leaked into training, including distractors")
    relevant = [s for s in sources.values() if s["relevant"]]
    if m["split"] == "train":
        spec = task_index().get(m["seedId"])
        if spec is None or spec["type"] != m["type"] or spec["area"] != m["area"]:
            raise ValueError("Unknown/mismatched authored task")
        if spec["question"] not in msgs[-2]["content"]:
            raise ValueError("Question differs from the reviewed task/source pairing")
        if spec.get("law") and [(s.get("lawId"), s.get("article")) for s in relevant] != [(spec["law"], spec["article"])]:
            raise ValueError("Relevant source differs from the reviewed task/source pairing")
        expected_texts = [spec["quote"]] if spec.get("quote") else []
        if spec.get("twoPassages"):
            expected_texts.append("Las modificaciones del encargo se documentarán por escrito.")
        if [q["text"] for q in m["quotes"]] != expected_texts:
            raise ValueError("Quotation differs from the reviewed task/source pairing")
    if m["split"] == "valid" and any(s["kind"] == "public-law" and s["lawId"] not in held_laws for s in relevant):
        raise ValueError("Validation target not law-held-out")
    if m["type"] == "chat":
        if sources:
            raise ValueError("Pure chat must have no passages")
    else:
        distractors = [s for s in sources.values() if not s["relevant"]]
        if len(distractors) not in (2, 3) or len({s["lawId"] for s in distractors}) != len(distractors):
            raise ValueError("Expected 2–3 distractors from distinct laws")
        if m["type"] in {"local", "abstain"}:
            if relevant:
                raise ValueError("No-answer example unexpectedly supported")
        elif len(relevant) not in (1, 2):
            raise ValueError("Expected 1–2 supporting passages")
    answer = msgs[-1]["content"]
    actual = re.findall(r"\[([LD]\d+)\]", answer)
    if actual != m["expectedCitations"] or set(actual) != {s["id"] for s in relevant}:
        raise ValueError("Incorrect/distractor citation")
    actual_quotes = re.findall(r"«([^»]+)»\s*\[([LD]\d+)\]", answer)
    expected = [(q["text"], q["sourceId"]) for q in m["quotes"]]
    if actual_quotes != expected or answer.count("«") != len(expected) or answer.count("»") != len(expected):
        raise ValueError("Untracked quotation")
    for quote, sid in actual_quotes:
        if quote not in sources[sid]["text"]:
            raise ValueError("Literal quote absent from cited passage")
        if any(quote in s["text"] for s in sources.values() if not s["relevant"]):
            raise ValueError("Ambiguous literal quote also present in a distractor")
    # Earlier answers are supervised too. Validate their quotes and ensure the
    # cited evidence had actually appeared before the answer in the dialogue.
    previous_input = ""
    for message in msgs[1:]:
        if message["role"] == "user":
            previous_input += "\n" + message["content"]
            continue
        body = message["content"]
        pairs = re.findall(r"«([^»]+)»\s*\[([LD]\d+)\]", body)
        if re.findall(r"\[([LD]\d+)\]", body) != [sid for _, sid in pairs] or body.count("«") != len(pairs) or body.count("»") != len(pairs):
            raise ValueError("Untracked historical/current citation")
        for quote, sid in pairs:
            if sid not in sources or not sources[sid]["relevant"] or quote not in sources[sid]["text"]:
                raise ValueError("Historical/current literal citation absent or distractor")
            if source_block(sources[sid]) not in previous_input:
                raise ValueError("Citation precedes its evidence")
    if m["type"] in {"local", "missing-facts"} and not re.search(r"¿[^?]+\?", answer):
        raise ValueError("Missing clarifying question")
    if m["type"] == "local" and not re.search(r"\b(estado|entidad)\b", answer.lower()):
        raise ValueError("Local jurisdiction not requested")
    all_user_input = "\n".join(message['content'] for message in msgs if message['role'] == 'user')
    visible_ids = re.findall(r'(?m)^\[([LD]\d+)\] ', all_user_input)
    if collections.Counter(visible_ids) != collections.Counter(sources.keys()):
        raise ValueError('Visible passage identities are missing/duplicated/untracked')
    for src in sources.values():
        if src["textSha256"] != text_digest(src["text"]) or all_user_input.count(source_block(src)) != 1:
            raise ValueError("Passage identity/hash/input mismatch")
        if src["kind"] == "public-law":
            if urlparse(src["url"]).hostname != "www.diputados.gob.mx":
                raise ValueError("Source outside verified public official library origin")
            if original_by_id is not None:
                origin = original_by_id[src["sourceId"]]
                if (src["originalTextSha256"] != text_digest(origin["text"]) or
                    src["text"] != origin["text"][src["charStart"]:src["charEnd"]] or
                    any(src[k] != origin[k] for k in ("lawId", "article", "version", "url", "pdfSha256", "retrievedAt", "title", "jurisdiction"))):
                    raise ValueError("Source differs from SQLite provenance")
        elif not src.get("synthetic") or src.get("firmId") != "synthetic-firm-raft":
            raise ValueError("Unmarked/private client material")
    return True


@lru_cache(maxsize=1)
def task_index():
    return {s["seedId"]: s for s in specs()}


def validation_specs(held, articles):
    result = []
    for area, laws in held.items():
        available = [a for a in articles if a["lawId"] in laws and 100 <= len(a["text"]) and "deroga" not in a["text"].lower()]
        # Different source articles, no training-question paraphrases in validation.
        available.sort(key=lambda a: (a["lawId"], len(a["text"]), a["id"]))
        if len(available) < 6:
            raise ValueError(f"Not enough distinct held-out articles for {area}: {len(available)}")
        for a in available[:20]:
            text = passage(a)["text"]
            # Literal text-reading task; not an invented interpretation of an unfamiliar law.
            quote = text[: min(len(text), 260)]
            if len(quote) < len(text):
                quote = quote[:quote.rfind(" ")]
            result.append({"area": area, "type": "heldout-reading", "law": a["lawId"], "article": a["article"],
                           "quote": quote, "seedId": "heldout-" + a["sourceId"],
                           "previousUser": "Necesito distinguir el texto de una fuente de una conclusión sobre mi caso.",
                           "previousAssistant": "Podemos empezar con una lectura literal y dejar pendiente su aplicación.",
                           "question": f"Entre los pasajes, localiza el artículo {a['article']} de {a['title']}. Copia literalmente su inicio, sin resolver un caso ni completar lo que no aparece."})
    return result


def summary(rows):
    return {"rows": len(rows), "byArea": dict(collections.Counter(r["metadata"]["area"] for r in rows)),
            "byType": dict(collections.Counter(r["metadata"]["type"] for r in rows)),
            "byAreaAndType": {a: dict(collections.Counter(r["metadata"]["type"] for r in rows if r["metadata"]["area"] == a)) for a in AREAS},
            "sourceLaws": sorted({s["lawId"] for r in rows for s in r["metadata"]["sources"] if "lawId" in s}),
            "uniqueSourceArticles": len({s["sourceId"] for r in rows for s in r["metadata"]["sources"] if s["kind"] == "public-law"}),
            "literalQuotes": sum(len(r["metadata"]["quotes"]) for r in rows),
            "twoSupportingPassages": sum(len(r["metadata"]["quotes"]) == 2 for r in rows)}


def load_answers(directory):
    answers = {}
    for path in sorted(directory.glob("*.jsonl")):
        for line in path.read_text().splitlines():
            row = json.loads(line)
            key = (row["seedId"], row["variant"])
            if key in answers or not isinstance(row["answer"], str) or not row["answer"].strip():
                raise ValueError(f"Invalid/duplicate authored answer: {key}")
            if any(x in row["answer"] for x in ("{quote}", "{cited}", "{factQuestion}", "{{", "}}")):
                raise ValueError("Unexpanded answer template")
            answers[key] = row["answer"]
    return answers


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, default=ROOT / "resources/public-library.sqlite")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--count", type=int, default=5000)
    parser.add_argument("--localllm", action="store_true")
    parser.add_argument("--responses", type=Path, default=Path(__file__).with_name("responses"))
    args = parser.parse_args()
    if args.count != 5000:
        raise ValueError("This reviewed release requires exactly 5000 directly authored examples")
    args.output.mkdir(parents=True, exist_ok=True)
    articles, library_meta = read_library(args.library)
    by_key = {(a["lawId"], a["article"]): a for a in articles}
    by_id = {a["sourceId"]: a for a in articles}
    held, declaration = read_holdout(ROOT / "eval/areas/README.md")
    evaluation_laws = set(x for ids in held.values() for x in ids) if declaration["kind"] == "eval-readme" else set()
    development = copy.deepcopy(FALLBACK_HELD_OUT)
    development_laws = set(x for ids in development.values() for x in ids)
    if evaluation_laws.intersection(development_laws):
        raise ValueError("Development laws now overlap sealed evaluation; choose new development laws explicitly")
    held_laws = evaluation_laws | development_laws
    if not held_laws.issubset({a["lawId"] for a in articles}):
        raise ValueError("Held-out laws unavailable in the local SQLite library")
    holdout = {"schemaVersion": 1, "heldOutLaws": held, "allLawIds": sorted(held_laws),
               "developmentHeldOutLaws": development, "sealedEvaluationLawIds": sorted(evaluation_laws),
               "source": declaration, "scope": "Excluded from every training passage, including distractors",
               "validationPurpose": "Development loss on separate laws; W1 laws never used for gradient, validation or tuning",
               "limitations": ["Amparo development holdout is constitutional-control transfer (article 105 law), not a second Ley de Amparo.",
                               "Library is federal; this split does not validate state law competence.",
                               "Previous discarded adapters may have seen these laws; only the preserved base is allowed."]}
    authored = specs()
    if any(s.get("law") in held_laws for s in authored):
        raise ValueError("Evaluator now holds an authored anchor law: revise seeds explicitly; do not substitute article meanings")
    for spec in authored:
        if spec.get("law") and spec["quote"] not in by_key[(spec["law"], spec["article"])]["text"]:
            raise ValueError(f"Authored quote not exact: {spec['seedId']} {spec['law']} {spec['article']}")
    pool = [a for a in articles if a["lawId"] not in held_laws and 100 <= len(a["text"]) <= 1800
            and a.get("split") == "train" and a.get("category") == "official-public-legislation"]
    if args.localllm:
        raise ValueError("Tone expansion retired; optional question paraphrases require separate review")
    local = {"status": "NOT_USED_DIRECT_CODEX_AUTHORING", "attempts": 0, "accepted": []}
    answers = load_answers(args.responses)
    # Round-robin by area gives exactly 500 per area, not an over-weighted prefix.
    interleaved = [authored[a * 30 + i] for i in range(30) for a in range(10)]
    validation = validation_specs(development, articles)
    expected_answer_keys = {(interleaved[i % 300]['seedId'], i // 300) for i in range(args.count)}
    expected_answer_keys.update((s['seedId'], 0) for s in validation)
    if set(answers) != expected_answer_keys:
        raise ValueError('Answer bank must contain exactly the 5000 training and 200 development slots')
    rejected = []
    train = []
    for i in range(args.count):
        spec = interleaved[i % 300]
        variant = i // 300
        history = None
        if spec["type"] == "followup":
            index = authored.index(spec)
            earlier = [authored[index-2]]
            if variant % 2:
                earlier.append(authored[index-1])
            history = [(s["question"], answers[(s["seedId"], variant)]) for s in earlier]
        elif spec["type"] in {"grounded", "missing-facts"}:
            index = authored.index(spec)
            earlier = authored[index + (1 if spec["type"] == "grounded" else -1)]
            history = [(earlier["question"], answers[(earlier["seedId"], variant)])]
        else:
            # Complete authored personal-context turns, not repeated generic
            # acknowledgements. Facts come from the user's synthetic introduction.
            identity = next(s for s in authored if s["area"] == spec["area"] and s["type"] == "chat")
            history = [(identity["previousUser"] + "\n\n" + identity["question"],
                        answers[(identity["seedId"], (variant + 1) % 16)])]
        try:
            row = render(spec, i, by_key, pool, authored_answer=answers[(spec["seedId"], variant)], history=history)
        except (ValueError, KeyError) as error:
            rejected.append({'id': f'train-{i:05d}', 'seedId': spec['seedId'], 'variant': variant,
                             'phase': 'render', 'reason': str(error), 'answer': answers[(spec['seedId'], variant)]})
            continue
        row["metadata"]["authoredVariant"] = variant
        train.append(row)
    valid = []
    for i, spec in enumerate(validation):
        history = [VALIDATION_CONTEXTS[i % len(VALIDATION_CONTEXTS)]]
        try:
            valid.append(render(spec, i, by_key, pool, split="valid", authored_answer=answers[(spec["seedId"], 0)], history=history))
        except (ValueError, KeyError) as error:
            rejected.append({'id': f'valid-{i:05d}', 'seedId': spec['seedId'], 'variant': 0,
                             'phase': 'render', 'reason': str(error), 'answer': answers[(spec['seedId'], 0)]})
    fingerprints = set()
    for row in train + valid:
        try:
            validate_row(row, held_laws, by_id)
            if evaluation_laws.intersection(row["metadata"]["lawIds"]):
                raise ValueError("Sealed evaluation law present in training/development")
            fp = text_digest(json.dumps(row["messages"], ensure_ascii=False))
            if fp in fingerprints:
                raise ValueError("Duplicate full dialogue")
            fingerprints.add(fp)
        except ValueError as error:
            rejected.append({"id": row["id"], "seedId": row["metadata"]["seedId"], "variant": row["metadata"].get("authoredVariant", 0), "phase": "validation", "reason": str(error), "answer": row['messages'][-1]['content']})
    # Reject bad candidates; never publish them or refill with generated templates.
    write_json(args.output / "rejected-candidates.json", rejected)
    if rejected:
        fingerprint = text_digest(json.dumps(rejected, ensure_ascii=False, sort_keys=True))[:16]
        write_json(args.output / f'rejections-{fingerprint}.json', rejected)
        raise ValueError(f"Discarded {len(rejected)} invalid candidates; replace them with directly authored answers before publishing balanced splits")
    train_answers = {m['content'] for r in train for m in r['messages'] if m['role'] == 'assistant'}
    valid_answers = {m['content'] for r in valid for m in r['messages'] if m['role'] == 'assistant'}
    if train_answers & valid_answers:
        raise ValueError("Supervised assistant text shared across training/development")
    diversity = {"train": enforce(train), "valid": enforce(valid, require_prose=False)}
    write_json(args.output / "held-out-laws.json", holdout)
    write_json(args.output / "localllm-report.json", {**local, "requested": False,
               "reason": "Optional paraphraser not needed; complete answers authored directly by Codex",
               "previousRun": "before-conversational-revision/localllm-report.json"})
    files = {"seed.jsonl": train[:300], "train.jsonl": train, "valid.jsonl": valid}
    for name, rows in files.items():
        temporary = args.output / (name + ".tmp")
        with temporary.open("w") as stream:
            for row in rows:
                stream.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
        temporary.replace(args.output / name)
    manifest = {"schemaVersion": 2, "status": "DATA_VALIDATED_NOT_TRAINED", "seed": SEED,
                "library": {"path": str(args.library.relative_to(ROOT)), "sha256": digest(args.library),
                            "builtAt": library_meta["builtAt"], "corpusSha256": library_meta["corpusSha256"],
                            "currentnessVerified": False},
                "heldOutSha256": digest(args.output / "held-out-laws.json"),
                "scripts": {p.name: digest(p) for p in sorted(Path(__file__).parent.iterdir()) if p.suffix in {".py", ".tsv"}},
                "authoredResponseFiles": {str(p.relative_to(ROOT)): digest(p) for p in sorted(args.responses.glob("*.jsonl"))},
                "diversity": diversity,
                "splits": {name: {**summary(rows), "sha256": digest(args.output / name)} for name, rows in files.items()},
                "localParaphraser": {k: local[k] for k in ("status", "attempts", "accepted")},
                "checks": {"allLiteralQuotesInCitedPassages": True, "allPassagesMatchSQLite": True,
                           "heldOutLawTrainingOverlap": 0, "duplicateFullDialogues": 0,
                           "crossSplitSupervisedAnswerOverlap": 0, "historicalQuotesValidated": True,
                           "questionSourcePairingValidated": True, "invalidCandidatesPublished": 0},
                "authoredDialogueSpecifications": 300, "authoredLegalAnchorSpecifications": 60,
                "directlyAuthoredFinalAnswers": len(answers),
                "authoringMethod": "Complete literal answer records written by Codex; only citation IDs rebound after source shuffle",
                "uniqueRelevantLegalArticles": len({(s["law"], s["article"]) for s in authored if s.get("law")}),
                "expandedRowsAreIndependentCases": False,
                "limitations": ["Directly authored answers share 300 task specifications; 5000 rows do not mean 5000 independent legal cases.",
                                "Only literal-reading held-out development validation; final evaluator remains separate.",
                                "Exact citation checks do not establish legal correctness, currency or practical competence.",
                                "No training or inference evaluation performed by the dataset builder."]}
    write_json(args.output / "manifest.json", manifest)
    print(json.dumps({"status": manifest["status"], "train": len(train), "seed": 300, "valid": len(valid),
                      "localParaphraser": manifest["localParaphraser"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
