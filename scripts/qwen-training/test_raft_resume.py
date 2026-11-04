"""Real MLX checkpoint/RNG regression without loading any base model."""
import tempfile
import unittest
from pathlib import Path

import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
from mlx.utils import tree_flatten, tree_unflatten

from raft_train import verify_seeded_rng_resume


class ResumeTests(unittest.TestCase):
    def test_readonly_rng_state_verification_rejects_advanced_state(self):
        mx.random.seed(731)
        saved = {str(i): mx.array(x) for i, x in enumerate(mx.random.state)}
        mx.eval(saved)
        verify_seeded_rng_resume(saved, mx.random.state)
        mx.eval(mx.random.uniform(shape=(4,)))
        with self.assertRaisesRegex(ValueError, "reconstruction mismatch"):
            verify_seeded_rng_resume(saved, mx.random.state)
        with self.assertRaisesRegex(ValueError, "layout"):
            verify_seeded_rng_resume({}, mx.random.state)

    def test_seed_replay_and_adam_checkpoint_match_uninterrupted_updates(self):
        def initialize():
            mx.random.seed(401)
            model = nn.Linear(3, 2)
            optimizer = optim.Adam(learning_rate=1e-3)
            optimizer.init(model.trainable_parameters())
            mx.eval(model.parameters(), optimizer.state)
            return model, optimizer

        x = mx.array([[.2, .3, .4], [.7, -.4, .1]])
        y = mx.array([[.1, .8], [-.1, .2]])

        def update(model, optimizer):
            loss, grads = nn.value_and_grad(model, lambda m: ((m(x) - y) ** 2).mean())(model)
            optimizer.update(model, grads)
            mx.eval(loss, model.parameters(), optimizer.state)

        model, optimizer = initialize()
        update(model, optimizer)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            mx.save_safetensors(str(path / "model.safetensors"), dict(tree_flatten(model.parameters())))
            mx.save_safetensors(str(path / "optimizer.safetensors"), {k: mx.array(v) for k, v in tree_flatten(optimizer.state)})
            rng = {str(i): v for i, v in enumerate(mx.random.state)}
            mx.save_safetensors(str(path / "random.safetensors"), rng)
            update(model, optimizer)
            update(model, optimizer)
            resumed, restored_optimizer = initialize()
            resumed.load_weights(str(path / "model.safetensors"))
            restored_optimizer.state = tree_unflatten(list(mx.load(str(path / "optimizer.safetensors")).items()))
            verify_seeded_rng_resume(mx.load(str(path / "random.safetensors")), mx.random.state)
            self.assertEqual(int(restored_optimizer.step.item()), 1)
            update(resumed, restored_optimizer)
            update(resumed, restored_optimizer)
            for (_, expected), (_, actual) in zip(tree_flatten(model.parameters()), tree_flatten(resumed.parameters())):
                self.assertTrue(bool(mx.array_equal(actual, expected).item()))
            self.assertEqual(int(restored_optimizer.step.item()), 3)


if __name__ == "__main__":
    unittest.main()
