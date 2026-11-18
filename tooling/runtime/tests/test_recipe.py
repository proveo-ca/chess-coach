# SPEC: _spec/gate-closure.puml
from pathlib import Path
import json
import unittest


class RecipeTests(unittest.TestCase):
    def test_selected_recipe_uses_only_pinned_stages_offline_steps_and_image_contained_init(
        self,
    ):
        source = Path("tooling/runtime/Dockerfile").read_text()
        stages = [line for line in source.splitlines() if line.startswith("FROM ")]
        self.assertEqual(len(stages), 3)
        self.assertTrue(all("@sha256:" in stage for stage in stages))
        steps = [line for line in source.splitlines() if line.startswith("RUN ")]
        self.assertEqual(len(steps), 3)
        self.assertTrue(all(line.startswith("RUN --network=none ") for line in steps))
        self.assertIn("--locked --offline --jobs 2", source)
        self.assertIn("--frozen-lockfile --production --ignore-scripts", source)
        self.assertIn('ENTRYPOINT ["/sbin/chess-init", "-g", "--"]', source)
        self.assertIn("USER 1000:1000", source)
        self.assertNotIn("curl ", source)
        self.assertNotIn("--privileged", source)
        self.assertNotIn("VOLUME ", source)

    def test_all_six_reference_outputs_keep_the_exact_registered_fixed_paths(self):
        source = Path("tooling/runtime/Dockerfile").read_text()
        entries = json.loads(Path("tooling/reference-entrypoints.json").read_text())[
            "entries"
        ]
        self.assertEqual(len(entries), 6)
        for entry in entries:
            self.assertIn(
                f"/build/reference-output/{entry} /app/reference/{entry}", source
            )


if __name__ == "__main__":
    unittest.main()
