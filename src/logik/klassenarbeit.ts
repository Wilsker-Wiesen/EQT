/**
 * Ablauf im Modus «Wie in der Klassenarbeit»:
 * Lesezeit → 1. Durchgang → Pause → 2. Durchgang → fertig (Audio gesperrt).
 * Kein Anhalten, kein Spulen. Ein Durchgang spielt alle Tracks der Aufgabe nacheinander.
 *
 * Reiner Reducer: Die Oberfläche meldet Zeit und Track-Ende, der Zustand sagt,
 * ob Audio laufen darf. So ist die Logik ohne Browser testbar.
 */

export interface KaEinstellungen {
  durchgaenge: number
  pause_s: number
  lesezeit_s: number
  anzahlTracks: number
}

export type KaZustand =
  | { phase: 'bereit' }
  | { phase: 'lesezeit'; restMs: number }
  | { phase: 'hoeren'; durchgang: number; track: number }
  | { phase: 'pause'; nachDurchgang: number; restMs: number }
  | { phase: 'fertig' }

export type KaEreignis =
  | { typ: 'start' }
  /** vergangene Zeit seit dem letzten Ereignis */
  | { typ: 'zeit'; ms: number }
  /** der laufende Track ist zu Ende gespielt */
  | { typ: 'trackEnde' }
  /** Versuche, die im Klassenarbeitsmodus nichts bewirken */
  | { typ: 'anhalten' }
  | { typ: 'spulen'; sekunden: number }

export const KA_START: KaZustand = { phase: 'bereit' }

function durchgangBeginnen(durchgang: number): KaZustand {
  return { phase: 'hoeren', durchgang, track: 0 }
}

function nachDurchgang(durchgang: number, e: KaEinstellungen): KaZustand {
  if (durchgang >= e.durchgaenge) return { phase: 'fertig' }
  if (e.pause_s <= 0) return durchgangBeginnen(durchgang + 1)
  return { phase: 'pause', nachDurchgang: durchgang, restMs: e.pause_s * 1000 }
}

export function kaSchritt(z: KaZustand, ev: KaEreignis, e: KaEinstellungen): KaZustand {
  if (e.durchgaenge < 1 || e.anzahlTracks < 1) return { phase: 'fertig' }

  switch (z.phase) {
    case 'bereit':
      if (ev.typ !== 'start') return z
      return e.lesezeit_s > 0 ? { phase: 'lesezeit', restMs: e.lesezeit_s * 1000 } : durchgangBeginnen(1)

    case 'lesezeit':
      if (ev.typ !== 'zeit') return z
      return z.restMs - ev.ms > 0 ? { ...z, restMs: z.restMs - ev.ms } : durchgangBeginnen(1)

    case 'hoeren':
      if (ev.typ !== 'trackEnde') return z
      if (z.track + 1 < e.anzahlTracks) return { ...z, track: z.track + 1 }
      return nachDurchgang(z.durchgang, e)

    case 'pause':
      if (ev.typ !== 'zeit') return z
      return z.restMs - ev.ms > 0 ? { ...z, restMs: z.restMs - ev.ms } : durchgangBeginnen(z.nachDurchgang + 1)

    case 'fertig':
      return z
  }
}

/** Audio darf nur während eines Durchgangs laufen. */
export function audioDarfLaufen(z: KaZustand): boolean {
  return z.phase === 'hoeren'
}

/** Nach dem letzten Durchgang ist das Audio für diese Runde gesperrt. */
export function audioGesperrt(z: KaZustand): boolean {
  return z.phase === 'fertig'
}

/** Antworten sind ab der Lesezeit möglich und bleiben es nach dem Hören. */
export function antwortenErlaubt(z: KaZustand): boolean {
  return z.phase !== 'bereit'
}
