"""Erzeugt eine Vorlageseite zur Freigabe: Audio (eingebettet), Transkript, Items, Lösungen, Qualitätsnotizen.

    python3 tools/vorlage.py inhalt/aufgaben/band-3 hoerproben/vorlage-b3.html

Die Seite liegt außerhalb des Repositorys (hoerproben/ ist ignoriert) und funktioniert offline, auch per AirDrop.
"""
import base64
import html
import json
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
E = html.escape


def audio(pfad: str) -> str:
    p = WURZEL / "public" / pfad
    if not p.exists():
        return f"<p><i>Audio fehlt: {E(pfad)}</i></p>"
    return f"<audio controls preload=none src='data:audio/mpeg;base64,{base64.b64encode(p.read_bytes()).decode()}'></audio>"


def loesung_html(a: dict, it: dict) -> str:
    if "optionen" in it:
        l = it["loesung"] if isinstance(it["loesung"], list) else [it["loesung"]]
        return " / ".join(f"<span class=r>{E(o)}</span>" if k in l else E(o) for k, o in enumerate(it["optionen"]))
    if a["format"] == "vrai_faux":
        return f"<span class=r>{it['loesung']}</span>"
    if a["format"] == "zuordnung":
        return "<span class=r>" + E({z["id"]: z["text"] for z in a["ziele"]}[it["loesung"]]) + "</span>"
    return "<span class=r>" + E(" | ".join(it["loesungen"])) + "</span>"


def seite(ordner: Path) -> str:
    out = [
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        "<title>EQT Vorlage</title><style>body{font-family:system-ui;max-width:760px;margin:auto;padding:16px;"
        "line-height:1.45}section{border-top:2px solid #ccc;margin-top:28px;padding-top:8px}"
        ".m{background:#fff7d6;padding:8px;border-radius:6px}.r{color:#0a6b2d;font-weight:600}"
        "audio{width:100%}td{vertical-align:top;padding:2px 6px}.st{float:right;font-size:.85em;color:#666}</style>",
        f"<h1>Vorlage zur Freigabe: {E(ordner.name)}</h1>",
    ]
    for p in sorted(ordner.glob("*.json")):
        a = json.loads(p.read_text(encoding="utf-8"))
        q = a.get("qualitaet", {})
        sp = {s["id"]: s["name"] for s in a.get("sprecher", [])}
        out.append(f"<section><span class=st>{E(a['status'])} · {E(a['id'])}</span>")
        out.append(f"<h2>{E(a['format'])}: {E(a['titel'])}</h2>")
        out.append(f"<p><b>Niveau {a['niveau']}</b> · {E(a['situation'])}<br><i>{E(a['consigne'])}</i></p>")
        out.append(
            f"<div class=m><b>Bezug:</b> {E(q.get('bezug', ''))}<br>"
            f"<b>Neue Strukturen:</b> {E('; '.join(q.get('neue_strukturen', [])))}<br>"
            f"<b>Unsicher:</b> {E('; '.join(q.get('unsicher', [])))}</div>"
        )
        for t in a["audio"]:
            out.append(f"<p>{E(t.get('titel', ''))}{audio(t['pfad'])}</p>")
        out.append("<table>" + "".join(
            f"<tr><td>{i}</td><td><b>{E(sp.get(z['sprecher'], z['sprecher']))}</b></td><td>{E(z['text'])}</td></tr>"
            for i, z in enumerate(a.get("transkript", []))) + "</table><ol>")
        for it in a["items"]:
            frage = it.get("frage") or it.get("satz") or it.get("aussage")
            out.append(f"<li>{E(frage)}<br>{loesung_html(a, it)}</li>")
        out.append("</ol>")
        if a["format"] == "zuordnung":
            out.append("<p>Ziele: " + E(", ".join(z["text"] for z in a["ziele"])) + "</p>")
        out.append("</section>")
    return "\n".join(out)


if __name__ == "__main__":
    ordner, ziel = Path(sys.argv[1]), Path(sys.argv[2])
    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_text(seite(ordner), encoding="utf-8")
    print(f"✓ {ziel}")
