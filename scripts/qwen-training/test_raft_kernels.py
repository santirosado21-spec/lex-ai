"""Tiny real-MLX regression for the backward-path failure, without base weights."""
import unittest
import mlx.core as mx
import mlx.nn as nn
from mlx.utils import tree_flatten
from mlx_lm.models.qwen3_5 import GatedDeltaNet, TextModelArgs
from raft_train import BACKWARD_PROBE_TOKENS, bounded_projection_loss, checkpointed_delta_update, enable_training_kernels


@unittest.skipUnless(mx.metal.is_available(), "CustomKernel regression requires Metal")
class TrainingKernelTests(unittest.TestCase):
    def test_recurrence_chunks_preserve_outputs_final_state_and_all_cross_boundary_gradients(self):
        from mlx_lm.models.gated_delta import gated_delta_update
        mx.random.seed(28)
        q, k = [mx.random.normal((2, 9, 1, 4)) * .1 for _ in range(2)]
        v = mx.random.normal((2, 9, 2, 3)) * .1
        a, b = [mx.random.normal((2, 9, 2)) * .1 for _ in range(2)]
        values = (q, k, v, a, b, mx.zeros((2,)), mx.zeros((2,)), mx.ones((2, 2, 3, 4)) * .1)
        chunked = checkpointed_delta_update(gated_delta_update, 4)
        for mask in [None, mx.array([[True, False, True] * 3, [False, True, True] * 3])]:
            def loss(update, *inputs):
                output, state = update(*inputs, mask=mask, use_kernel=False, allow_neg_eigval=True)
                return output.sum() + state.sum() * .25
            expected, expected_grads = mx.value_and_grad(lambda *x: loss(gated_delta_update, *x), argnums=tuple(range(8)))(*values)
            actual, actual_grads = mx.value_and_grad(lambda *x: loss(chunked, *x), argnums=tuple(range(8)))(*values)
            mx.eval(expected, actual, expected_grads, actual_grads)
            self.assertTrue(bool(mx.allclose(actual, expected, atol=1e-5, rtol=1e-5).item()))
            for gradient, reference in zip(actual_grads, expected_grads):
                self.assertTrue(bool(mx.allclose(gradient, reference, atol=1e-5, rtol=1e-5).item()))
            # Also compare both outputs when the initial state is implicit zero.
            left = gated_delta_update(*values[:7], mask=mask, use_kernel=False)
            right = chunked(*values[:7], mask=mask, use_kernel=False)
            mx.eval(left, right)
            for actual, expected in zip(left, right):
                self.assertTrue(bool(mx.allclose(actual, expected, atol=1e-5, rtol=1e-5).item()))

    def test_chunked_projection_matches_full_supervised_loss_and_hidden_gradients(self):
        # CPU checks the token-weighted objective tightly. Metal changes GEMM
        # tiling with chunk size, so also bound its measured rounding difference.
        for device, tolerance, relative in [(mx.cpu, 1e-5, 1e-5), (mx.gpu, 1e-3, 2e-3)]:
            with mx.stream(device):
                mx.random.seed(42)
                hidden = mx.random.normal((1, 41, 8))
                head = nn.Embedding(17, 8)
                head.freeze()
                positions = list(range(0, 41, 2))
                targets = [(i * 3) % 17 for i in range(len(positions))]
                reference = mx.value_and_grad(lambda states: nn.losses.cross_entropy(
                    head.as_linear(states[:, mx.array(positions), :]).astype(mx.float32),
                    mx.array([targets]), reduction="mean"))
                expected_value, expected_grads = reference(hidden)
                for size in [1, 2, 16]:
                    value, grads = mx.value_and_grad(lambda states: bounded_projection_loss(
                        states, positions, targets, head.as_linear, size))(hidden)
                    mx.eval(value, grads, expected_value, expected_grads)
                    self.assertTrue(bool(mx.allclose(value, expected_value, atol=tolerance, rtol=relative).item()))
                    self.assertTrue(bool(mx.allclose(grads, expected_grads, atol=tolerance, rtol=relative).item()))

    def test_backward_probe_uses_differentiable_full_attention_not_short_vector_kernel(self):
        length = len(BACKWARD_PROBE_TOKENS) - 1
        q = mx.ones((1, 1, length, 256))
        gradient = mx.value_and_grad(lambda x: mx.fast.scaled_dot_product_attention(
            x, x, x, scale=1 / 16, mask="causal").sum())
        value, grads = gradient(q)
        mx.eval(value, grads)
        self.assertTrue(bool(mx.isfinite(value).item()))
        self.assertTrue(bool(mx.all(mx.isfinite(grads)).item()))

    def test_eval_kernel_reproduces_missing_vjp_and_training_mode_has_finite_gradients(self):
        mx.random.seed(31)
        model = GatedDeltaNet(TextModelArgs(hidden_size=8, linear_num_value_heads=1,
            linear_num_key_heads=1, linear_key_head_dim=32, linear_value_head_dim=32))
        inputs = mx.ones((1, 3, 8))
        gradient = nn.value_and_grad(model, lambda m, x: m(x).sum())
        model.eval()
        with self.assertRaisesRegex(ValueError, "CustomKernel"):
            value, grads = gradient(model, inputs)
            mx.eval(value, grads)
        enable_training_kernels(model)
        value, grads = gradient(model, inputs)
        mx.eval(value, grads)
        self.assertTrue(model.training)
        self.assertTrue(bool(mx.isfinite(value).item()))
        flat = tree_flatten(grads)
        self.assertTrue(flat)
        self.assertTrue(all(bool(mx.all(mx.isfinite(g)).item()) for _, g in flat))
        self.assertTrue(any(bool(mx.any(g != 0).item()) for _, g in flat))


if __name__ == "__main__":
    unittest.main()
