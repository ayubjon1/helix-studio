import static_ffmpeg
static_ffmpeg.add_paths()

import asyncio
import uuid
import time
import json
from pathlib import Path
from contextlib import asynccontextmanager
from functools import partial

import torch
import torchaudio
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from omnivoice import OmniVoice
from omnivoice.models.omnivoice import OmniVoiceGenerationConfig

# ─── Constants ───
BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
GENERATED_DIR = BASE_DIR / "generated"
PRESETS_DIR = BASE_DIR / "voice_presets"
HISTORY_FILE = BASE_DIR / "history.json"

OUTPUT_SAMPLE_RATE = 24000
MAX_TEXT_LENGTH = 5000
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".webm"}

UPLOAD_DIR.mkdir(exist_ok=True)
GENERATED_DIR.mkdir(exist_ok=True)
PRESETS_DIR.mkdir(exist_ok=True)

model = None
history_lock = asyncio.Lock()
voice_prompts_cache: dict = {}  # preset_id -> VoiceClonePrompt


# ─── History helpers ───
def load_history() -> list[dict]:
    if HISTORY_FILE.exists():
        try:
            return json.loads(HISTORY_FILE.read_text())
        except Exception:
            return []
    return []


def save_history(history: list[dict]):
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2))


def load_presets_index() -> list[dict]:
    index_file = PRESETS_DIR / "index.json"
    if index_file.exists():
        try:
            return json.loads(index_file.read_text())
        except Exception:
            return []
    return []


def save_presets_index(presets: list[dict]):
    index_file = PRESETS_DIR / "index.json"
    index_file.write_text(json.dumps(presets, ensure_ascii=False, indent=2))


# ─── Lifespan ───
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    print("Loading OmniVoice model...")
    if torch.cuda.is_available():
        device = "cuda:0"
    elif torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"
    model = OmniVoice.from_pretrained(
        "k2-fsa/OmniVoice",
        device_map=device,
        dtype=torch.float16,
    )
    print(f"Model loaded on {device}")

    # Preload saved voice prompts into cache
    for preset in load_presets_index():
        pt_path = PRESETS_DIR / f"{preset['id']}.pt"
        if pt_path.exists():
            try:
                voice_prompts_cache[preset["id"]] = torch.load(str(pt_path), weights_only=False, map_location=model.device)
            except Exception:
                pass
    print(f"Loaded {len(voice_prompts_cache)} voice presets")

    yield
    model = None


app = FastAPI(lifespan=lifespan)

POPULAR_LANGUAGES = [
    {"id": "ru", "name": "Русский"},
    {"id": "en", "name": "English"},
    {"id": "zh", "name": "中文"},
    {"id": "es", "name": "Español"},
    {"id": "fr", "name": "Français"},
    {"id": "de", "name": "Deutsch"},
    {"id": "ja", "name": "日本語"},
    {"id": "ko", "name": "한국어"},
    {"id": "ar", "name": "العربية"},
    {"id": "uk", "name": "Українська"},
    {"id": "uz", "name": "Oʻzbek"},
    {"id": "tr", "name": "Türkçe"},
    {"id": "pt", "name": "Português"},
    {"id": "it", "name": "Italiano"},
    {"id": "hi", "name": "हिन्दी"},
]


def _validate_audio_ext(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(400, f"Неподдерживаемый формат: {ext}")
    return ext


# ─── Routes ───
@app.get("/api/languages")
async def get_languages():
    all_ids = sorted(model.supported_language_ids())
    return {"popular": POPULAR_LANGUAGES, "all_ids": all_ids}


@app.post("/api/generate")
async def generate_speech(
    text: str = Form(...),
    mode: str = Form("basic"),
    language: str = Form(""),
    speed: float = Form(1.0),
    num_step: int = Form(32),
    guidance_scale: float = Form(2.0),
    class_temperature: float = Form(0.0),
    position_temperature: float = Form(5.0),
    denoise: str = Form("true"),
    preprocess_prompt: str = Form("true"),
    postprocess_output: str = Form("true"),
    duration: float = Form(0),
    instruct: str = Form(""),
    ref_text: str = Form(""),
    ref_audio: UploadFile | None = File(None),
    preset_id: str = Form(""),
):
    # Validate text
    text = text.strip()
    if not text:
        raise HTTPException(400, "Введите текст для синтеза")
    if len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(400, f"Текст слишком длинный (максимум {MAX_TEXT_LENGTH} символов)")

    # Validate parameters
    if not (0.25 <= speed <= 4.0):
        raise HTTPException(400, "Скорость должна быть от 0.25 до 4.0")
    if not (4 <= num_step <= 128):
        raise HTTPException(400, "Шаги диффузии должны быть от 4 до 128")
    if mode not in ("basic", "clone", "design"):
        raise HTTPException(400, "Неизвестный режим")

    # Parse boolean strings from form
    def parse_bool(val: str) -> bool:
        return val.lower() in ("true", "1", "yes", "on")

    gen_config = OmniVoiceGenerationConfig(
        num_step=num_step,
        guidance_scale=guidance_scale,
        class_temperature=class_temperature,
        position_temperature=position_temperature,
        denoise=parse_bool(denoise),
        preprocess_prompt=parse_bool(preprocess_prompt),
        postprocess_output=parse_bool(postprocess_output),
    )

    kwargs = {
        "text": text,
        "speed": speed if speed != 1.0 else None,
        "generation_config": gen_config,
    }

    if duration > 0:
        kwargs["duration"] = duration
        kwargs.pop("speed", None)

    if language:
        kwargs["language"] = language

    ref_path = None
    if mode == "clone":
        # Use saved preset
        if preset_id and preset_id in voice_prompts_cache:
            kwargs["voice_clone_prompt"] = voice_prompts_cache[preset_id]
        elif ref_audio:
            ext = _validate_audio_ext(ref_audio.filename)
            content = await ref_audio.read()
            if len(content) > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "Файл слишком большой (максимум 50 МБ)")
            ref_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
            ref_path.write_bytes(content)
            kwargs["ref_audio"] = str(ref_path)
            if ref_text.strip():
                kwargs["ref_text"] = ref_text.strip()
        else:
            raise HTTPException(400, "Загрузите аудио или выберите голосовой пресет")
    elif mode == "design" and instruct.strip():
        kwargs["instruct"] = instruct.strip()

    try:
        start = time.time()
        loop = asyncio.get_event_loop()
        audio = await loop.run_in_executor(None, partial(model.generate, **kwargs))
        elapsed = round(time.time() - start, 2)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Ошибка генерации: {str(e)}")
    finally:
        if ref_path and ref_path.exists():
            ref_path.unlink(missing_ok=True)

    filename = f"{uuid.uuid4().hex}.wav"
    out_path = GENERATED_DIR / filename
    torchaudio.save(str(out_path), audio[0], OUTPUT_SAMPLE_RATE)

    audio_duration = round(audio[0].shape[1] / OUTPUT_SAMPLE_RATE, 2)

    entry = {
        "id": filename.replace(".wav", ""),
        "filename": filename,
        "text": text[:200],
        "mode": mode,
        "language": language or "auto",
        "speed": speed,
        "num_step": num_step,
        "duration": audio_duration,
        "elapsed": elapsed,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    if mode == "design":
        entry["instruct"] = instruct.strip()[:100]
    if preset_id:
        entry["preset_id"] = preset_id

    async with history_lock:
        history = load_history()
        history.insert(0, entry)
        history = history[:50]
        save_history(history)

    return {
        "audio_url": f"/audio/{filename}",
        "duration": audio_duration,
        "elapsed": elapsed,
        "id": entry["id"],
    }


# ─── Voice Presets ───
@app.get("/api/presets")
async def get_presets():
    return load_presets_index()


@app.post("/api/presets")
async def create_preset(
    name: str = Form(...),
    ref_audio: UploadFile = File(...),
    ref_text: str = Form(""),
):
    ext = _validate_audio_ext(ref_audio.filename)
    content = await ref_audio.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Файл слишком большой")

    tmp_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    tmp_path.write_bytes(content)

    try:
        loop = asyncio.get_event_loop()
        vcp = await loop.run_in_executor(
            None,
            partial(
                model.create_voice_clone_prompt,
                ref_audio=str(tmp_path),
                ref_text=ref_text.strip() or None,
            ),
        )

        preset_id = uuid.uuid4().hex[:12]
        pt_path = PRESETS_DIR / f"{preset_id}.pt"
        torch.save(vcp, str(pt_path))

        voice_prompts_cache[preset_id] = vcp

        # Also save the original audio for preview
        preview_path = PRESETS_DIR / f"{preset_id}.wav"
        waveform, sr = torchaudio.load(str(tmp_path))
        max_samples = sr * 10  # max 10s preview
        if waveform.shape[1] > max_samples:
            waveform = waveform[:, :max_samples]
        torchaudio.save(str(preview_path), waveform, sr)

        entry = {
            "id": preset_id,
            "name": name.strip(),
            "ref_text": (vcp.ref_text or "")[:100],
            "created": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

        presets = load_presets_index()
        presets.insert(0, entry)
        save_presets_index(presets)

        return entry
    except Exception as e:
        raise HTTPException(500, f"Ошибка создания пресета: {str(e)}")
    finally:
        tmp_path.unlink(missing_ok=True)


@app.delete("/api/presets/{preset_id}")
async def delete_preset(preset_id: str):
    voice_prompts_cache.pop(preset_id, None)
    pt_path = PRESETS_DIR / f"{preset_id}.pt"
    pt_path.unlink(missing_ok=True)
    preview_path = PRESETS_DIR / f"{preset_id}.wav"
    preview_path.unlink(missing_ok=True)

    presets = load_presets_index()
    presets = [p for p in presets if p["id"] != preset_id]
    save_presets_index(presets)
    return {"ok": True}


@app.get("/api/presets/{preset_id}/preview")
async def preset_preview(preset_id: str):
    path = (PRESETS_DIR / f"{preset_id}.wav").resolve()
    if not path.is_relative_to(PRESETS_DIR.resolve()):
        raise HTTPException(403, "Forbidden")
    if not path.exists():
        raise HTTPException(404, "Preview not found")
    return FileResponse(path, media_type="audio/wav")


# ─── History ───
@app.get("/api/history")
async def get_history():
    return load_history()


@app.post("/api/history/clear")
async def clear_history():
    async with history_lock:
        save_history([])
    for f in GENERATED_DIR.glob("*.wav"):
        f.unlink(missing_ok=True)
    return {"ok": True}


# ─── Transcribe ───
@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    ext = _validate_audio_ext(audio.filename)
    content = await audio.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Файл слишком большой (максимум 50 МБ)")

    tmp_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    tmp_path.write_bytes(content)
    try:
        waveform, sr = torchaudio.load(str(tmp_path))
        max_samples = sr * 30
        if waveform.shape[1] > max_samples:
            waveform = waveform[:, :max_samples]
            trimmed_path = UPLOAD_DIR / f"{uuid.uuid4().hex}.wav"
            torchaudio.save(str(trimmed_path), waveform, sr)
            tmp_path.unlink(missing_ok=True)
            tmp_path = trimmed_path

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, model.transcribe, str(tmp_path))
        return {"text": result}
    except Exception as e:
        raise HTTPException(500, f"Ошибка транскрипции: {str(e)}")
    finally:
        tmp_path.unlink(missing_ok=True)


# ─── Microphone Recording ───
recording_state = {"active": False, "data": [], "sr": 24000}


@app.post("/api/mic/start")
async def mic_start():
    import sounddevice as sd
    import numpy as np

    if recording_state["active"]:
        raise HTTPException(400, "Запись уже идёт")

    sr = 24000
    recording_state["active"] = True
    recording_state["data"] = []
    recording_state["sr"] = sr

    def callback(indata, frames, time_info, status):
        if recording_state["active"]:
            recording_state["data"].append(indata.copy())

    recording_state["stream"] = sd.InputStream(
        samplerate=sr, channels=1, dtype="float32", callback=callback
    )
    recording_state["stream"].start()
    return {"ok": True}


@app.post("/api/mic/stop")
async def mic_stop():
    import numpy as np

    if not recording_state["active"]:
        raise HTTPException(400, "Запись не идёт")

    recording_state["active"] = False
    recording_state["stream"].stop()
    recording_state["stream"].close()

    if not recording_state["data"]:
        raise HTTPException(400, "Пустая запись")

    audio_np = np.concatenate(recording_state["data"], axis=0)
    audio_tensor = torch.from_numpy(audio_np.T)  # (1, T)

    # Limit to 30 seconds
    sr = recording_state["sr"]
    max_samples = sr * 30
    if audio_tensor.shape[1] > max_samples:
        audio_tensor = audio_tensor[:, :max_samples]

    filename = f"rec_{uuid.uuid4().hex[:8]}.wav"
    rec_path = UPLOAD_DIR / filename
    torchaudio.save(str(rec_path), audio_tensor, sr)

    recording_state["data"] = []
    return {"filename": filename, "url": f"/uploads/{filename}"}


@app.get("/uploads/{filename}")
async def serve_upload(filename: str):
    path = (UPLOAD_DIR / filename).resolve()
    if not path.is_relative_to(UPLOAD_DIR.resolve()):
        raise HTTPException(403, "Forbidden")
    if not path.exists():
        raise HTTPException(404, "Not found")
    return FileResponse(path, media_type="audio/wav")


# ─── Audio serving ───
@app.get("/audio/{filename}")
async def serve_audio(filename: str):
    path = (GENERATED_DIR / filename).resolve()
    if not path.is_relative_to(GENERATED_DIR.resolve()):
        raise HTTPException(403, "Forbidden")
    if not path.exists():
        raise HTTPException(404, "Audio not found")
    return FileResponse(path, media_type="audio/wav")


app.mount("/", StaticFiles(directory=str(BASE_DIR / "static"), html=True), name="static")
