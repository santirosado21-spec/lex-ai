#!/usr/bin/env python3
"""Fuse only the seven trained attention projections into dense weights.

Explicitly executing this helper loads MLX/GPU. Importing it does not. Frozen
experts and all other projections keep their existing quantized representation.
"""
import argparse
import importlib.metadata
import json
import os
from pathlib import Path

EXPECTED_MODULES = {
    f"language_model.model.layers.{layer}.self_attn.{projection}"
    for layer in (26, 27, 28, 29)
    for projection in (("q_proj",) if layer == 29 else ("q_proj", "v_proj"))
}


def require_expected_modules(names):
    if set(names) != EXPECTED_MODULES or len(names) != len(EXPECTED_MODULES):
        raise ValueError("Selective fusion requires exactly the seven trained layer 26–29 q/v modules")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--adapter-path", required=True, type=Path)
    parser.add_argument("--save-path", required=True, type=Path)
    args = parser.parse_args()
    base, adapter, output = [path.resolve() for path in (args.model, args.adapter_path, args.save_path)]
    if not base.is_dir() or not adapter.is_dir() or output.exists():
        raise ValueError("Existing local base/adapter and a new output directory are required")
    if output.is_relative_to(base) or output.is_relative_to(adapter):
        raise ValueError("Fusion output must be separate from its inputs")
    if importlib.metadata.version("mlx-lm") != "0.32.2":
        raise ValueError("Selective fusion is pinned to MLX-LM 0.32.2")
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1")
    import mlx.core as mx
    import mlx.nn as nn
    from mlx.utils import tree_unflatten
    from mlx_lm.tuner.lora import LoRALinear
    from mlx_lm.utils import load, save

    recommended = mx.device_info()["max_recommended_working_set_size"]
    mx.set_memory_limit(min(recommended, 19 * 1024**3))
    mx.set_cache_limit(256 * 1024**2)
    model, tokenizer, config = load(str(base), adapter_path=str(adapter), return_config=True,
                                     trust_remote_code=False, tokenizer_config={"trust_remote_code": False})
    modules = [(name, module) for name, module in model.named_modules() if hasattr(module, "fuse")]
    require_expected_modules([name for name, _ in modules])
    replacements, details = [], []
    for name, module in modules:
        if not isinstance(module, LoRALinear) or not isinstance(module.linear, nn.QuantizedLinear):
            raise ValueError(f"Unexpected adapted module type: {name}")
        quant = module.linear
        if (quant.bits, quant.group_size, quant.mode) != (4, 64, "affine"):
            raise ValueError(f"Unexpected adapted projection quantization: {name}")
        dense = module.fuse(dequantize=True)
        if isinstance(dense, nn.QuantizedLinear) or not mx.issubdtype(dense.weight.dtype, mx.floating):
            raise ValueError(f"Fusion did not produce dense floating-point weights: {name}")
        mx.eval(dense.parameters())
        replacements.append((name, dense))
        details.append({"module": name, "shape": list(dense.weight.shape), "dtype": str(dense.weight.dtype),
                        "originalQuantization": {"bits": quant.bits, "groupSize": quant.group_size, "mode": quant.mode}})
        mx.clear_cache()
    model.update_modules(tree_unflatten(replacements))
    del modules, replacements
    # Do not call dequantize_model and do not remove global quantization config.
    # MLX/Ollama identify the remaining quantized modules by their companions.
    save(output, base, model, tokenizer, config, donate_model=False)
    report = {"schemaVersion": 1, "precision": "adapted-dense/rest-unchanged", "mlxLmVersion": "0.32.2",
              "modules": sorted(details, key=lambda value: value["module"]), "moduleCount": len(details),
              "peakMemoryGB": mx.get_peak_memory() / 1e9,
              "globalDequantization": False, "qualityStatus": "requires-evaluation"}
    (output / "fusion-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
