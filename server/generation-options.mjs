// Explicitly override registry sampling defaults: quoting evidence must not be
// discouraged by a model's creative-writing repetition/presence penalties.
export const LOCAL_SAMPLING = Object.freeze({
  temperature: 0, seed: 20261101,
  presence_penalty: 0, frequency_penalty: 0, repeat_penalty: 1,
  top_k: 40, top_p: 0.9, min_p: 0,
  num_thread: 2, num_batch: 64,
});
export const generationOptions = (contextLength = 4096, outputTokens = 512) => ({
  ...LOCAL_SAMPLING, num_ctx: contextLength, num_predict: outputTokens,
});
