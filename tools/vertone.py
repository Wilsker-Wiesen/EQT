"""Vertont eigene Aufgaben mit Piper und trägt die Zeitmarken ein.

    .venv/bin/python tools/vertone.py inhalt/aufgaben/band-3/b3-u1-qcm.json [...]
    .venv/bin/python tools/vertone.py inhalt/aufgaben          # alle eigenen Aufgaben

- Stimme je Sprecher in `sprecher[].stimme`:
  «fr_FR-siwis-medium» (Piper) oder «pocket:charles» (Kyutai Pocket TTS, Katalogstimme).
  Modelle und Programm liegen in .stimmen/ (nicht im Repository).
- Schreibt public/<audio.pfad> als MP3 (ffmpeg nötig).
- Setzt `von`/`bis` jeder Transkriptzeile und `stelle` jedes Items mit `zeilen`.
"""
import io
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig

WURZEL = Path(__file__).resolve().parent.parent
STIMMEN = WURZEL / ".stimmen"
PUBLIC = WURZEL / "public"

VORLAUF_S = 0.6  # Stille am Anfang
NACHLAUF_S = 0.8  # Stille am Ende
PAUSE_WECHSEL_S = 0.45  # zwischen zwei Sprechern
PAUSE_GLEICH_S = 0.3  # gleicher Sprecher, neue Zeile

_modelle: dict[str, PiperVoice] = {}


def stimme(spec: str) -> tuple[PiperVoice, int | None]:
    name, _, sid = spec.partition("#")
    if name not in _modelle:
        pfad = STIMMEN / f"{name}.onnx"
        if not pfad.exists():
            sys.exit(f"Stimme fehlt: {pfad}")
        _modelle[name] = PiperVoice.load(str(pfad))
    return _modelle[name], (int(sid) if sid else None)


POCKET = STIMMEN / "pocket" / "pocket-tts-3.3.0-x86_64-apple-darwin" / "pocket-tts"


def sprich_pocket(name: str, text: str) -> tuple[int, np.ndarray]:
    """Kyutai Pocket TTS (CC BY 4.0), Katalogstimme, französisches Modell."""
    if not POCKET.exists():
        sys.exit(f"Pocket TTS fehlt: {POCKET}")
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        subprocess.run(
            [str(POCKET), "generate", "-q", "--language", "french", "--voice", name,
             "--text", text, "--output-path", tmp.name],
            check=True,
        )
        with wave.open(tmp.name) as w:
            return w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), np.int16)


def sprich(spec: str, text: str) -> tuple[int, np.ndarray]:
    # typografische Apostrophe und Guillemets stören die Phonemisierung
    text = text.replace("’", "'").replace("«", "").replace("»", "")
    if spec.startswith("pocket:"):
        return sprich_pocket(spec.removeprefix("pocket:"), text)
    v, sid = stimme(spec)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        v.synthesize_wav(text, w, syn_config=SynthesisConfig(speaker_id=sid))
    buf.seek(0)
    with wave.open(buf) as w:
        return w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), np.int16)


def resample(x: np.ndarray, von: int, nach: int) -> np.ndarray:
    if von == nach:
        return x
    t = np.linspace(0, len(x) / von, int(len(x) * nach / von), endpoint=False)
    return np.interp(t, np.arange(len(x)) / von, x).astype(np.int16)


def vertone(datei: Path) -> None:
    a = json.loads(datei.read_text(encoding="utf-8"))
    if a.get("audioquelle") != "eigen" or a.get("status") == "gesperrt":
        print(f"– übersprungen: {datei.name}")
        return
    stimmen = {s["id"]: s.get("stimme") for s in a.get("sprecher", [])}
    sr = 22050
    for nr, track in enumerate(a["audio"]):
        teile: list[np.ndarray] = [np.zeros(int(sr * VORLAUF_S), np.int16)]
        t = VORLAUF_S
        vorher = None
        for zeile in a["transkript"]:
            if zeile.get("audio", 0) != nr:
                continue
            spec = stimmen.get(zeile["sprecher"])
            if not spec:
                sys.exit(f"{datei.name}: Sprecher {zeile['sprecher']} hat keine stimme")
            if vorher is not None:
                p = PAUSE_GLEICH_S if vorher == zeile["sprecher"] else PAUSE_WECHSEL_S
                teile.append(np.zeros(int(sr * p), np.int16))
                t += p
            r, x = sprich(spec, zeile["text"])
            x = resample(x, r, sr)
            zeile["von"] = round(t, 2)
            t += len(x) / sr
            zeile["bis"] = round(t, 2)
            teile.append(x)
            vorher = zeile["sprecher"]
        teile.append(np.zeros(int(sr * NACHLAUF_S), np.int16))
        ziel = PUBLIC / track["pfad"]
        ziel.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            with wave.open(tmp.name, "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(sr)
                w.writeframes(np.concatenate(teile).tobytes())
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-ac", "1", "-b:a", "64k", str(ziel)],
                check=True,
            )
        print(f"✓ {track['pfad']}  {t + NACHLAUF_S:.1f} s")

    for item in a["items"]:
        if item.get("zeilen"):
            z = [a["transkript"][k] for k in item["zeilen"]]
            item["stelle"] = [min(x["von"] for x in z), max(x["bis"] for x in z)]

    datei.write_text(json.dumps(a, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ziele = [Path(p) for p in sys.argv[1:]] or [WURZEL / "inhalt" / "aufgaben"]
    for z in ziele:
        for datei in sorted(z.rglob("*.json")) if z.is_dir() else [z]:
            vertone(datei)


if __name__ == "__main__":
    main()
