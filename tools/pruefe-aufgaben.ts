/**
 * Prüft alle Aufgabendateien und lehnt fehlerhafte ab (Exit-Code 1).
 *
 *   npx tsx tools/pruefe-aufgaben.ts inhalt
 *   npx tsx tools/pruefe-aufgaben.ts "EQT - Material Découvertes" --klett --audio-wurzel <ordner>
 *
 * Erwartet <wurzel>/aufgaben/band-N/<id>.json. Einheiten: <wurzel>/einheiten.json,
 * sonst inhalt/einheiten.json. Audio relativ zu --audio-wurzel (Standard: public).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { einheitenSchema, type Aufgabe } from '../src/daten/schema'
import { pruefeAufgabe, pruefeSammlung, SESAM_MUSTER } from '../src/daten/pruefen'

const args = process.argv.slice(2)
const wurzel = resolve(args.find((a) => !a.startsWith('--')) ?? 'inhalt')
const klettErlaubt = args.includes('--klett')
const audioIdx = args.indexOf('--audio-wurzel')
const audioWurzel = resolve(audioIdx >= 0 ? args[audioIdx + 1] : 'public')

const einheitenPfad = existsSync(join(wurzel, 'einheiten.json'))
  ? join(wurzel, 'einheiten.json')
  : resolve('inhalt/einheiten.json')
const einheiten = einheitenSchema.parse(JSON.parse(readFileSync(einheitenPfad, 'utf8')))

const aufgabenDir = join(wurzel, 'aufgaben')
let fehlerGesamt = 0
let dateien = 0
const gueltig: Aufgabe[] = []
const status: Record<string, number> = {}

for (const ordner of existsSync(aufgabenDir) ? readdirSync(aufgabenDir).sort() : []) {
  const ordnerPfad = join(aufgabenDir, ordner)
  if (!statSync(ordnerPfad).isDirectory()) continue
  for (const datei of readdirSync(ordnerPfad).sort()) {
    if (SESAM_MUSTER.test(datei)) {
      console.error(`✗ ${ordner}/${datei}\n    sesam-Bezug im Dateinamen: abgewiesen, bitte melden`)
      fehlerGesamt++
      continue
    }
    if (!datei.endsWith('.json')) continue
    dateien++
    let roh: unknown
    try {
      roh = JSON.parse(readFileSync(join(ordnerPfad, datei), 'utf8'))
    } catch (e) {
      console.error(`✗ ${ordner}/${datei}\n    kein gültiges JSON: ${(e as Error).message}`)
      fehlerGesamt++
      continue
    }
    const erg = pruefeAufgabe(roh, {
      dateiname: datei,
      ordner,
      einheiten,
      klettErlaubt,
      audioVorhanden: (p) => existsSync(join(audioWurzel, p)),
    })
    if (erg.fehler.length) {
      console.error(`✗ ${ordner}/${datei}\n    ${erg.fehler.join('\n    ')}`)
      fehlerGesamt++
    } else {
      gueltig.push(erg.aufgabe!)
      status[erg.aufgabe!.status] = (status[erg.aufgabe!.status] ?? 0) + 1
      for (const h of erg.hinweise) console.log(`  · ${ordner}/${datei}: ${h}`)
    }
  }
}

for (const f of pruefeSammlung(gueltig)) {
  console.error(`✗ ${f}`)
  fehlerGesamt++
}

const zusammenfassung = Object.entries(status).map(([s, n]) => `${n} ${s}`).join(', ') || 'keine'
console.log(`\n${dateien} Dateien geprüft, ${fehlerGesamt} abgelehnt. Gültig: ${zusammenfassung}.`)
process.exit(fehlerGesamt ? 1 : 0)
