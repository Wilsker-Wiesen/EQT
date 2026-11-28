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


TTS_VOICES = "https://huggingface.co/kyutai/tts-voices/resolve/main/"
# Geklonte Stimmen: Kürzel → Referenzaufnahme in kyutai/tts-voices (Lizenz siehe STIMMEN.md).
# Klonen braucht das freigeschaltete Modell kyutai/pocket-tts (Hugging-Face-Anmeldung).
KLONSTIMMEN = {
    "cml2114": "cml-tts/fr/2114_1656_000053-0001_enhanced.wav",
    "cml4937": "cml-tts/fr/4937_3731_000004-0001_enhanced.wav",
    "cml1406": "cml-tts/fr/1406_1028_000009-0003_enhanced.wav",
    "fabieng": "unmute-prod-website/fabieng-enhanced-v2.wav",
}


def pocket_stimme(name: str) -> str:
    """Katalogname (z. B. «paul») oder Kürzel einer Klonstimme → Argument für --voice."""
    if name not in KLONSTIMMEN:
        return name
    ziel = STIMMEN / "pocket" / "klon" / Path(KLONSTIMMEN[name]).name
    if not ziel.exists():
        ziel.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["curl", "-sSfL", "-o", str(ziel), TTS_VOICES + KLONSTIMMEN[name]], check=True)
    return str(ziel)


def sprich_pocket(name: str, text: str) -> tuple[int, np.ndarray]:
    """Kyutai Pocket TTS (CC BY 4.0), französisches Modell; Katalog- oder Klonstimme."""
    if not POCKET.exists():
        sys.exit(f"Pocket TTS fehlt: {POCKET}")
    name = pocket_stimme(name)
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        subprocess.run(
            [str(POCKET), "generate", "-q", "--language", "french", "--voice", name,
             "--text", text, "--output-path", tmp.name],
            check=True,
        )
        with wave.open(tmp.name) as w:
            return w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), np.int16)


REFERENZ_STIMME = "fr_FR-siwis-medium"
REFERENZ_SAETZE = [
    "Oui, merci. Le train a été un peu long, mais ça va. Je suis juste un peu fatigué.",
    "Ne t'inquiète pas. Ce soir, on mange à la maison, et demain, on fait une balade en ville.",
    "Super ! Est-ce que tu peux répéter plus lentement, s'il te plaît ?",
]
EQ_SR = 22050
EQ_GRENZEN_DB = (-6.0, 12.0)
_eq: dict[str, np.ndarray] = {}


def _ltas(spec: str) -> tuple[np.ndarray, np.ndarray]:
    """Langzeitspektrum einer Stimme über feste Referenzsätze."""
    from scipy.signal import welch

    teile = [resample(x, r, EQ_SR) for r, x in (sprich_roh(spec, t) for t in REFERENZ_SAETZE)]
    return welch(np.concatenate(teile).astype(np.float64) / 32768, EQ_SR, nperseg=1024)


def eq_kurve(spec: str) -> np.ndarray:
    """FIR-Filter, das das Klangbild einer Stimme an siwis angleicht (wird in .stimmen/eq gespeichert)."""
    if spec in _eq:
        return _eq[spec]
    import hashlib

    from scipy.signal import firwin2

    cache = STIMMEN / "eq" / (hashlib.sha1(spec.encode()).hexdigest()[:12] + ".npy")
    if cache.exists():
        _eq[spec] = np.load(cache)
        return _eq[spec]
    f, p_ref = _ltas(REFERENZ_STIMME)
    _, p = _ltas(spec)
    g_db = 10 * np.log10((p_ref + 1e-12) / (p + 1e-12))
    # über Dritteloktaven glätten, Pegel herausrechnen (Lautheit regelt angleichen), begrenzen
    glatt = np.array([g_db[(f >= fc / 1.12) & (f <= fc * 1.12)].mean() if fc > 0 else g_db[0] for fc in f])
    glatt -= glatt[(f > 300) & (f < 1500)].mean()
    glatt = np.clip(glatt, *EQ_GRENZEN_DB)
    glatt[f < 80] = 0
    fir = firwin2(511, f / (EQ_SR / 2), 10 ** (glatt / 20))
    cache.parent.mkdir(parents=True, exist_ok=True)
    np.save(cache, fir)
    _eq[spec] = fir
    return fir


def sprich_roh(spec: str, text: str) -> tuple[int, np.ndarray]:
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


def sprich(spec: str, text: str) -> tuple[int, np.ndarray]:
    """Synthese; Pocket-Stimmen werden klanglich an siwis angeglichen (heller, deutlicher)."""
    if not spec.startswith("pocket:"):
        return sprich_roh(spec, text)
    from scipy.signal import fftconvolve

    r, x = sprich_roh(spec, text)
    x = resample(x, r, EQ_SR).astype(np.float64)
    y = fftconvolve(x, eq_kurve(spec), mode="same")
    return EQ_SR, np.clip(y, -32768, 32767).astype(np.int16)


ZIEL_DBFS = -20.0  # Ersatz: RMS der gesprochenen Teile
ZIEL_LUFS = -22.0  # gleiche wahrgenommene Lautheit für alle Stimmen
SPITZE = 0.89  # höchstens -1 dBFS


def angleichen(x: np.ndarray, sr: int) -> np.ndarray:
    """Bringt eine Zeile auf ZIEL_DBFS, gemessen nur über gesprochene 20-ms-Fenster."""
    f = x.astype(np.float64) / 32768
    n = max(1, int(sr * 0.02))
    fenster = f[: len(f) // n * n].reshape(-1, n)
    rms = np.sqrt((fenster**2).mean(axis=1))
    aktiv = rms[rms > rms.max() * 0.1] if rms.size else rms
    if aktiv.size == 0:
        return x
    pegel = np.sqrt((aktiv**2).mean())
    g = 10 ** (ZIEL_DBFS / 20) / pegel
    # wahrgenommene Lautheit (EBU R128) statt reinem RMS, falls die Zeile lang genug ist
    try:
        import pyloudnorm as pyln

        lufs = pyln.Meter(sr).integrated_loudness(f)
        if np.isfinite(lufs):
            g = 10 ** ((ZIEL_LUFS - lufs) / 20)
    except (ImportError, ValueError):
        pass
    y = f * g
    # weiche Begrenzung statt Absenken der ganzen Zeile, damit leise Stimmen nicht leise bleiben
    y = np.where(np.abs(y) > SPITZE * 0.8, np.sign(y) * (SPITZE * 0.8 + (SPITZE * 0.2) * np.tanh((np.abs(y) - SPITZE * 0.8) / (SPITZE * 0.2))), y)
    return (np.clip(y, -1, 1) * 32767).astype(np.int16)


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
            x = angleichen(resample(x, r, sr), sr)
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
