# Stimmen und Lizenzen

Die Hörtexte in EQT sind selbst geschrieben und per Sprachsynthese vertont (`tools/vertone.py`).

| Rolle | Stimme | Werkzeug / Modell | Lizenz |
|---|---|---|---|
| weiblich (Standard) | siwis | [Piper](https://github.com/OHF-Voice/piper1-gpl) (GPL-3.0), Modell [fr_FR-siwis-medium](https://huggingface.co/rhasspy/piper-voices/tree/main/fr/fr_FR/siwis/medium); Daten: SIWIS French Speech Synthesis Database (University of Edinburgh), Basismodell Hi-Fi TTS | CC BY 4.0 |
| männlich (Standard) | cml2114 | [Kyutai Pocket TTS](https://github.com/kyutai-labs/pocket-tts) (Code MIT), Modell [kyutai/pocket-tts](https://huggingface.co/kyutai/pocket-tts) mit Stimmklonen, französisch; Referenzstimme `cml-tts/fr/2114_1656_000053-0001_enhanced.wav` aus [kyutai/tts-voices](https://huggingface.co/kyutai/tts-voices) | Modell CC BY 4.0; Stimme CML-TTS, CC BY 4.0 |
| männlich (Auswahl) | cml4937, cml1406 | wie cml2114 | wie cml2114 |

Die Pocket-Stimmen werden beim Vertonen klanglich an siwis angeglichen (Equalizer aus dem Langzeitspektrum)
und alle Zeilen auf −22 LUFS gebracht.

Quellen der Referenzstimmen: [CML-TTS](https://www.openslr.org/146/) (CC BY 4.0), ausgewählt von Kyutai in `kyutai/tts-voices`.
Die Nutzungsbedingungen von Kyutai verbieten Stimmklonen ohne Einwilligung; die CML-TTS-Sprecher haben ihre Aufnahmen
unter CC BY 4.0 veröffentlicht.

Namensnennung in der App:
«Voix : Piper / SIWIS (CC BY 4.0) · Kyutai Pocket TTS (CC BY 4.0) · CML-TTS (CC BY 4.0)».

Stand der Prüfung: 28.11.2026. Verworfen: Piper mls (Klang), upmc, gilles, mls_1840 (nicht kommerzielle bzw.
Forschungs-Basismodelle), tom (AGPL, ungeprüft); Pocket charles (zu tief), paul, fabieng, estelle (Klang);
Apple-Systemstimmen (macOS-Lizenz Abschnitt F verbietet Weitergabe auch gemeinnützig/öffentlich).
