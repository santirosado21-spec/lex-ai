// Rejon.AI public radar envelope V0: deterministic offline parser, NOT a scraper or n8n connector.
// The input must come only from separately vetted PUBLIC acquisition adapters, never from case data.
import {createHash} from 'node:crypto';

const SOURCES=Object.freeze({
 dof:Object.freeze(['dof.gob.mx','www.dof.gob.mx']),
 sjf:Object.freeze(['sjf2.scjn.gob.mx','sjf.scjn.gob.mx'])
});
const OBS_KEYS=Object.freeze(['source','sourceUrl','title','publishedDate','observedAt','revision','digest']);
const SIGNAL_KEYS=Object.freeze(['source','state','observedAt']);
const ID_RE=/^[a-f0-9]{64}$/;
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_RE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const normal=value=>value.normalize('NFC').trim();
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const err=code=>{const x=Error('La observación pública no cumple el contrato del radar.');x.code=code;return x;};
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
function sourceName(value){
 if(typeof value!=='string'||!Object.hasOwn(SOURCES,value))throw err('UNKNOWN_PUBLIC_SOURCE');
 return value;
}
function utcDate(value){
 if(typeof value!=='string'||!DATE_RE.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||
    new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw err('INVALID_PUBLICATION_DATE');
 return value;
}
function utcStamp(value,now){
 if(!Number.isFinite(now))throw err('INVALID_CLOCK');
 if(typeof value!=='string'||!TIMESTAMP_RE.test(value)||Number.isNaN(Date.parse(value))||
    new Date(value).toISOString().replace('.000Z','Z')!==value.replace('.000Z','Z'))throw err('INVALID_OBSERVATION_TIME');
 const ms=Date.parse(value);
 if(ms>now+300_000)throw err('FUTURE_OBSERVATION');
 return value;
}
function safeSourceUrl(value,source){
 if(typeof value!=='string'||value.length>420)throw err('INVALID_SOURCE_URL');
 let parsed;
 try{parsed=new URL(value);}catch{throw err('INVALID_SOURCE_URL');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port||parsed.hash||
    !SOURCES[source].includes(parsed.hostname.toLowerCase()))throw err('UNAPPROVED_SOURCE_HOST');
 // V0 intentionally forbids query strings, until per-source legal IDs and redirect
 // semantics are reviewed. In particular, arbitrary URL parameters cannot carry firm data.
 if(parsed.search||parsed.pathname==='/'||/[%\x00-\x1f]/.test(parsed.pathname)||parsed.pathname.length>210)throw err('UNAPPROVED_SOURCE_PATH');
 return parsed.href;
}
function safeTitle(value){
 if(typeof value!=='string'||value.length>240||/[\x00-\x1f\x7f]/.test(value))throw err('INVALID_PUBLIC_TITLE');
 const title=normal(value);
 if(title.length<8)throw err('INVALID_PUBLIC_TITLE');
 return title;
}
export function normalizePublicRadarObservation(value,{now=Date.now()}={}){
 if(!exact(value,OBS_KEYS))throw err('INVALID_PUBLIC_ENVELOPE');
 if(!Number.isFinite(now))throw err('INVALID_CLOCK');
 const source=sourceName(value.source),sourceUrl=safeSourceUrl(value.sourceUrl,source);
 const title=safeTitle(value.title),publishedDate=utcDate(value.publishedDate);
 const observedAt=utcStamp(value.observedAt,now);
 if(Date.parse(publishedDate+'T00:00:00Z')>now+86_400_000)throw err('FUTURE_PUBLICATION');
 if(typeof value.revision!=='string'||!/^[a-zA-Z0-9._-]{1,80}$/.test(value.revision))throw err('INVALID_PUBLIC_REVISION');
 if(typeof value.digest!=='string'||!ID_RE.test(value.digest))throw err('INVALID_PUBLIC_DIGEST');
 const eventId=createHash('sha256').update([source,sourceUrl,value.revision,value.digest].join('\u001f'),'utf8').digest('hex');
 return {eventId,source,sourceUrl,title,publishedDate,observedAt,revision:value.revision,digest:value.digest,
  verification:'unverified',legalAccuracy:'not-evaluated',scope:'public-only'};
}
export function aggregatePublicRadarObservations(raw,{seen=[],now=Date.now()}={}){
 if(!Number.isFinite(now))throw err('INVALID_CLOCK');
 if(!Array.isArray(raw)||raw.length>200||!Array.isArray(seen)||seen.length>5_000)throw err('RADAR_BATCH_LIMIT');
 if(!seen.every(x=>typeof x==='string'&&ID_RE.test(x)))throw err('INVALID_SEEN_ID');
 const already=new Set(seen),fresh=[],duplicates=[];
 for(const entry of raw){
  const event=normalizePublicRadarObservation(entry,{now});
  if(already.has(event.eventId))duplicates.push(event.eventId);
  else{fresh.push(event);already.add(event.eventId);}
 }
 return {fresh,duplicates,observed:raw.length,mode:'report-only',action:'none'};
}
export function normalizePublicRadarSignal(value,{now=Date.now()}={}){
 if(!exact(value,SIGNAL_KEYS))throw err('INVALID_RADAR_SIGNAL');
 const source=sourceName(value.source);
 if(!['ok-empty','ok-observations','failed'].includes(value.state))throw err('INVALID_RADAR_SIGNAL_STATE');
 const observedAt=utcStamp(value.observedAt,now);
 return {source,state:value.state,observedAt,scope:'public-only'};
}
