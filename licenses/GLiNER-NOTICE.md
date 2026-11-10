# GLiNER algorithm references

The experimental local ONNX adapter reimplements tokenization/preprocessing and decoding algorithms with references to urchade/GLiNER, commit `2dc5de256b81668bbd9b3a8a8e5ce62765750551` (Apache-2.0). Upstream: https://github.com/urchade/GLiNER . Files consulted: gliner/data_processing/{tokenizer,processor,utils}.py and gliner/decoding/decoder.py. The accompanying GLiNER-LICENSE.txt preserves the upstream license. Local modifications use tokenizers/NumPy/ONNX Runtime, original UTF-16 mapping and explicit developer-only bounds; upstream numerical equivalence is not established.

Model selection is separately pinned in resources/privacy-detector-candidate-v2.json. Weights are not bundled in Git or automatically downloaded in the app. Knowledgator model card declares Apache-2.0; the underlying Ettin encoder card declares MIT. This inventory does not turn an experimental candidate into a validated product.
