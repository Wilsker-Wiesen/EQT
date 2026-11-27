import { describe, expect, it } from 'vitest'
import { pruefeAufgabe, pruefeSammlung } from '../src/daten/pruefen'
import { aufgabeSchema } from '../src/daten/schema'
import { basisAufgabe, einheiten } from './hilfen'

const opt = (extra: Partial<Parameters<typeof pruefeAufgabe>[1]> = {}) => ({
  dateiname: 'test-qcm.json',
  ordner: 'band-3',
  einheiten,
  klettErlaubt: false,
  audioVorhanden: () => true,
  ...extra,
})

describe('pruefeAufgabe', () => {
  it('nimmt eine gültige Datei an', () => expect(pruefeAufgabe(basisAufgabe(), opt()).fehler).toEqual([]))
  it('id ≠ Dateiname', () => expect(pruefeAufgabe(basisAufgabe(), opt({ dateiname: 'anders.json' })).fehler.join()).toMatch(/Dateinamen/))
  it('Lernjahr passt nicht zum Ordner', () => expect(pruefeAufgabe(basisAufgabe(), opt({ ordner: 'band-2' })).fehler.join()).toMatch(/band-2/))
  it('unbekannte Einheit', () => expect(pruefeAufgabe(basisAufgabe({ einheit: 'u9' }), opt()).fehler.join()).toMatch(/u9/))
  it('sesam im Dateinamen', () => expect(pruefeAufgabe(basisAufgabe(), opt({ dateiname: 'sesam-1.json' })).fehler.join()).toMatch(/sesam/))
  it('sesam-Nummer im Inhalt', () => expect(pruefeAufgabe(basisAufgabe({ titel: 'aus 624029' }), opt()).fehler.join()).toMatch(/sesam/))
  it('Klett im Repository abgelehnt', () =>
    expect(pruefeAufgabe(basisAufgabe({ audioquelle: 'klett' }), opt()).fehler.join()).toMatch(/Klett/))
  it('Klett im lokalen Paket erlaubt', () =>
    expect(pruefeAufgabe(basisAufgabe({ audioquelle: 'klett' }), opt({ klettErlaubt: true })).fehler).toEqual([]))
  it('fehlendes Audio: Entwurf nur Hinweis', () => {
    const r = pruefeAufgabe(basisAufgabe(), opt({ audioVorhanden: () => false }))
    expect(r.fehler).toEqual([])
    expect(r.hinweise.join()).toMatch(/noch nicht erzeugt/)
  })
  it('fehlendes Audio: freigegeben abgelehnt', () =>
    expect(pruefeAufgabe(basisAufgabe({ status: 'freigegeben' }), opt({ audioVorhanden: () => false })).fehler.join()).toMatch(/Audio fehlt/))
  it('fehlendes Audio: gesperrt erlaubt', () =>
    expect(pruefeAufgabe(basisAufgabe({ status: 'gesperrt', sperrgrund: 'Audio fehlt' }), opt({ audioVorhanden: () => false })).fehler).toEqual([]))
  it('Schemafehler mit Pfad', () => expect(pruefeAufgabe({ id: 'x' }, opt()).fehler.length).toBeGreaterThan(0))
})

describe('pruefeSammlung', () => {
  it('doppelte ids über Dateien', () => {
    const a = aufgabeSchema.parse(basisAufgabe())
    expect(pruefeSammlung([a, a])).toHaveLength(1)
  })
})
