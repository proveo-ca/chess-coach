// SPEC: _spec/apps/arena/burn-compat.puml
import { featureManifestV3 } from "../../../../packages/starchess-training/src/feature/manifest.ts";
import { createStartupArtifactContext } from "../../../../packages/starchess-training/src/economic/ownedKernel.ts";

const manifest = featureManifestV3(createStartupArtifactContext());
process.stdout.write(JSON.stringify(manifest));
