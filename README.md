# EQT

Lernapp zum Hörverstehen Französisch (Gymnasium NRW, Klassen 7–10, angelehnt an die Themen von *Découvertes*).
Alle Inhalte im Repository sind selbst geschrieben; Audio per Sprachsynthese. Kein Konto, kein Server, keine Datenerhebung.

## Aufgaben

Eine Datei pro Höraufgabe: `inhalt/aufgaben/band-N/<id>.json`, Schema in `src/daten/schema.ts`.
Die Reihenfolge der Einheiten je Lernjahr steht in `inhalt/einheiten.json`.
Neue Aufgabe = neue Datei, keine Codeänderung.

Status: `entwurf` (nur Vorschau) → `freigegeben` (in der App) · `gesperrt` (nie sichtbar, mit `sperrgrund`).

```bash
npm run pruefen   # lehnt fehlerhafte Aufgabendateien ab (Exit 1)
npm test
```

Klett-Material gehört nie in dieses Repository. Es kann nur lokal als Paket importiert werden.
