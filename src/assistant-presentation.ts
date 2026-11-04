import type {EngineStatus} from './api';

/** Product copy is independent of provider names, identifiers and runtime diagnostics. */
const states:Record<string,{label:string;message:string}>={
 ready:{label:'LEX AI listo',message:'Tu asistente está preparado. Los documentos y las consultas se procesan en este equipo.'},
 starting:{label:'Preparando LEX AI',message:'Iniciando los componentes locales del asistente…'},
 preparing:{label:'Preparando LEX AI',message:'Preparando los recursos incluidos en la aplicación. No necesitas instalar otros programas.'},
 downloading:{label:'Descargando LEX AI',message:'Descargando los recursos del asistente. El modelo ligero ocupa aproximadamente 1,95 GB.'},
 verifying:{label:'Verificando LEX AI',message:'Comprobando la integridad de los archivos del asistente…'},
 stopped:{label:'LEX AI detenido',message:'Inicia LEX AI para conversar y trabajar con tus documentos.'},
 error:{label:'Revisar LEX AI',message:'No se pudo preparar el asistente local. Comprueba el espacio disponible y vuelve a intentarlo. Si faltan recursos, reinstala la aplicación completa.'},
 unsupported:{label:'Equipo no compatible',message:'Esta versión requiere macOS con Apple Silicon y al menos 8 GB de memoria. Rendimiento en el equipo mínimo pendiente de medición.'},
};
export function assistantPresentation(engine:EngineStatus){
 const state=engine.state||engine.status||(engine.ready?'ready':'stopped');
 return {state,...(states[state]||{label:'Estado no disponible',message:'Actualiza el estado de LEX AI para comprobar su disponibilidad.'})};
}
