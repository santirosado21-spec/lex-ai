"""Write an auditable base-versus-adapter held-out comparison in Markdown."""
import argparse
import json
from pathlib import Path

METRICS=('strictJson','schema','grounded','analysisCited','noInjectionCanary','passed')

def pct(value):return f'{100*value:.1f}%'
def fence(value):return '````json\n'+value.strip()+'\n````'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-report',required=True)
    parser.add_argument('--candidate-report',required=True)
    parser.add_argument('--heldout',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--min-examples',type=int,default=10)
    args=parser.parse_args()
    base=json.loads(Path(args.base_report).read_text());candidate=json.loads(Path(args.candidate_report).read_text())
    if base.get('contract')!=candidate.get('contract'):raise ValueError('Reports do not share an identical evaluation contract')
    paired=list(zip(base.get('cases',[]),candidate.get('cases',[])))
    if any(left.get('id')!=right.get('id')for left,right in paired):raise ValueError('Case ordering differs between reports')
    rows={json.loads(line)['metadata']['id']:json.loads(line)for line in Path(args.heldout).read_text().splitlines()if line}
    changed=[(left,right,rows[left['id']])for left,right in paired if left.get('raw')!=right.get('raw')]
    if len(changed)<args.min_examples:raise ValueError(f'Only {len(changed)} actual changed outputs; need {args.min_examples}')
    lines=['# Comparación de modelo — candidato experimental','',
           '> **No validado jurídicamente.** Esta comparación usa prompts públicos/sintéticos reservados; mide protocolo de salida, citas literales y abstención léxica, no exactitud profesional ni vigencia.','',
           '## Contrato de evaluación','',f'- Base: `{base["contract"]["base"]["repo"]}` @ `{base["contract"]["base"]["revision"]}`','',f'- Casos reservados: {len(paired)}; selección por materia/tarea: {base["contract"].get("perMatterTaskRequested",0)}.','',
           '## Resultado global','', '| Métrica | Base | Adaptador | Cambio |','|---|---:|---:|---:|']
    for metric in METRICS:
        before=base['metrics'][metric];after=candidate['metrics'][metric]
        lines.append(f'| {metric} | {pct(before)} | {pct(after)} | {after-before:+.3f} |')
    lines.extend(['', '## Resultado por materia (held-out)','', '| Materia | Casos | Base pass | Adaptador pass | Base grounded | Adaptador grounded |','|---|---:|---:|---:|---:|---:|'])
    for matter in sorted(candidate.get('perMatter',{})):
        before=base['perMatter'][matter];after=candidate['perMatter'][matter]
        lines.append(f'| {matter} | {after["cases"]} | {pct(before["passed"])} | {pct(after["passed"])} | {pct(before["grounded"])} | {pct(after["grounded"])} |')
    lines.extend(['','## Diez salidas que cambiaron',''])
    for number,(before,after,row) in enumerate(changed[:args.min_examples],1):
        prompt=json.loads(row['messages'][1]['content']);sources=prompt.get('sources',[])
        source='Sin fuente (caso de abstención)'if not sources else f'`{row["metadata"]["sourceUrl"]}` — {sources[0]["text"]}'
        lines.extend([f'### {number}. {after["matter"]} / {after["task"]}', '', f'**Prompt:** {prompt["question"]}', '', f'**Fuente pública / sintética:** {source}', '', '**Base:**', '', fence(before['raw']), '', '**Adaptador:**', '', fence(after['raw']), ''])
    lines.extend(['## Interpretación limitada','',f'Hubo {len(changed)} de {len(paired)} salidas textualmente diferentes. Una diferencia no prueba mejora jurídica; el único criterio técnico es la tabla anterior. El adaptador es un **candidato experimental**, conserva la base intacta y requiere evaluación humana antes de cualquier uso jurídico.',''])
    destination=Path(args.output);destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text('\n'.join(lines))

if __name__=='__main__':main()
