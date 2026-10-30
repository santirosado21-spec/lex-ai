const definitions=[
  ['legal-researcher','Investigador jurídico','Relaciona la pregunta con pasajes jurídicos autorizados.','Presenta alcance, fuentes, análisis y cuestiones pendientes. No declares vigencia confirmada.'],
  ['contract-reviewer','Revisor de contratos','Identifica obligaciones, ambigüedades y cláusulas que requieren revisión.','Distingue texto del contrato, inferencia y recomendación. Señala obligaciones, ambigüedades e información faltante sin inventar cláusulas.'],
  ['legal-drafter','Redactor jurídico','Prepara borradores sujetos a revisión profesional.','Redacta un borrador breve con campos pendientes explícitos. No inventes partes, fechas o cantidades. No presentes el borrador como documento aprobado.'],
  ['document-analyzer','Analista documental','Extrae y resume hechos presentes en documentos del asunto.','Resume hechos, fechas y obligaciones verificables. Señala datos ausentes.'],
  ['matter-assistant','Asistente de asuntos','Organiza los hechos e información pendiente de un asunto.','Organiza una cronología cuando existan fechas y lista información pendiente. No inventes plazos legales.'],
];
export const skills=definitions.map(([id,name,description,instructions])=>({
  id,name,description,instructions,version:'0.1.0',supportedJurisdictions:['MX-FED','MX-CMX'],
  supportedPracticeAreas:['civil','commercial','corporate','labor','tax','administrative','constitutional','litigation','international-trade','intellectual-property','compliance','other'],
  inputSchema:{type:'object',required:['matterId','question','skillId'],properties:{matterId:{type:'string'},question:{type:'string',minLength:3,maxLength:4000},skillId:{const:id}},additionalProperties:false},
  outputSchema:{type:'object',required:['analysis','citations'],properties:{analysis:{type:'string',maxLength:24000},citations:{type:'array',minItems:1,items:{type:'object',required:['sourceId','quote'],properties:{sourceId:{type:'string'},quote:{type:'string',minLength:12}}}}},additionalProperties:false},
  requiredTools:['matter-retrieval','legal-retrieval','local-inference'],permissions:['read:current-matter','read:approved-legal-corpus'],
  validationRules:['known-source-identifiers','verbatim-source-quotes','no-uncited-paragraphs','same-matter-only','human-legal-review-required'],
  evaluationTests:['cross-matter-denied','unknown-citation-rejected','invented-quotation-rejected','empty-evidence-abstains'],
  errorHandling:'Fail closed on missing evidence, invalid structured output, unknown citations or runtime failure. Never fabricate a fallback answer.',
}));

export function validateSkillInput(payload) {
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Solicitud inválida.');
  if(Object.keys(payload).some(k=>!['matterId','question','skillId'].includes(k)))throw new Error('Campo no admitido en la solicitud de análisis.');
  const skill=skills.find(s=>s.id===payload.skillId);
  if(!skill)throw new Error('Skill desconocida.');
  if(typeof payload.question!=='string'||payload.question.trim().length<3||payload.question.length>4000)throw new Error('La pregunta debe tener entre 3 y 4000 caracteres.');
  return skill;
}

// Only used after strict JSON.parse fails. It does not repair grammar or values.
export function escapeLiteralJsonStringControls(input) {
  let quoted=false,escaped=false,count=0,output='';
  for(const character of input){
    const control=character.charCodeAt(0)<0x20;
    if(quoted){
      if(escaped){if(control)throw new Error('Control literal después de una barra JSON: no se puede normalizar.');output+=character;escaped=false;continue;}
      if(character==='\\'){output+=character;escaped=true;continue;}
      if(character==='"'){output+=character;quoted=false;continue;}
      if(control){const replacement={'\n':'\\n','\r':'\\r','\t':'\\t'}[character];if(!replacement)throw new Error('Control JSON no permitido.');output+=replacement;count++;continue;}
    }else if(character==='"')quoted=true;
    output+=character;
  }
  return {text:output,count};
}

export function validateModelOutput(raw,evidence) {
  const cleaned=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed;let formatNormalization={type:'none',count:0};
  try{parsed=JSON.parse(cleaned);}catch{
    try{const normalized=escapeLiteralJsonStringControls(cleaned);if(!normalized.count)throw new Error('No normalizable controls');parsed=JSON.parse(normalized.text);formatNormalization={type:'json-string-control-escaping',count:normalized.count};}
    catch{throw new Error('El modelo no devolvió el JSON requerido. El análisis no se guardó.');}
  }
  const forbiddenControl=value=>typeof value==='string'&&/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
  if(forbiddenControl(parsed?.analysis)||(Array.isArray(parsed?.citations)&&parsed.citations.some(c=>forbiddenControl(c?.sourceId)||forbiddenControl(c?.quote))))throw new Error('La respuesta contiene controles de texto no permitidos.');
  if(!parsed || typeof parsed.analysis!=='string' || parsed.analysis.length<20 || parsed.analysis.length>24000 || !Array.isArray(parsed.citations) || !parsed.citations.length || parsed.citations.length>20)throw new Error('Respuesta incompleta o fuera del esquema de la skill.');
  if(Object.keys(parsed).some(k=>!['analysis','citations'].includes(k)))throw new Error('Respuesta fuera del esquema de la skill.');
  const allowed=new Map(evidence.map(s=>[s.id,s]));
  const citations=[];
  const normalize=s=>s.normalize('NFC').replace(/\s+/g,' ').trim();
  for(const citation of parsed.citations) {
    if(!citation||typeof citation!=='object'||Array.isArray(citation)||Object.keys(citation).some(k=>!['sourceId','quote'].includes(k)))throw new Error('Cita fuera del esquema de la skill.');
    const source=allowed.get(citation.sourceId);
    if(!source || typeof citation.quote!=='string'||citation.quote.length<12 || citation.quote.length>1600 || !normalize(source.text).includes(normalize(citation.quote)))throw new Error('La respuesta contiene una referencia o cita textual no verificable. El análisis no se guardó.');
    if(!parsed.analysis.includes(`[${source.id}]`))throw new Error('La cita no está vinculada al texto del análisis.');
    if(!citations.some(c=>c.id===source.id))citations.push({...source,quote:citation.quote});
  }
  const refs=[...parsed.analysis.matchAll(/\[([^\]\n]+)\]/g)].map(m=>m[1]);
  if(!refs.length || refs.some(id=>!citations.some(c=>c.id===id)))throw new Error('El análisis usa identificadores de cita no autorizados.');
  const paragraphs=parsed.analysis.split(/\n\s*\n/).map(p=>p.trim()).filter(p=>p.length>60);
  if(paragraphs.some(p=>!refs.some(id=>p.includes(`[${id}]`))))throw new Error('Hay párrafos sin referencia verificable.');
  return {text:parsed.analysis,citations,validation:{status:'source-checked',citationIntegrity:true,formatNormalization,legalAccuracy:'not-evaluated',requiresLawyerReview:true,checks:['source IDs belong to retrieved evidence','quoted text appears in source','substantive paragraphs carry a reference']}};
}
