# DevBuddy English

Voice-first English practice for Brazilian technology professionals. The Gemini branch uses Python, FastAPI and the Google Gen AI SDK with the Gemini Live API.

## Requirements
- Windows 10/11
- Python 3.11+
- Google AI Studio API key with access to a Gemini Live model
- Chrome or Edge with microphone permission

Google AI Plus and Gemini API billing/quota are separate; confirm the model's current free-tier eligibility and limits in AI Studio.

## Run locally on Windows
1. Create a key at https://aistudio.google.com/apikey.
2. Copy `.env.example` to `.env` and set `GOOGLE_API_KEY`.
3. Double-click `start-devbuddy.bat`, or use PowerShell:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".[dev]"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

4. Open http://localhost:8000 and allow microphone access.

## Architecture
- `app/main.py`: FastAPI routes and WebSocket bridge to Gemini Live.
- `app/config.py`: typed, validated environment configuration.
- `app/prompts.py`: centralized tutoring instructions and scenario/personality maps.
- `public/`: static browser UI and PCM audio capture/playback.
- `tests/`: unit tests.
- `pyproject.toml`: dependency and Ruff/Pytest configuration.

## Engineering practices
- API key remains server-side in `.env`; `.gitignore` excludes secrets and virtual environments.
- Pydantic Settings for environment config; typed Python functions and modular prompt construction.
- Ruff linting/import sorting and Pytest unit tests.
- Localhost-only binding by default; user-facing errors avoid returning provider details or secrets.
- No accounts, database, saved conversation history or production deployment in this MVP.

## Audio notes
The browser sends mono 16-bit PCM at 16 kHz through a local WebSocket; the server forwards audio to Gemini Live and streams back 24 kHz PCM audio. This branch uses ScriptProcessorNode for MVP compatibility; replace it with AudioWorklet before production.

## Official references
- https://ai.google.dev/gemini-api/docs/live
- https://ai.google.dev/gemini-api/docs/live-api/capabilities
- https://ai.google.dev/gemini-api/docs/pricing
