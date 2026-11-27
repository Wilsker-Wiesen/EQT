import { describe, expect, it } from 'vitest'
import { aufgabeSchema } from '../src/daten/schema'
import { basisAufgabe } from './hilfen'

const ok = (a: unknown) => aufgabeSchema.safeParse(a).success
const meldungen = (a: unknown) => {
  const r = aufgabeSchema.safeParse(a)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe('Schema: gültige Aufgaben je Format', () => {
  it('qcm', () => expect(ok(basisAufgabe())).toBe(true))
  it('qcm_multi', () =>
    expect(ok(basisAufgabe({ format: 'qcm_multi', items: [{ id: 'i1', frage: 'Quoi ?', optionen: ['a', 'b', 'c', 'd'], loesung: [0, 2] }] }))).toBe(true))
  it('vrai_faux mit on ne sait pas', () =>
    expect(ok(basisAufgabe({ format: 'vrai_faux', mit_on_ne_sait_pas: true, items: [{ id: 'i1', aussage: 'Paul aime les pommes.', loesung: 'on_ne_sait_pas' }] }))).toBe(true))
  it('zuordnung mit übrigem Ziel', () =>
    expect(ok(basisAufgabe({ format: 'zuordnung', ziele: [{ id: 'gare', text: 'à la gare' }, { id: 'ecole', text: 'à l’école' }, { id: 'cine', text: 'au cinéma' }], items: [{ id: 'i1', frage: 'Annonce 1', loesung: 'gare' }, { id: 'i2', frage: 'Annonce 2', loesung: 'cine' }] }))).toBe(true))
  it('luecke_auswahl', () =>
    expect(ok(basisAufgabe({ format: 'luecke_auswahl', items: [{ id: 'i1', satz: 'Ils achètent ___ kilos.', optionen: ['deux', 'trois', 'dix'], loesung: 0 }] }))).toBe(true))
  it('luecke_eingabe', () =>
    expect(ok(basisAufgabe({ format: 'luecke_eingabe', items: [{ id: 'i1', satz: 'Ils achètent des ___.', loesungen: ['pommes'] }] }))).toBe(true))
  it('stichwort, Punkte Standard 1', () => {
    const r = aufgabeSchema.parse(basisAufgabe({ format: 'stichwort', items: [{ id: 'i1', frage: 'Combien ?', loesungen: ['2', 'deux'], art: 'zahl' }] }))
    expect(r.items[0].punkte).toBe(1)
    expect(r.ablauf).toEqual({ durchgaenge: 2, pause_s: 30, lesezeit_s: 60 })
  })
})

describe('Schema: Ablehnungen', () => {
  it('unbekanntes Format', () => expect(ok(basisAufgabe({ format: 'quiz' }))).toBe(false))
  it('Lösungsindex außerhalb der Optionen', () =>
    expect(meldungen(basisAufgabe({ items: [{ id: 'i1', frage: 'x', optionen: ['a', 'b', 'c'], loesung: 3 }] })).join()).toMatch(/Lösungsindex 3/))
  it('nur zwei Optionen', () => expect(ok(basisAufgabe({ items: [{ id: 'i1', frage: 'x', optionen: ['a', 'b'], loesung: 0 }] }))).toBe(false))
  it('halbe Punkte', () => expect(ok(basisAufgabe({ items: [{ id: 'i1', frage: 'x', optionen: ['a', 'b', 'c'], loesung: 0, punkte: 0.5 }] }))).toBe(false))
  it('doppelte Item-ids', () => {
    const it1 = { id: 'i1', frage: 'x', optionen: ['a', 'b', 'c'], loesung: 0 }
    expect(meldungen(basisAufgabe({ items: [it1, it1] })).join()).toMatch(/doppelte Item-id/)
  })
  it('qcm_multi: alle Optionen richtig', () =>
    expect(ok(basisAufgabe({ format: 'qcm_multi', items: [{ id: 'i1', frage: 'x', optionen: ['a', 'b', 'c'], loesung: [0, 1, 2] }] }))).toBe(false))
  it('on_ne_sait_pas ohne Freigabe', () =>
    expect(ok(basisAufgabe({ format: 'vrai_faux', items: [{ id: 'i1', aussage: 'x', loesung: 'on_ne_sait_pas' }] }))).toBe(false))
  it('Zuordnung auf unbekanntes Ziel', () =>
    expect(ok(basisAufgabe({ format: 'zuordnung', ziele: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], items: [{ id: 'i1', frage: 'x', loesung: 'c' }] }))).toBe(false))
  it('Lücke fehlt', () =>
    expect(ok(basisAufgabe({ format: 'luecke_eingabe', items: [{ id: 'i1', satz: 'Ohne Lücke.', loesungen: ['x'] }] }))).toBe(false))
  it('stelle rückwärts', () =>
    expect(ok(basisAufgabe({ items: [{ id: 'i1', frage: 'x', optionen: ['a', 'b', 'c'], loesung: 0, stelle: [8, 3] }] }))).toBe(false))
  it('eigener Text mit nur einer Stimme', () =>
    expect(meldungen(basisAufgabe({ transkript: [{ sprecher: 'lea', text: 'Bonjour.' }] })).join()).toMatch(/zwei Stimmen/))
  it('Transkript mit unbekanntem Sprecher', () =>
    expect(ok(basisAufgabe({ transkript: [{ sprecher: 'lea', text: 'a' }, { sprecher: 'max', text: 'b' }] }))).toBe(false))
  it('Verweis auf fehlende Transkriptzeile', () =>
    expect(meldungen(basisAufgabe({ items: [{ id: 'i1', frage: 'x', optionen: ['a', 'b', 'c'], loesung: 0, zeilen: [5] }] })).join()).toMatch(/Transkriptzeile 5/))
  it('gesperrt ohne Grund', () => expect(ok(basisAufgabe({ status: 'gesperrt' }))).toBe(false))
  it('unbekannter Status', () => expect(ok(basisAufgabe({ status: 'fertig' }))).toBe(false))
  it('Audiopfad mit Umlaut', () => expect(ok(basisAufgabe({ audio: [{ pfad: 'audio/hören.mp3' }] }))).toBe(false))
})
