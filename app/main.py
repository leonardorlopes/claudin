import asyncio
import base64
import binascii
import logging
from contextlib import suppress
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types

from app.config import get_settings
from app.prompts import build_system_instruction

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"
logger = logging.getLogger("devbuddy")
settings = get_settings()

app = FastAPI(title="DevBuddy English API", version="0.2.0")
app.mount("/static", StaticFiles(directory=PUBLIC_DIR), name="static")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(PUBLIC_DIR / "index.html")


@app.get("/api/health")
async def health() -> JSONResponse:
    return JSONResponse(
        {
            "status": "ok",
            "provider": "gemini-live",
            "model": settings.gemini_live_model,
            "api_key_configured": bool(settings.google_api_key),
        }
    )


def _session_config(options: dict[str, Any]) -> dict[str, Any]:
    """Return the smallest explicit configuration for an audio-to-audio session."""
    instruction = build_system_instruction(
        personality=options.get("personality", "direct"),
        level=options.get("level", "basic"),
        scenario=options.get("scenario", "aws"),
        explanation_language=options.get("explanationLanguage", "help"),
    )
    return {
        "response_modalities": ["AUDIO"],
        "system_instruction": instruction,
        "input_audio_transcription": {},
        "output_audio_transcription": {},
        "speech_config": {
            "voice_config": {
                "prebuilt_voice_config": {"voice_name": "Aoede"},
            },
        },
    }


@app.websocket("/ws/live")
async def live_session(websocket: WebSocket) -> None:
    # The server is intended for localhost development only. Reject cross-origin
    # browser connections to reduce accidental exposure of a local API key/quota.
    origin = websocket.headers.get("origin", "")
    allowed_origins = {
        f"http://localhost:{settings.port}",
        f"http://127.0.0.1:{settings.port}",
    }
    if origin and origin not in allowed_origins:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    if not settings.google_api_key:
        await websocket.send_json(
            {"type": "error", "message": "Configure GOOGLE_API_KEY no arquivo .env."}
        )
        await websocket.close(code=1011)
        return

    try:
        first_message = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        if first_message.get("type") != "start":
            await websocket.send_json({"type": "error", "message": "Mensagem inicial inválida."})
            await websocket.close(code=1008)
            return

        client = genai.Client(api_key=settings.google_api_key)
        model = settings.gemini_live_model
        config = _session_config(first_message.get("options") or {})

        async with client.aio.live.connect(model=model, config=config) as session:
            await websocket.send_json({"type": "ready", "model": model})
            await session.send_realtime_input(
                text=(
                    "Start the conversation now. Greet the learner briefly and ask exactly "
                    "one simple opening question for the selected technology conversation."
                )
            )

            async def browser_to_model() -> None:
                while True:
                    message = await websocket.receive_json()
                    kind = message.get("type")
                    if kind == "audio":
                        try:
                            pcm = base64.b64decode(message.get("data", ""), validate=True)
                        except (binascii.Error, ValueError):
                            await websocket.send_json(
                                {"type": "error", "message": "Chunk de áudio inválido."}
                            )
                            continue
                        if pcm:
                            await session.send_realtime_input(
                                audio=types.Blob(
                                    data=pcm,
                                    mime_type="audio/pcm;rate=16000",
                                )
                            )
                    elif kind == "text":
                        text = str(message.get("text", ""))[:1000].strip()
                        if text:
                            await session.send_realtime_input(text=text)
                    elif kind == "stop":
                        return

            async def model_to_browser() -> None:
                async for response in session.receive():
                    content = response.server_content
                    if content:
                        input_transcription = content.input_transcription
                        if input_transcription and input_transcription.text:
                            await websocket.send_json(
                                {"type": "transcript", "role": "user", "text": input_transcription.text}
                            )
                        output_transcription = content.output_transcription
                        if output_transcription and output_transcription.text:
                            await websocket.send_json(
                                {"type": "transcript", "role": "assistant", "text": output_transcription.text}
                            )
                        if content.interrupted:
                            await websocket.send_json({"type": "interrupted"})
                        if content.turn_complete:
                            await websocket.send_json({"type": "turn_complete"})

                        model_turn = content.model_turn
                        if model_turn:
                            for part in model_turn.parts or []:
                                if part.inline_data and part.inline_data.data:
                                    audio_bytes = part.inline_data.data
                                    await websocket.send_json(
                                        {
                                            "type": "audio",
                                            "data": base64.b64encode(audio_bytes).decode("ascii"),
                                            "mimeType": part.inline_data.mime_type or "audio/pcm;rate=24000",
                                        }
                                    )
                    if response.go_away:
                        await websocket.send_json(
                            {"type": "notice", "message": "A sessão de voz está prestes a terminar."}
                        )

            tasks = {
                asyncio.create_task(browser_to_model()),
                asyncio.create_task(model_to_browser()),
            }
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            for task in done:
                exception = task.exception()
                if exception:
                    raise exception
            for task in pending:
                with suppress(asyncio.CancelledError):
                    await task
    except WebSocketDisconnect:
        logger.info("Browser disconnected from live session")
    except asyncio.TimeoutError:
        with suppress(Exception):
            await websocket.send_json({"type": "error", "message": "Tempo esgotado ao iniciar sessão."})
        with suppress(Exception):
            await websocket.close(code=1008)
    except Exception as exc:  # Log details server-side; never expose credentials.
        logger.exception("Gemini Live session failed: %s", type(exc).__name__)
        with suppress(Exception):
            await websocket.send_json(
                {"type": "error", "message": "Falha na sessão Gemini Live. Confira modelo, chave e cotas da API."}
            )
        with suppress(Exception):
            await websocket.close(code=1011)
