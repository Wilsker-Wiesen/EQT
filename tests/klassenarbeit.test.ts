import { describe, expect, it } from 'vitest'
import { antwortenErlaubt, audioDarfLaufen, audioGesperrt, KA_START, kaSchritt, type KaEreignis, type KaEinstellungen, type KaZustand } from '../src/logik/klassenarbeit'

const std: KaEinstellungen = { durchgaenge: 2, pause_s: 30, lesezeit_s: 60, anzahlTracks: 1 }
const lauf = (ereignisse: KaEreignis[], e = std, z: KaZustand = KA_START) => ereignisse.reduce((s, ev) => kaSchritt(s, ev, e), z)
const zeit = (s: number): KaEreignis => ({ typ: 'zeit', ms: s * 1000 })
const ende: KaEreignis = { typ: 'trackEnde' }

describe('Klassenarbeit: genau zwei Durchgänge', () => {
  it('kompletter Ablauf', () => {
    let z = lauf([{ typ: 'start' }])
    expect(z).toEqual({ phase: 'lesezeit', restMs: 60000 })
    expect(audioDarfLaufen(z)).toBe(false)
    expect(antwortenErlaubt(z)).toBe(true)
    z = lauf([zeit(59)], std, z)
    expect(z.phase).toBe('lesezeit')
    z = lauf([zeit(1)], std, z)
    expect(z).toEqual({ phase: 'hoeren', durchgang: 1, track: 0 })
    z = lauf([ende], std, z)
    expect(z).toEqual({ phase: 'pause', nachDurchgang: 1, restMs: 30000 })
    expect(audioDarfLaufen(z)).toBe(false)
    z = lauf([zeit(30)], std, z)
    expect(z).toEqual({ phase: 'hoeren', durchgang: 2, track: 0 })
    z = lauf([ende], std, z)
    expect(z).toEqual({ phase: 'fertig' })
    expect(audioGesperrt(z)).toBe(true)
  })

  it('nach dem Ende bleibt alles gesperrt', () => {
    const z = lauf([{ typ: 'start' }, zeit(60), ende, zeit(30), ende, { typ: 'start' }, ende, zeit(999)])
    expect(z).toEqual({ phase: 'fertig' })
  })

  it('kein Anhalten, kein Spulen', () => {
    const z = lauf([{ typ: 'start' }, zeit(60)])
    expect(lauf([{ typ: 'anhalten' }, { typ: 'spulen', sekunden: -5 }], std, z)).toEqual(z)
  })

  it('Zeit läuft während des Hörens nicht weiter', () => {
    const z = lauf([{ typ: 'start' }, zeit(60)])
    expect(lauf([zeit(500)], std, z)).toEqual(z)
  })

  it('Track-Ende während Lesezeit/Pause zählt nicht', () => {
    expect(lauf([{ typ: 'start' }, ende]).phase).toBe('lesezeit')
    expect(lauf([{ typ: 'start' }, zeit(60), ende, ende]).phase).toBe('pause')
  })

  it('mehrere Tracks pro Durchgang', () => {
    const e = { ...std, anzahlTracks: 3 }
    let z = lauf([{ typ: 'start' }, zeit(60), ende, ende], e)
    expect(z).toEqual({ phase: 'hoeren', durchgang: 1, track: 2 })
    z = lauf([ende, zeit(30), ende, ende, ende], e, z)
    expect(z.phase).toBe('fertig')
  })

  it('ohne Lesezeit und Pause', () => {
    const e = { ...std, lesezeit_s: 0, pause_s: 0 }
    expect(lauf([{ typ: 'start' }], e)).toEqual({ phase: 'hoeren', durchgang: 1, track: 0 })
    expect(lauf([{ typ: 'start' }, ende], e)).toEqual({ phase: 'hoeren', durchgang: 2, track: 0 })
    expect(lauf([{ typ: 'start' }, ende, ende], e).phase).toBe('fertig')
  })

  it('Durchgänge aus dem Paket: drei', () => {
    const e = { ...std, durchgaenge: 3, pause_s: 0 }
    expect(lauf([{ typ: 'start' }, zeit(60), ende, ende], e).phase).toBe('hoeren')
    expect(lauf([{ typ: 'start' }, zeit(60), ende, ende, ende], e).phase).toBe('fertig')
  })
})
