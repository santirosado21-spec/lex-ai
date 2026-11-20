import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {remedyCatalog,remedyPeriod,remedyReference,remedySuggestions,remedyAttachment} from '../server/corpus/remedy-index.mjs';
import {questionPassage,renderResearchNote,remedyResearch} from '../server/corpus/intake-research.mjs';
import {prepareFollowup,quotedRanges} from '../server/corpus/intake-followup.mjs';

test('AD_29-24 resolves eleven verified points and the physical page for each',()=>{
 const stages=remedyCatalog();assert.deepEqual(stages.map(s=>s.points.length),[2,4,5]);
 for(const stage of stages)for(const point of stage.points){
  const attachment=remedyAttachment(point.localUrl);assert.equal(attachment.type,'application/pdf');
  assert.equal('/fuentes/'+createHash('sha256').update(attachment.bytes).digest('hex')+'.pdf',point.localUrl);
 }
 assert.throws(()=>remedyReference(stages[1].sourceId,156));
 assert.throws(()=>remedyReference('ad29-final',156));
});
test('route time, scope, origin and gaps without using other investigations',()=>{
 const suggest=q=>remedySuggestions(q).map(r=>r.part);
 assert.deepEqual(suggest('AD_29-24 ¿qué cuota corresponde a la operación del 15 de junio de 2026?'),[298,306,386]);
 assert.equal(suggest('¿La cuota compensatoria de los perfiles huecos de aluminio cubre esta pieza?')[0],3);
 assert.equal(suggest('¿Qué exclusión de cuotas compensatorias hay para perfiles de aluminio de escaleras?')[0],156);
 assert.equal(suggest('¿Qué dice el punto 383 de AD_29-24?')[0],383);
 assert.deepEqual(suggest('¿Qué cuota corresponde a la operación del 22 de diciembre de 2026 de AD_29-24?'),[]);
 assert.deepEqual(suggest('¿Hay dumping de barras de aluminio en AD_28-24?'),[]);
 assert.deepEqual(suggest('¿Qué permiso declara el pedimento de barras de aluminio?'),[]);
 for(const [date,id] of [['2025-03-05','before'],['2025-03-06','inicio'],['2025-12-29','inicio'],['2025-12-30','preliminar'],['2026-04-30','interval'],['2026-09-04','interval'],['2026-09-05','final'],['2026-11-20','later']])assert.equal(remedyPeriod(date).id,id);
 assert.throws(()=>remedyPeriod('2026-02-30'));
});
test('a cloud excerpt from point 156 restores the complete technical conditions in the memo and follow-up',()=>{
 const stage=remedyCatalog()[2],ref=remedyReference(stage.sourceId,156);
 const note=questionPassage(null,{sourceId:stage.sourceId,part:156,angle:'excepciones'});
 const text=renderResearchNote(JSON.stringify({cita:ref.text.slice(0,90),solicitud:'¿Qué ficha técnica acredita el templado del perfil?'}),note);
 assert.ok(text.includes(ref.text)&&text.includes('0.15 mm a lo ancho.')&&text.includes(ref.summary));
 const src=remedyResearch(stage.sourceId,156);
 assert.equal(quotedRanges(src,text)[0].length,ref.text.length);
 const follow=prepareFollowup(src,quotedRanges(src,text),'control');
 assert.ok(follow.prompt.includes(ref.text)&&follow.prompt.includes(ref.summary));
 assert.equal(quotedRanges(src,text.replace('0.25 mm','0.05 mm')).length,0);
 assert.throws(()=>prepareFollowup(src,[{...quotedRanges(src,text)[0],length:50}],'control'));
});
