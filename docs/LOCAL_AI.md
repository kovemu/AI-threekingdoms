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

- Low: ~7B-9B quantized
- Recommended: ~12B-14B quantized
- High: ~20B-32B quantized where hardware permits

The game should automatically choose a profile based on available RAM/VRAM.

For the current development machine target (RTX 3060 12GB), optimize the first prototype around a 12B-14B Q4-class model.

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
    "recommendedVramGb": 10
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
- model downloaded automatically when enabled/supported
- cache generated images by turn/event
- never regenerate an old image unless explicitly requested

Because image generation hardware requirements are higher, use graceful tiers:

1. capable GPU -> local scene generation
2. weaker hardware -> deterministic state board + prebuilt scene art
3. future optional cloud/free provider adapter if terms and reliability are acceptable

Do not make a paid API mandatory.

## Performance target

Narrative should begin streaming quickly.
Do not wait for the scene image before displaying text.
Generate scene art asynchronously after the turn state has committed.
