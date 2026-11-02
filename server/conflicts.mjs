const MAX_NAME_LENGTH=200;
export const MAX_MATTERS_SCANNED=500;
const MAX_LEVENSHTEIN_LENGTH=120;
const MAX_LEVENSHTEIN_DISTANCE=4;

const compare=(a,b)=>a<b?-1:a>b?1:0;

/** Normalizes a party name for a local lexical comparison; it is not entity resolution. */
export function normalizePartyName(value){
  const plain=value.normalize('NFC').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/gu,' ').trim();
  // Remove only trailing Mexican corporate designations after punctuation has been made whitespace.
  return plain.replace(/(?:\s|^)(?:s\s*a(?:\s+de\s+c\s*v)?|s\s*de\s+r\s*l(?:\s+de\s+c\s*v)?|a\s*c|s\s*c)\s*$/u,'').trim();
}

function validateRequest(request){
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(key=>key!=='name'&&key!=='matterId'))throw new Error('Parámetros de conflicto inválidos.');
  if(typeof request.name!=='string'||request.name.trim().length<2||request.name.length>MAX_NAME_LENGTH)throw new Error('Nombre para conflicto inválido.');
  if(request.matterId!==undefined&&(typeof request.matterId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(request.matterId)))throw new Error('Asunto para conflicto inválido.');
  const candidate=request.name.trim();const normalized=normalizePartyName(candidate);
  if(normalized.length<2)throw new Error('Nombre para conflicto inválido.');
  return {candidate,normalized};
}

function tokens(value){return [...new Set(value.split(' ').filter(Boolean))];}

function boundedLevenshtein(a,b,limit=MAX_LEVENSHTEIN_DISTANCE){
  if(Math.abs(a.length-b.length)>limit)return null;
  let previous=Array.from({length:b.length+1},(_,index)=>index);
  for(let row=1;row<=a.length;row++){
    const current=[row];let lowest=row;
    for(let column=1;column<=b.length;column++){
      const cost=a[row-1]===b[column-1]?0:1;
      const distance=Math.min(previous[column]+1,current[column-1]+1,previous[column-1]+cost);
      current.push(distance);if(distance<lowest)lowest=distance;
    }
    if(lowest>limit)return null;
    previous=current;
  }
  return previous[b.length]<=limit?previous[b.length]:null;
}

function similarity(candidate,matched){
  const candidateTokens=tokens(candidate),matchedTokens=tokens(matched);
  const matchedSet=new Set(matchedTokens);
  const shared=candidateTokens.filter(token=>matchedSet.has(token)).length;
  const tokenScore=shared?Number((2*shared/(candidateTokens.length+matchedTokens.length)).toFixed(3)):0;
  const canMeasureEditDistance=candidate.length<=MAX_LEVENSHTEIN_LENGTH&&matched.length<=MAX_LEVENSHTEIN_LENGTH;
  const distance=canMeasureEditDistance?boundedLevenshtein(candidate,matched):null;
  const editScore=distance===null?0:Number((1-distance/Math.max(candidate.length,matched.length)).toFixed(3));
  // A shared distinctive token is a review lead; edit distance catches typos such as "Comercial" / "Comercal".
  if(tokenScore<0.6&&distance===null)return null;
  return Math.max(tokenScore,editScore);
}

function partyFields(matter){
  const fields=[];
  for(const field of ['client','counterparty','otherParty','title'])if(typeof matter[field]==='string')fields.push([field,matter[field]]);
  for(const field of ['counterparties','otherParties','parties'])if(Array.isArray(matter[field])){
    for(const value of matter[field])if(typeof value==='string')fields.push([field,value]);
  }
  return fields;
}

/**
 * Performs bounded lexical matching over already workspace-scoped matter metadata.
 * Callers must enforce workspace ownership before passing matters to this function.
 */
export function checkConflict(request,matters){
  const {candidate,normalized}=validateRequest(request);
  if(!Array.isArray(matters))throw new Error('Asuntos para conflicto inválidos.');
  const scoped=matters.filter(matter=>matter&&typeof matter==='object'&&typeof matter.id==='string'&&matter.id!==request.matterId)
    .sort((a,b)=>compare(a.id,b.id));
  const scanned=scoped.slice(0,MAX_MATTERS_SCANNED);
  const matches=[];
  for(const matter of scanned){
    for(const [field,matchedText] of partyFields(matter)){
      const normalizedMatched=normalizePartyName(matchedText);
      if(normalizedMatched.length<2)continue;
      if(normalizedMatched===normalized){
        matches.push({matterId:matter.id,matterTitle:typeof matter.title==='string'?matter.title:'',field,matchedText,kind:'exact',score:1});
        continue;
      }
      const score=similarity(normalized,normalizedMatched);
      if(score!==null)matches.push({matterId:matter.id,matterTitle:typeof matter.title==='string'?matter.title:'',field,matchedText,kind:'similar',score});
    }
  }
  matches.sort((a,b)=>compare(a.kind,b.kind)||b.score-a.score||compare(normalizePartyName(a.matterTitle),normalizePartyName(b.matterTitle))||compare(a.matterId,b.matterId)||compare(a.field,b.field)||compare(a.matchedText,b.matchedText));
  return {candidate,matches,truncated:scoped.length>scanned.length};
}
