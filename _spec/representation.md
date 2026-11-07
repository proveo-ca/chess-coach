# Versioned observation/action representation

## Contract

The operator approved replacing the estimator-dependent 418 meanings and the linear scorer. The new contract is `chess-coach.features.v1`. Old checkpoints are incompatible. Do not migrate the enemy-economic estimator, calibration artifacts, ownership kernel or float-hex codec.

`schemas/feature-layout.json` defines 2,271 values per candidate:

```text
state  = 26 board planes * 64 squares + 15 scalars = 1679
action = 4 ordered slots * 148 values              = 592
total  = 2271
```

The board planes encode own units, currently observed enemies, last enemy sightings and age, lit/dark-revealed/ever-lit masks, own mines, own siege mode and confirmed own-unit paid/replacement values. Scalars encode normalized own resources and witnessed economic totals. No channel estimates an unseen enemy bank or queries simulator state.

For black, flip ranks while preserving files. Both sides advance toward increasing relative rank. Flatten planes in channel-major, then file-major square order. Each ordered action slot carries presence, kind, timing, origin, optional destination, optional spawn choice and optional promotion choice. An absent slot has presence 0 and zero categorical values. That is a defined inactive-action mask, not padding missing features.

Candidate validation checks syntax, side and bounded action cardinality. It is not full game legality. The separately versioned bounded enumerator now applies recipient-local append, resource and own-dependency checks. It does not query hidden simulator blockers. `encodeFeatures` returns a fresh caller-owned Float64Array and leaves input JSON unchanged.

## Model

The operator selected standard Burn Linear(2271,32) -> ReLU -> Linear(32,1), with a seeded default hidden initializer and zero, bias-free output head. Initial candidate logits are all zero, while hidden parameters remain nonzero. Callers seed the configured device before initialization; constructors do not reset a shared RNG. F64, summed episodic REINFORCE, frozen baseline, SGD and native records remain.

A plain linear scorer of `[state, action]` would lose the shared state term under candidate softmax. The nonlinear model can reverse candidate preferences with state. Tests use an explicit XOR-shaped parameter fixture to verify this capacity, and a seeded synthetic optimizer test verifies reproducibility and hidden-layer learning after the initial output-head step. These tests do not prove game improvement or host-budget admission.

Standard JSON model configuration binds feature version, input dimension, hidden width, architecture and exact native-record SHA-256. Requests carry the same feature version. Burn validates native tensor compatibility before scoring. Neither metadata nor a checkpoint hash authenticates the producer or authorizes training.

## Community interfaces

- OpenSpiel player observations/information state: https://openspiel.readthedocs.io/en/latest/concepts.html
- PettingZoo observations/action masks: https://pettingzoo.farama.org/tutorials/custom_environment/3-action-masking/
- Burn supported modules: https://burn.dev/books/burn/building-blocks/module.html

These guide interface design; neither OpenSpiel nor PettingZoo is added as a dependency or claimed to implement StarChess.
