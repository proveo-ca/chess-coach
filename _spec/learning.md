# Episodic learning contract

The episodic-objective reference is `packages/training/src/learner_math.rs` at `b4b241481fb12de4a7344e6dba8eda775af57675`. Preserve its objective, not its handwritten gradient engine. The operator explicitly replaced its feature meanings and linear model with the versioned 2,271-coordinate encoder and small Burn MLP.

For each sampled decision, compute F64 policy logits with the frozen episode model, then Burn's `log_softmax(logits / temperature)`. Sum selected log probabilities without averaging over decisions. Freeze the baseline before the episode.

```text
temperature = 1
learning_rate = 0.001
L2 = 0.0001
advantage = return - frozen_baseline
objective = -advantage * sum(selected_log_probability) + (L2/2) * sum(trainable_parameters^2)
```

Accept returns -1, 0 or 1 and finite baselines in [-1, 1]. Each selected index must belong to its validated 1–512-row batch. Bound sampled decisions to 64. An empty episode produces no objective and no L2-only update. A nonempty zero-advantage episode still includes L2.

Burn owns stable log-softmax, tensor reductions, differentiation and SGD. The crate provides the objective, not an admission controller, rollout scheduler or authorization to train on game data. A caller must use an F64-configured device, initialize training parameters on its autodiff device, keep the episode model frozen and skip the optimizer when the objective is absent. Model-version ownership and stale-episode rejection remain requirements for the future rollout/learner bridge.

L2 includes both weight matrices and the hidden bias. Controlled MLP fixtures preserve the independent synthetic SGD golden and account for hidden-weight regularization in policy-objective tests. The tests check summed gradients, frozen-baseline scaling, L2, empty episodes, bounds, state-dependent rankings, seeded initialization and hidden-layer learning. They do not establish full-game learning, sampling equivalence, model improvement, host isolation or training readiness.
