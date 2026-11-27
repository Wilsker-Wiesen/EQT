// Selbst geschriebene Mini-Aufgaben als Testdaten (kein Klett-Material).
import einheitenRoh from '../inhalt/einheiten.json'
import { einheitenSchema } from '../src/daten/schema'

export const einheiten = einheitenSchema.parse(einheitenRoh)

export function basisAufgabe(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-qcm',
    lernjahr: 3,
    einheit: 'u1',
    niveau: 'A2',
    status: 'entwurf',
    audioquelle: 'eigen',
    titel: 'Au marché',
    situation: 'Léa et Paul font les courses.',
    consigne: 'Écoute et coche la bonne réponse.',
    audio: [{ pfad: 'audio/test.mp3' }],
    sprecher: [
      { id: 'lea', name: 'Léa' },
      { id: 'paul', name: 'Paul' },
    ],
    transkript: [
      { sprecher: 'lea', text: 'On achète des pommes ?' },
      { sprecher: 'paul', text: 'Oui, deux kilos.' },
    ],
    format: 'qcm',
    items: [{ id: 'i1', frage: 'Combien de pommes ?', optionen: ['un kilo', 'deux kilos', 'trois kilos'], loesung: 1 }],
    ...extra,
  }
}
