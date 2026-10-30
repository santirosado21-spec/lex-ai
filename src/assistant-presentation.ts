import type {EngineStatus} from './api';

/** Product copy is independent of provider names, identifiers and runtime diagnostics. */
const states:Record<string,{label:string;message:string}>={
 ready:{label:'LEX AI listo',message:'Tu asistente está preparado. Los documentos y las consultas se procesan en este equipo.'},
 starting:{label:'Preparando LEX AI',message:'Iniciando los componentes locales del asistente…'},
 downloading:{label:'Descargando LEX AI',message:'Descargando los componentes necesarios. La preparación inicial puede requerir hasta 16 GB.'},
 verifying:{label:'Verificando LEX AI',message:'Comprobando la integridad de los archivos del asistente…'},
 stopped:{label:'LEX AI detenido',message:'Prepara LEX AI para comenzar a trabajar con tus documentos.'},
 error:{label:'Revisar LEX AI',message:'No se pudo preparar el asistente local. Comprueba la conexión inicial y el espacio disponible; después vuelve a intentarlo.'},
 unsupported:{label:'Equipo no compatible',message:'Esta versión requiere macOS con Apple Silicon y al menos 24 GB de memoria unificada.'},
};
export function assistantPresentation(engine:EngineStatus){
 const state=engine.state||engine.status||(engine.ready?'ready':'stopped');
 return {state,...(states[state]||{label:'Estado no disponible',message:'Actualiza el estado de LEX AI para comprobar su disponibilidad.'})};
}
