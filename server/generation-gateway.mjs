// H4: generation gateway. The local route is the only default. Remote
// destinations stay disabled until a matter policy, a validated detector and
// the owner's authorization exist. With remoteEnabled=false (the default) the
// gateway is a pure passthrough: policy is never read, classification never
// runs and no request option changes the local call. A remote route is taken
// only when the caller names scope AND destination AND the egress gate grants
// that exact envelope; without a grant the request fails closed and is NEVER
// retried locally or against another destination. The 'pseudonymized' category
// does not exist here: only the gate's 'public'/'synthetic' categories pass.
import {createEgressPolicy} from './egress-policy.mjs';

const failure = code => Object.assign(new Error('Ruta de generación no disponible.'), {name:'GenerationGatewayError', code});
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value);
const validScope = scope => scope && typeof scope === 'object' && !Array.isArray(scope) &&
  Object.keys(scope).length === 3 && ['workspaceId','matterId','threadId'].every(key => identifier(scope[key]));

export function createGenerationGateway({local, destinations = {}, getPolicy, classify, remoteEnabled = false} = {}) {
  // generate is validated at call time, not construction: engine doubles that
  // represent a model-less product (status/initialize/stop only) stay valid.
  if (!local || (local.generate !== undefined && typeof local.generate !== 'function')) throw failure('invalid_configuration');
  if (typeof remoteEnabled !== 'boolean') throw failure('invalid_configuration');
  // Optional lifecycle methods delegate only when the local route has them, so
  // partial test doubles keep their exact current behavior through the gateway.
  const lifecycle = {};
  for (const method of ['status','initialize','stop']) {
    if (local[method] !== undefined && typeof local[method] !== 'function') throw failure('invalid_configuration');
    if (typeof local[method] === 'function') lifecycle[method] = () => local[method]();
  }
  let gate = null;
  const remoteGate = () => {
    if (!remoteEnabled) throw failure('remote_disabled');
    if (typeof getPolicy !== 'function' || typeof classify !== 'function') throw failure('remote_unavailable');
    if (!gate) gate = createEgressPolicy({destinations, getPolicy, classify});
    return gate;
  };
  return Object.freeze({
    outputContract: local.outputContract,
    ...lifecycle,
    routeStatus() {
      return {local: true, remoteEnabled, destinations: remoteEnabled ? Object.keys(destinations).sort() : []};
    },
    async *generate(messages, options = {}) {
      // Read caller options exactly once; never invoke getters twice.
      if (typeof local.generate !== 'function') throw failure('invalid_configuration');
      const opts = options && typeof options === 'object' ? {...options} : {};
      const remote = opts.scope !== undefined || opts.destination !== undefined;
      if (!remote) {
        yield* local.generate(messages, options);
        return;
      }
      // Remote route: fail closed, no fallback. The gate owns policy,
      // classification, revalidation and audit for the whole envelope.
      if (!validScope(opts.scope) || !identifier(opts.destination)) throw failure('invalid_request');
      const gateOptions = {scope: Object.freeze({...opts.scope}), destination: opts.destination};
      if (opts.responseFormat !== undefined) gateOptions.responseFormat = opts.responseFormat;
      if (opts.outputSchema !== undefined) gateOptions.outputSchema = opts.outputSchema;
      if (opts.signal !== undefined) gateOptions.signal = opts.signal;
      yield* remoteGate().generate(messages, gateOptions);
    },
  });
}
