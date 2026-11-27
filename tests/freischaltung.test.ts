import { describe, expect, it } from 'vitest'
import { bisNiveau, freischaltHinweis, istFreigeschaltet, sichtbareAufgaben, sortiereNachBuch } from '../src/logik/freischaltung'
import { einheiten } from './hilfen'

const stand = { lernjahr: 3, einheit: 'u3' }
const a = (lernjahr: number, einheit: string) => ({ lernjahr, einheit })

describe('istFreigeschaltet', () => {
  it('frühere Lernjahre immer frei', () => expect(istFreigeschaltet(a(1, 'p3'), stand, einheiten)).toBe(true))
  it('frühere Einheit desselben Jahres frei', () => expect(istFreigeschaltet(a(3, 'u1'), stand, einheiten)).toBe(true))
  it('Plateau vor der Einheit frei', () => expect(istFreigeschaltet(a(3, 'p1'), stand, einheiten)).toBe(true))
  it('eingestellte Einheit selbst frei', () => expect(istFreigeschaltet(a(3, 'u3'), stand, einheiten)).toBe(true))
  it('spätere Einheit gesperrt', () => expect(istFreigeschaltet(a(3, 'u4'), stand, einheiten)).toBe(false))
  it('späteres Lernjahr gesperrt', () => expect(istFreigeschaltet(a(4, 'u1'), stand, einheiten)).toBe(false))
  it('unbekannte Einheit gesperrt', () => expect(istFreigeschaltet(a(3, 'zz'), stand, einheiten)).toBe(false))
})

describe('freischaltHinweis', () => {
  it('frei → null', () => expect(freischaltHinweis(a(3, 'u1'), stand, einheiten)).toBeNull())
  it('gleiches Jahr', () => expect(freischaltHinweis(a(3, 'u5'), stand, einheiten)).toBe('ab Unité 5'))
  it('späteres Jahr', () => expect(freischaltHinweis(a(4, 'u2'), stand, einheiten)).toBe('ab Lernjahr 4, Unité 2'))
})

describe('Sichtbarkeit und Niveau', () => {
  const liste = [
    { id: 'a', status: 'freigegeben' as const, niveau: 'A1' as const, lernjahr: 3, einheit: 'u2' },
    { id: 'b', status: 'entwurf' as const, niveau: 'A2' as const, lernjahr: 3, einheit: 'u1' },
    { id: 'c', status: 'gesperrt' as const, niveau: 'B1' as const, lernjahr: 2, einheit: 'u1' },
  ]
  it('Schülerversion: nur freigegeben', () => expect(sichtbareAufgaben(liste).map((x) => x.id)).toEqual(['a']))
  it('Vorschau: auch Entwürfe, nie gesperrt', () =>
    expect(sichtbareAufgaben(liste, { mitEntwuerfen: true }).map((x) => x.id)).toEqual(['a', 'b']))
  it('Selbstwahl bis A2', () => expect(bisNiveau(liste, 'A2').map((x) => x.id)).toEqual(['a', 'b']))
  it('Buchreihenfolge', () => expect(sortiereNachBuch(liste, einheiten).map((x) => x.id)).toEqual(['c', 'b', 'a']))
})
