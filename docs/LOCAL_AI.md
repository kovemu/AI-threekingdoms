# Local AI — Zero-Configuration Requirement

## User experience requirement

A normal player must not need to:
- install Ollama,
- install Python,
- find a GGUF model,
- select a provider,
- paste an API key,
- edit environment variables.

Desired flow:

```
Install game
-> launch
-> game checks local capability
-> missing model downloads automatically
-> runtime starts silently
-> player begins roleplay
```

## Text inference

Recommended implementation:

### Runtime
Bundle a llama.cpp-compatible native sidecar with the desktop application.

The application owns:
- runtime launch/stop,
- GPU offload detection,
- model path,
- context settings,
- health checks,
- fallback configuration.

Do not depend on a separately installed Ollama service for the shipping default.

### Model tiers

Keep model names configurable in a manifest rather than hard-coding one vendor model.

Initial target profiles:

- Low: ~3B-4B quantized for very weak hardware / CPU fallback
- Default: ~7B-9B quantized
- High: ~12B-14B quantized where hardware permits

The game should automatically choose a profile based on available RAM/VRAM.

### Shipping hardware target

The primary optimization target is now **8GB VRAM**, not 12GB.

Design target:
- Windows
- NVIDIA-class GPU with 8GB VRAM
- 16GB system RAM minimum
- 32GB system RAM recommended

Optimize the default experience around a **7B-9B Q4-class GGUF model** with a moderate context window and aggressive prompt/state compression.

The game should remain playable on lower hardware through:
- smaller quantized model,
- partial CPU offload,
- reduced context window,
- lower token budget,
- optional disabling of local scene generation.

Do not assume the user owns a 12GB+ GPU.

## Automatic model acquisition

Use a model manifest:

```json
{
  "text": {
    "id": "default-roleplay-model",
    "format": "gguf",
    "url": "",
    "sha256": "",
    "minimumRamGb": 16,
    "recommendedVramGb": 8
  }
}
```

On first launch:
1. detect model,
2. if absent show one simple progress screen,
3. download,
4. verify SHA-256,
5. start runtime,
6. continue automatically.

This is setup handled by the game, not configuration handled by the player.

## Image generation

Image generation is optional to the core turn transaction but central to presentation.

Architecture:
- `SceneImageProvider` interface
- local backend preferred
- model downloaded automatically only when the hardware profile supports it
- cache generated images by turn/event
- never regenerate an old image unless explicitly requested

Because image generation competes for VRAM with text inference, the 8GB target must use graceful fallback behavior:

1. capable GPU -> local scene generation, with text model unloaded or memory-released when necessary
2. constrained 8GB GPU -> deterministic STATE_BOARD + lightweight/prebuilt scene art by default
3. future optional free/cloud provider adapter if terms and reliability are acceptable

Gameplay must never require a paid image API.

## Performance target

Narrative should begin streaming quickly.
Do not wait for the scene image before displaying text.
Generate scene art asynchronously after the turn state has committed.
Keep the core roleplay playable even if scene generation is disabled.
