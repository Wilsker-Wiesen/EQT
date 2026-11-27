/**
 * Freischaltung nach Lernstand: frei ist alles bis einschließlich der eingestellten Einheit
 * und alles aus früheren Lernjahren. Späteres bleibt sichtbar, aber gesperrt («ab Unité …»).
 */
import { NIVEAUS, type Aufgabe, type Einheiten, type Niveau } from '../daten/schema'

export interface Lernstand {
  lernjahr: number
  einheit: string
}

function einheitenListe(einheiten: Einheiten, lernjahr: number) {
  return einheiten[String(lernjahr) as keyof Einheiten] ?? []
}

function position(einheiten: Einheiten, lernjahr: number, einheit: string): number {
  return einheitenListe(einheiten, lernjahr).findIndex((e) => e.id === einheit)
}

export function istFreigeschaltet(
  aufgabe: Pick<Aufgabe, 'lernjahr' | 'einheit'>,
  stand: Lernstand,
  einheiten: Einheiten,
): boolean {
  if (aufgabe.lernjahr < stand.lernjahr) return true
  if (aufgabe.lernjahr > stand.lernjahr) return false
  const a = position(einheiten, aufgabe.lernjahr, aufgabe.einheit)
  const s = position(einheiten, stand.lernjahr, stand.einheit)
  // Unbekannte Einheiten nie freischalten; das Prüfskript lässt sie gar nicht erst durch.
  if (a < 0 || s < 0) return false
  return a <= s
}

/** Text für gesperrte Aufgaben, z. B. «ab Unité 3» oder «ab Lernjahr 4, Unité 1». */
export function freischaltHinweis(
  aufgabe: Pick<Aufgabe, 'lernjahr' | 'einheit'>,
  stand: Lernstand,
  einheiten: Einheiten,
): string | null {
  if (istFreigeschaltet(aufgabe, stand, einheiten)) return null
  const name =
    einheitenListe(einheiten, aufgabe.lernjahr).find((e) => e.id === aufgabe.einheit)?.name ?? aufgabe.einheit
  return aufgabe.lernjahr === stand.lernjahr ? `ab ${name}` : `ab Lernjahr ${aufgabe.lernjahr}, ${name}`
}

/**
 * Was die App überhaupt zeigt: nie «gesperrt» (Datenstatus), «entwurf» nur in der
 * lokalen Vorschau für die Freigabe, sonst nur «freigegeben».
 */
export function sichtbareAufgaben<T extends Pick<Aufgabe, 'status'>>(
  aufgaben: T[],
  { mitEntwuerfen = false }: { mitEntwuerfen?: boolean } = {},
): T[] {
  return aufgaben.filter((a) => a.status === 'freigegeben' || (mitEntwuerfen && a.status === 'entwurf'))
}

export function niveauRang(n: Niveau): number {
  return NIVEAUS.indexOf(n)
}

/** Selbstwahl der Lernenden: nur Aufgaben bis zu einem Höchstniveau. */
export function bisNiveau<T extends Pick<Aufgabe, 'niveau'>>(aufgaben: T[], hoechstens: Niveau): T[] {
  return aufgaben.filter((a) => niveauRang(a.niveau) <= niveauRang(hoechstens))
}

/** Buchreihenfolge: Lernjahr, dann Einheit wie in einheiten.json. */
export function sortiereNachBuch<T extends Pick<Aufgabe, 'lernjahr' | 'einheit' | 'id'>>(
  aufgaben: T[],
  einheiten: Einheiten,
): T[] {
  return [...aufgaben].sort(
    (x, y) =>
      x.lernjahr - y.lernjahr ||
      position(einheiten, x.lernjahr, x.einheit) - position(einheiten, y.lernjahr, y.einheit) ||
      x.id.localeCompare(y.id),
  )
}
