/**
 * Deterministic, local lexical comparison for document versions.
 *
 * The bounds deliberately apply before alignment.  Myers' algorithm is O(ND),
 * but an unrestricted edit distance is still expensive for wholly unrelated
 * documents.  A capped fallback is therefore reported as truncated rather than
 * attempting an unbounded comparison.
 */
export const COMPARE_LIMITS=Object.freeze({maxCharacters:400_000,maxParagraphs:5_000,maxEditDistance:1_200,maxWordTokens:2_000});

const normalized=value=>value.normalize('NFC').replace(/\s+/gu,' ').trim();
const same=(a,b)=>normalized(a)===normalized(b);

function boundedText(value) {
  if(typeof value!=='string')throw new TypeError('El texto a comparar debe ser una cadena.');
  let text=value,truncated=false;
  if(text.length>COMPARE_LIMITS.maxCharacters){text=text.slice(0,COMPARE_LIMITS.maxCharacters);truncated=true;}
  let paragraphs=text.split(/\r?\n\s*\r?\n/gu).filter(paragraph=>normalized(paragraph));
  if(paragraphs.length>COMPARE_LIMITS.maxParagraphs){paragraphs=paragraphs.slice(0,COMPARE_LIMITS.maxParagraphs);truncated=true;}
  return {paragraphs,truncated};
}

/** Returns a shortest edit script, or null when the configured work cap is reached. */
function myers(a,b,equal=same,maxDistance=COMPARE_LIMITS.maxEditDistance) {
  const n=a.length,m=b.length,max=Math.min(n+m,maxDistance);
  const offset=max+1,span=2*max+3,v=new Int32Array(span),trace=[];
  for(let d=0;d<=max;d++){
    for(let k=-d;k<=d;k+=2){
      const index=offset+k;
      const down=k===-d||(k!==d&&v[index-1]<v[index+1]);
      let x=down?v[index+1]:v[index-1]+1,y=x-k;
      while(x<n&&y<m&&equal(a[x],b[y])){x++;y++;}
      v[index]=x;
      if(x>=n&&y>=m){trace.push(v.slice());return rebuild(trace,a,b,equal,offset);}
    }
    trace.push(v.slice());
  }
  return null;
}

function rebuild(trace,a,b,equal,offset) {
  let x=a.length,y=b.length;const edits=[];
  for(let d=trace.length-1;d>0;d--){
    const previous=trace[d-1],k=x-y,index=offset+k;
    const previousK=k===-d||(k!==d&&previous[index-1]<previous[index+1])?k+1:k-1;
    const previousX=previous[offset+previousK],previousY=previousX-previousK;
    while(x>previousX&&y>previousY){edits.push({type:'equal',a:a[--x],b:b[--y]});}
    if(x===previousX)edits.push({type:'added',b:b[--y]});
    else edits.push({type:'removed',a:a[--x]});
  }
  while(x>0&&y>0){edits.push({type:'equal',a:a[--x],b:b[--y]});}
  while(x>0)edits.push({type:'removed',a:a[--x]});
  while(y>0)edits.push({type:'added',b:b[--y]});
  return edits.reverse();
}

const wordTokens=text=>text.match(/\S+(?:\s+|$)|\s+/gu)??[];
function wordDiff(a,b) {
  const before=wordTokens(a),after=wordTokens(b);
  if(before.length+after.length>COMPARE_LIMITS.maxWordTokens)return {words:[{type:'removed',text:a},{type:'added',text:b}],truncated:true};
  const edits=myers(before,after,same);
  if(!edits)return {words:[{type:'removed',text:a},{type:'added',text:b}],truncated:true};
  return {words:edits.map(edit=>({type:edit.type,text:edit.type==='added'?edit.b:edit.a})),truncated:false};
}

const criticalPattern=/(?:\$\s*\d[\d,._\s]*|\b\d[\d,._]*\s*(?:%|(?:mxn|usd|pesos?|d[oó]lares?|por\s+ciento|d[ií]as?|mes(?:es)?|a[nñ]os?)\b)|\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b|\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}\b|\b(?:plazo|d[ií]as?|fecha|vencimiento)\b)/giu;
const criticalTerms=text=>[...text.matchAll(criticalPattern)].map(match=>match[0].trim()).filter(Boolean);
function criticalChanges(a,b) {
  const before=criticalTerms(a),after=criticalTerms(b);
  const remainingAfter=[...after],removed=[];
  for(const term of before){const index=remainingAfter.findIndex(candidate=>normalized(candidate)===normalized(term));if(index>=0)remainingAfter.splice(index,1);else removed.push({type:'removed',text:term});}
  const remainingBefore=[...before],added=[];
  for(const term of after){const index=remainingBefore.findIndex(candidate=>normalized(candidate)===normalized(term));if(index>=0)remainingBefore.splice(index,1);else added.push({type:'added',text:term});}
  return [...removed,...added];
}

function paragraphsFromEdits(edits) {
  const paragraphs=[];
  for(let i=0;i<edits.length;i++){
    const edit=edits[i];
    if(edit.type==='equal'){paragraphs.push({type:'equal',a:edit.a,b:edit.b});continue;}
    if(edit.type==='removed'&&edits[i+1]?.type==='added'){
      const next=edits[++i],diff=wordDiff(edit.a,next.b);
      paragraphs.push({type:'changed',a:edit.a,b:next.b,words:diff.words,_truncated:diff.truncated});continue;
    }
    paragraphs.push(edit.type==='removed'?{type:'removed',a:edit.a}:{type:'added',b:edit.b});
  }
  return paragraphs;
}

/**
 * Compare two texts without model calls or I/O.  `truncated` means either an
 * input limit or alignment cap was reached; the returned output is a safe,
 * deterministic partial/fallback comparison, not a complete review.
 */
export function compareTexts(a,b) {
  const left=boundedText(a),right=boundedText(b);
  let truncated=left.truncated||right.truncated;
  let edits=myers(left.paragraphs,right.paragraphs);
  if(!edits){
    truncated=true;
    edits=[...left.paragraphs.map(a=>({type:'removed',a})),...right.paragraphs.map(b=>({type:'added',b}))];
  }
  const paragraphs=paragraphsFromEdits(edits);
  for(const paragraph of paragraphs){if(paragraph._truncated)truncated=true;delete paragraph._truncated;}
  const stats={added:0,removed:0,changed:0,equal:0,similarity:0};
  for(const paragraph of paragraphs)stats[paragraph.type]++;
  stats.similarity=Number((stats.equal/Math.max(left.paragraphs.length,right.paragraphs.length,1)).toFixed(6));
  const criticalChanges=[];
  for(const paragraph of paragraphs){
    if(paragraph.type==='changed')criticalChanges.push(...criticalChangesForParagraph(paragraph));
    // A deleted or inserted clause is the largest possible change to its figures and dates.
    else if(paragraph.type==='removed')criticalChanges.push(...wholeParagraphTerms(paragraph.a,'removed'));
    else if(paragraph.type==='added')criticalChanges.push(...wholeParagraphTerms(paragraph.b,'added'));
  }
  return {paragraphs,stats,criticalChanges,truncated};
}

function criticalChangesForParagraph(paragraph) {return criticalChanges(paragraph.a,paragraph.b);}
const wholeParagraphTerms=(text,type)=>criticalTerms(text).map(term=>({type,text:term}));
