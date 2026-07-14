# Minimum System Requirements

This project runs a fully localized AI Chess Coach, including a web UI, a Bun server (REST API + in-process orchestration), and a local LLM, all containerized via Docker.

## Hardware Requirements

*   **Processor:** Apple Silicon (M1/M2/M3/M4) or equivalent modern x86 CPU.
*   **Memory (RAM):** 16GB Unified Memory (Minimum). With the recommended commentary model (~291 MB), lighter hosts often work; keep headroom for Stockfish/lc0.
*   **Storage:** ~15GB free space if you pull Docker image weights + tablebases; much less for native host + commentary-only.

## Software Requirements

*   **OS:** macOS 13+, Linux, or Windows (WSL2).
*   **Containerization (Option A):** Docker Desktop or OrbStack (OrbStack highly recommended for Mac users for lower memory overhead).
*   **Native host (Option B):** Bun + Stockfish + lc0 + Ollama (see README).

## Local LLM Specifications

Commentary builds use an OpenAI-compatible local server (Ollama by default):

*   **Recommended commentary model:** `hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0` (~291 MB) — a `gemma-3-270m` fine-tune. Set `LLM_COMMENTARY_MODEL` to this.
*   **Fallback / general model (server default when commentary unset):** `qwen2.5:7b` (~4.7 GB at 4-bit). Heavier; only needed if you skip the commentary fine-tune.
*   **Max Context Window (Inputs):** ~8,192 to 16,384 tokens.
    *   *Note:* The chess harness (FEN + PGN history + coaching prompts) typically consumes less than 2,000 tokens per turn.

## Memory Budget Breakdown (16GB Total)

If you are experiencing out-of-memory (OOM) kills with a heavy general model, align Docker limits with something like:

1.  **Host OS (macOS/Linux):** ~4 GB
2.  **Docker Engine / VM:** ~2 GB
3.  **App Container (UI + Bun server):** ~1.5 GB
4.  **LLM (Weights + KV Cache):** ~1 GB with `chess-gemma-commentary`, or ~8.5 GB with Qwen 7B
