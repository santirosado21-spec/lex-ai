import {createOpenAiKeychain} from './providers/openai-keychain.mjs';
import {createOpenAiProvider} from './providers/openai.mjs';

const sample = [{role:'user', content:'Prueba técnica con datos ficticios. Responde únicamente con la palabra LISTO.'}];
const messages = {
 missing_credential:'La clave de OpenAI no está disponible en el Llavero de este equipo.',
 auth:'OpenAI rechazó la clave o no dio acceso al modelo de prueba.',
 quota:'OpenAI indicó que la cuota o el crédito no está disponible.',
 busy:'Ya hay una prueba en curso.',
 budget_exhausted:'Se alcanzó el límite de tres intentos de esta sesión.',
};

export function createCloudDemo({
 getApiKey = createOpenAiKeychain({enabled:true}).getApiKey,
 fetchImpl,
} = {}) {
 const provider = createOpenAiProvider({
  enabled:true, getApiKey, fetchImpl, model:'gpt-6-luna',
  maxCalls:3, maxOutputTokens:64, maxTotalTokens:1500, reasoningEffort:'none',
 });
 return async function run({signal} = {}) {
  try {
   let answer = '';
   for await (const chunk of provider.generate(sample, {signal})) answer += chunk;
   if (answer.trim() !== 'LISTO') throw new Error('unexpected_demo_output');
   return {connected:true};
  } catch (error) {
   const message = Object.hasOwn(messages, error?.code) ? messages[error.code] : 'La prueba de nube no se completó.';
   throw new Error(message);
  }
 };
}
