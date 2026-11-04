"""Reproducible lexical diversity, length and random complete-dialogue audit."""
import argparse
import collections
import json
import random
import re
import unicodedata
from pathlib import Path


def normalize(text):
    return ' '.join(re.findall(r'\w+', unicodedata.normalize('NFKC', text).casefold()))


def prose_only(text):
    return re.sub(r'«[^»]*»\s*\[[LD]\d+\]', '', text)


def measure(rows):
    answers = [r['messages'][-1]['content'] for r in rows]
    if not answers:
        raise ValueError('Cannot measure empty corpus')
    normalized = [normalize(a) for a in answers]
    prose = [normalize(prose_only(a)) for a in answers]
    openings = collections.Counter(' '.join(a.split()[:5]) for a in normalized)
    # Count short answers conservatively: remove quoted source punctuation first.
    # The quoted passage counts as one sentence when it is the entire answer.
    sentences = [len([s for s in re.split(r'(?<=[.!?])\s+', re.sub(r'«[^»]*»', 'CITA', a)) if s.strip()]) for a in answers]
    paragraphs = collections.Counter(len(re.split(r'\n\s*\n', a.strip())) for a in answers)
    paragraph_sizes = [len(re.split(r'\n\s*\n', a.strip())) for a in answers]
    words = sorted(len(a.split()) for a in answers)
    turns = collections.Counter(len(r['messages']) - 1 for r in rows)
    return {
        'rows': len(rows), 'uniqueFinalAnswers': len(set(answers)),
        'uniqueFinalRatio': len(set(answers)) / len(answers),
        'uniqueNormalizedFinalAnswers': len(set(normalized)),
        'uniqueNormalizedFinalRatio': len(set(normalized)) / len(answers),
        'uniqueProseWithoutQuotes': len(set(prose)),
        'uniqueProseWithoutQuotesRatio': len(set(prose)) / len(answers),
        'maxFiveWordOpeningCount': openings.most_common(1)[0][1],
        'maxFiveWordOpeningRatio': openings.most_common(1)[0][1] / len(answers),
        'topFiveWordOpenings': openings.most_common(10),
        'oneOrTwoSentenceAnswers': sum(1 <= s <= 2 for s in sentences),
        'briefOneOrTwoSentenceAnswers': sum(1 <= s <= 2 and p == 1 and len(a.split()) <= 60
                                            for a, s, p in zip(answers, sentences, paragraph_sizes)),
        'twoToFourParagraphAnswers': sum(v for k, v in paragraphs.items() if 2 <= k <= 4),
        'twoToFourParagraphAtLeast40Words': sum(2 <= p <= 4 and len(a.split()) >= 40
                                               for a, p in zip(answers, paragraph_sizes)),
        'developedThreeToFourParagraphAtLeast90Words': sum(3 <= p <= 4 and len(a.split()) >= 90
                                                           for a, p in zip(answers, paragraph_sizes)),
        'paragraphCounts': dict(sorted(paragraphs.items())),
        'wordCounts': {'min': words[0], 'median': words[len(words)//2], 'p90': words[int(len(words)*.9)], 'max': words[-1]},
        'dialogueMessageCountsExcludingSystem': dict(sorted(turns.items())),
        'userAssistantExchangeCounts': dict(sorted(collections.Counter((len(r['messages'])-1)//2 for r in rows).items())),
    }


def enforce(rows, *, require_prose=True):
    metrics = measure(rows)
    if metrics['uniqueNormalizedFinalRatio'] < .9:
        raise ValueError('Final-answer diversity below 90%')
    if metrics['maxFiveWordOpeningRatio'] > .03:
        raise ValueError('Five-word opening exceeds 3%')
    if require_prose and metrics['uniqueProseWithoutQuotesRatio'] < .9:
        raise ValueError('Prose diversity below 90% after removing quotes and citation IDs')
    if require_prose and (metrics['briefOneOrTwoSentenceAnswers'] < .1 * len(rows) or metrics['twoToFourParagraphAnswers'] < .2 * len(rows)):
        raise ValueError('Insufficient short / multi-paragraph answer variety')
    if require_prose and metrics['developedThreeToFourParagraphAtLeast90Words'] < .04 * len(rows):
        raise ValueError('Insufficient developed answers: require at least 4% with 3–4 paragraphs and 90+ words')
    return metrics


def load(path):
    return [json.loads(line) for line in Path(path).read_text().splitlines()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=Path('artifacts/raft'))
    args = parser.parse_args()
    before = args.data / 'before-conversational-revision'
    report = {'definitions': {
        'opening': 'First five Unicode words, NFKC, lowercase; punctuation ignored',
        'prose': 'Full answer after removing every literal guillemet quote and its citation ID, NFKC/lowercase/punctuation ignored',
        'short': 'One or two sentence units; punctuation inside source quotations ignored',
        'turn': 'One user or assistant message; system excluded',
        'limits': 'Lexical checks do not establish semantic variety or legal correctness'},
        'before': {s: measure(load(before / f'{s}.jsonl')) for s in ('train','valid')},
        'after': {s: measure(load(args.data / f'{s}.jsonl')) for s in ('train','valid')},
        'sample': {'population': 'train.jsonl', 'seed': 2026110304, 'method': 'random.Random(seed).sample(rows, 3), no filtering/reselection'}}
    rows = load(args.data / 'train.jsonl')
    sample = random.Random(report['sample']['seed']).sample(rows, 3)
    report['sample']['ids'] = [r['id'] for r in sample]
    (args.data/'diversity-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    (args.data/'random-complete-examples.json').write_text(json.dumps(sample,ensure_ascii=False,indent=2)+'\n')
    md = ['# Tres diálogos completos elegidos al azar', '', 'Semilla 2026110304; muestra uniforme sin reemplazo de train.jsonl. Se incluyen todos los mensajes y pasajes; no hay selección por calidad.', '']
    for row in sample:
        md += [f"## {row['id']} — {row['metadata']['area']} / {row['metadata']['type']}", '']
        for m in row['messages']:
            md += [f"### {m['role']}", '', m['content'], '']
    (args.data/'random-complete-examples.md').write_text('\n'.join(md))
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
