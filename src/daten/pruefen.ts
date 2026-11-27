/**
 * Prüfung einzelner Aufgabendateien über das Schema hinaus.
 * Reine Funktionen; Dateizugriff liegt beim Aufrufer (tools/pruefe-aufgaben.ts).
 */
import { aufgabeSchema, type Aufgabe, type Einheiten } from './schema'

/** sesam ist das Klassenarbeitsmaterial des Kollegiums und darf nie in EQT stehen. */
export const SESAM_MUSTER = /sesam|ECE5000|624019|624029|624039|624061|624062/i

export interface PruefOptionen {
  dateiname: string
  /** Ordnername, z. B. «band-3»; muss zum Lernjahr passen */
  ordner?: string
  einheiten: Einheiten
  /** nur bei lokaler Prüfung eines Klett-Pakets true, im Repository nie */
  klettErlaubt: boolean
  /** meldet, ob eine Audiodatei vorhanden ist */
  audioVorhanden: (pfad: string) => boolean
}

export interface PruefErgebnis {
  aufgabe?: Aufgabe
  fehler: string[]
  hinweise: string[]
}

export function pruefeAufgabe(roh: unknown, opt: PruefOptionen): PruefErgebnis {
  const fehler: string[] = []
  const hinweise: string[] = []

  if (SESAM_MUSTER.test(opt.dateiname) || SESAM_MUSTER.test(JSON.stringify(roh ?? null))) {
    return { fehler: ['sesam-Bezug gefunden: Datei abgewiesen, bitte melden'], hinweise }
  }

  const ergebnis = aufgabeSchema.safeParse(roh)
  if (!ergebnis.success) {
    for (const issue of ergebnis.error.issues) {
      fehler.push(`${issue.path.join('.') || '(Wurzel)'}: ${issue.message}`)
    }
    return { fehler, hinweise }
  }
  const a = ergebnis.data

  const erwarteteId = opt.dateiname.replace(/\.json$/, '')
  if (a.id !== erwarteteId) fehler.push(`id «${a.id}» passt nicht zum Dateinamen «${opt.dateiname}»`)

  if (opt.ordner) {
    const m = /^band-(\d)$/.exec(opt.ordner)
    if (!m) fehler.push(`Ordner «${opt.ordner}» heißt nicht band-N`)
    else if (Number(m[1]) !== a.lernjahr) fehler.push(`lernjahr ${a.lernjahr} liegt im Ordner ${opt.ordner}`)
  }

  const liste = opt.einheiten[String(a.lernjahr) as keyof Einheiten]
  if (!liste) fehler.push(`für Lernjahr ${a.lernjahr} sind keine Einheiten definiert`)
  else if (!liste.some((e) => e.id === a.einheit))
    fehler.push(`Einheit «${a.einheit}» gibt es in Lernjahr ${a.lernjahr} nicht`)

  if (a.audioquelle === 'klett' && !opt.klettErlaubt)
    fehler.push('Klett-Aufgabe: gehört nie ins Repository, nur in ein lokales Paket')

  if (a.status !== 'gesperrt') {
    for (const datei of a.audio) {
      if (!opt.audioVorhanden(datei.pfad)) {
        if (a.status === 'freigegeben') fehler.push(`Audio fehlt: ${datei.pfad}`)
        else hinweise.push(`Audio noch nicht erzeugt: ${datei.pfad}`)
      }
    }
  }

  return { aufgabe: fehler.length ? undefined : a, fehler, hinweise }
}

/** Prüfungen über mehrere Dateien hinweg. */
export function pruefeSammlung(aufgaben: Aufgabe[]): string[] {
  const fehler: string[] = []
  const gesehen = new Set<string>()
  for (const a of aufgaben) {
    if (gesehen.has(a.id)) fehler.push(`id «${a.id}» kommt mehrfach vor`)
    gesehen.add(a.id)
  }
  return fehler
}
