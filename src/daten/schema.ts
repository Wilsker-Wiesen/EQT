/**
 * Schema einer Höraufgabe. Eine Datei pro Aufgabe (inhalt/aufgaben/band-N/<id>.json).
 * App und Prüfskript nutzen dasselbe Schema, damit beide nie auseinanderlaufen.
 */
import { z } from 'zod'

export const FORMATE = [
  'qcm',
  'qcm_multi',
  'vrai_faux',
  'zuordnung',
  'luecke_auswahl',
  'luecke_eingabe',
  'stichwort',
] as const
export type Format = (typeof FORMATE)[number]

/** Leichteste zuerst; die Reihenfolge wird für den Niveaufilter genutzt. */
export const NIVEAUS = ['A1', 'A1+', 'A2', 'A2+', 'B1'] as const
export type Niveau = (typeof NIVEAUS)[number]

export const STATUS = ['entwurf', 'freigegeben', 'gesperrt'] as const
export type Status = (typeof STATUS)[number]

const text = z.string().trim().min(1)
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'nur a–z, 0–9 und Bindestrich')

/** Zeitmarke im Audio: [von, bis] in Sekunden. */
const stelle = z
  .tuple([z.number().nonnegative(), z.number().positive()])
  .refine(([von, bis]) => von < bis, 'stelle: von muss kleiner als bis sein')

const itemBasis = {
  id,
  /** ganze Punkte, keine halben */
  punkte: z.number().int().min(1).default(1),
  stelle: stelle.optional(),
}

const optionen = z.array(text).min(3).max(4)

export const qcmItem = z.object({
  ...itemBasis,
  frage: text,
  optionen,
  /** Index der richtigen Option (0-basiert) */
  loesung: z.number().int().nonnegative(),
})

export const qcmMultiItem = z.object({
  ...itemBasis,
  frage: text,
  optionen: z.array(text).min(3).max(6),
  /** Indizes aller richtigen Optionen */
  loesung: z.array(z.number().int().nonnegative()).min(1),
})

export const vraiFauxItem = z.object({
  ...itemBasis,
  aussage: text,
  loesung: z.enum(['vrai', 'faux', 'on_ne_sait_pas']),
})

export const zuordnungItem = z.object({
  ...itemBasis,
  /** z. B. «Annonce 1» oder eine Person aus dem Dialog */
  frage: text,
  /** id eines Eintrags aus `ziele` */
  loesung: id,
})

/** Lückensatz: genau eine Lücke, markiert mit ___ */
const lueckenSatz = text.refine((s) => s.split('___').length === 2, 'satz braucht genau eine Lücke ___')

export const lueckeAuswahlItem = z.object({
  ...itemBasis,
  satz: lueckenSatz,
  optionen,
  loesung: z.number().int().nonnegative(),
})

export const lueckeEingabeItem = z.object({
  ...itemBasis,
  satz: lueckenSatz,
  /** alle erlaubten Lösungen; Auswertung tolerant bei Groß/klein, Apostroph, Akzenten */
  loesungen: z.array(text).min(1),
})

export const stichwortItem = z.object({
  ...itemBasis,
  frage: text,
  loesungen: z.array(text).min(1),
  art: z.enum(['text', 'zahl', 'uhrzeit', 'name', 'ort']).default('text'),
})

const audioDatei = z.object({
  /** relativ zu public/ (eigen) bzw. zum Paket (klett); ASCII, endet auf .mp3 */
  pfad: z.string().regex(/^[A-Za-z0-9_\-/.]+\.mp3$/, 'Audiopfad: ASCII, .mp3'),
  titel: text.optional(),
})

const transkriptZeile = z.object({
  /** Index in `audio` */
  audio: z.number().int().nonnegative().default(0),
  /** id eines Eintrags aus `sprecher` */
  sprecher: id,
  text,
  von: z.number().nonnegative().optional(),
  bis: z.number().positive().optional(),
})

const sprecher = z.object({
  id,
  name: text,
  /** TTS-Stimme, z. B. «fr_FR-siwis-medium» oder «fr_FR-mls-medium#<speaker>» */
  stimme: text.optional(),
})

const ablauf = z.object({
  durchgaenge: z.number().int().min(1).max(3).default(2),
  pause_s: z.number().int().min(0).max(120).default(30),
  lesezeit_s: z.number().int().min(0).max(300).default(60),
})

/** Pflichtangaben zur Qualitätssicherung (Freigabe durch Jan). */
const qualitaet = z.object({
  /** Strukturen, die für das Lernjahr neu oder grenzwertig sind */
  neue_strukturen: z.array(text).default([]),
  /** Formulierungen, bei denen Idiomatik oder Niveau unsicher ist */
  unsicher: z.array(text).default([]),
  /** Themen-/Wortschatzbezug zur Unité, in eigenen Worten */
  bezug: text.optional(),
  notiz: text.optional(),
})

const basis = {
  id,
  lernjahr: z.number().int().min(1).max(4),
  /** id einer Einheit aus inhalt/einheiten.json, z. B. «u1», «p1», «m2» */
  einheit: id,
  niveau: z.enum(NIVEAUS),
  status: z.enum(STATUS),
  /** Pflicht bei status «gesperrt» */
  sperrgrund: text.optional(),
  audioquelle: z.enum(['eigen', 'klett']),
  titel: text,
  /** Einleitungssatz auf Französisch */
  situation: text,
  /** Arbeitsanweisung auf Französisch */
  consigne: text,
  audio: z.array(audioDatei).min(1),
  sprecher: z.array(sprecher).default([]),
  ablauf: ablauf.default({}),
  transkript: z.array(transkriptZeile).default([]),
  qualitaet: qualitaet.default({}),
}

const aufgabeOhnePruefung = z.discriminatedUnion('format', [
  z.object({ ...basis, format: z.literal('qcm'), items: z.array(qcmItem).min(1) }),
  z.object({ ...basis, format: z.literal('qcm_multi'), items: z.array(qcmMultiItem).min(1) }),
  z.object({
    ...basis,
    format: z.literal('vrai_faux'),
    /** «on ne sait pas» als dritte Antwort anbieten */
    mit_on_ne_sait_pas: z.boolean().default(false),
    items: z.array(vraiFauxItem).min(1),
  }),
  z.object({
    ...basis,
    format: z.literal('zuordnung'),
    /** Bilder/Titel/Personen; es darf eines übrig bleiben */
    ziele: z.array(z.object({ id, text, bild: z.string().optional() })).min(2),
    items: z.array(zuordnungItem).min(1),
  }),
  z.object({ ...basis, format: z.literal('luecke_auswahl'), items: z.array(lueckeAuswahlItem).min(1) }),
  z.object({ ...basis, format: z.literal('luecke_eingabe'), items: z.array(lueckeEingabeItem).min(1) }),
  z.object({ ...basis, format: z.literal('stichwort'), items: z.array(stichwortItem).min(1) }),
])

/** Querbezüge, die ein reines Typschema nicht ausdrücken kann. */
export const aufgabeSchema = aufgabeOhnePruefung.superRefine((a, ctx) => {
  const fehler = (pfad: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: pfad, message })

  if (a.status === 'gesperrt' && !a.sperrgrund) fehler(['sperrgrund'], 'gesperrt braucht einen sperrgrund')

  const itemIds = new Set<string>()
  a.items.forEach((item, i) => {
    if (itemIds.has(item.id)) fehler(['items', i, 'id'], `doppelte Item-id «${item.id}»`)
    itemIds.add(item.id)
  })

  a.items.forEach((item, i) => {
    if ('optionen' in item) {
      const n = item.optionen.length
      const indizes = Array.isArray(item.loesung) ? item.loesung : [item.loesung as number]
      for (const k of indizes) {
        if (k >= n) fehler(['items', i, 'loesung'], `Lösungsindex ${k} gibt es nicht (nur ${n} Optionen)`)
      }
      if (new Set(indizes).size !== indizes.length) fehler(['items', i, 'loesung'], 'Lösungsindex doppelt')
      if (new Set(item.optionen).size !== n) fehler(['items', i, 'optionen'], 'Optionen doppelt')
    }
  })

  if (a.format === 'qcm_multi') {
    a.items.forEach((item, i) => {
      if (item.loesung.length >= item.optionen.length)
        fehler(['items', i, 'loesung'], 'mindestens eine Option muss falsch sein')
    })
  }

  if (a.format === 'vrai_faux' && !a.mit_on_ne_sait_pas) {
    a.items.forEach((item, i) => {
      if (item.loesung === 'on_ne_sait_pas')
        fehler(['items', i, 'loesung'], '«on_ne_sait_pas» nur mit mit_on_ne_sait_pas: true')
    })
  }

  if (a.format === 'zuordnung') {
    const ziele = new Set(a.ziele.map((z) => z.id))
    if (ziele.size !== a.ziele.length) fehler(['ziele'], 'doppelte Ziel-id')
    a.items.forEach((item, i) => {
      if (!ziele.has(item.loesung)) fehler(['items', i, 'loesung'], `Ziel «${item.loesung}» gibt es nicht`)
    })
  }

  const sprecherIds = new Set(a.sprecher.map((s) => s.id))
  a.transkript.forEach((z, i) => {
    if (z.audio >= a.audio.length) fehler(['transkript', i, 'audio'], `Audio-Index ${z.audio} gibt es nicht`)
    if (!sprecherIds.has(z.sprecher)) fehler(['transkript', i, 'sprecher'], `Sprecher «${z.sprecher}» fehlt in sprecher`)
    if (z.von !== undefined && z.bis !== undefined && z.von >= z.bis)
      fehler(['transkript', i], 'von muss kleiner als bis sein')
  })

  if (a.audioquelle === 'eigen') {
    if (a.transkript.length === 0) fehler(['transkript'], 'eigene Aufgaben brauchen ein Transkript')
    if (a.status !== 'gesperrt' && new Set(a.transkript.map((z) => z.sprecher)).size < 2)
      fehler(['sprecher'], 'eigene Hörtexte brauchen mindestens zwei Stimmen')
  }
})

export type Aufgabe = z.infer<typeof aufgabeSchema>
export type Item = Aufgabe['items'][number]

/** Reihenfolge der Einheiten je Lernjahr, wie im Buch. */
export const einheitenSchema = z
  .record(
    z.enum(['1', '2', '3', '4']),
    z.array(z.object({ id, name: text })).min(1),
  )
  .superRefine((e, ctx) => {
    for (const [lj, liste] of Object.entries(e)) {
      const ids = liste.map((x) => x.id)
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [lj], message: 'doppelte Einheit-id' })
    }
  })
export type Einheiten = z.infer<typeof einheitenSchema>
