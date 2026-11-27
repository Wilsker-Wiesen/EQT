// Ende-zu-Ende: das Prüfskript auf einem Wegwerf-Ordner aufrufen.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { basisAufgabe } from './hilfen'

const skript = resolve('tools/pruefe-aufgaben.ts')
const tsx = resolve('node_modules/.bin/tsx')

function lauf(dateien: Record<string, unknown>) {
  const wurzel = mkdtempSync(join(tmpdir(), 'eqt-'))
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    const voll = join(wurzel, 'aufgaben', pfad)
    mkdirSync(join(voll, '..'), { recursive: true })
    writeFileSync(voll, typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
  }
  try {
    const out = execFileSync(tsx, [skript, wurzel, '--audio-wurzel', wurzel], { encoding: 'utf8', stdio: 'pipe' })
    return { code: 0, out }
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string }
    return { code: err.status, out: err.stdout + err.stderr }
  }
}

describe('tools/pruefe-aufgaben.ts', () => {
  it('Exit 0 bei gültigen Dateien', () => {
    const r = lauf({ 'band-3/test-qcm.json': basisAufgabe() })
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/1 Dateien geprüft, 0 abgelehnt/)
  })
  it('Exit 1 und Meldung bei kaputtem JSON', () => {
    const r = lauf({ 'band-3/test-qcm.json': basisAufgabe(), 'band-3/kaputt.json': '{ "id": ' })
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/kaputt\.json[\s\S]*kein gültiges JSON/)
  })
  it('Exit 1 bei falschem Lösungsindex', () => {
    const r = lauf({ 'band-3/test-qcm.json': basisAufgabe({ items: [{ id: 'i1', frage: 'x', optionen: ['a', 'b', 'c'], loesung: 7 }] }) })
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/Lösungsindex 7/)
  })
  it('Exit 1 bei sesam-Datei', () => {
    const r = lauf({ 'band-3/test-qcm.json': basisAufgabe(), 'band-3/sesam_kopie.pdf': 'x' })
    expect(r.code).toBe(1)
  })
}, 30000)
