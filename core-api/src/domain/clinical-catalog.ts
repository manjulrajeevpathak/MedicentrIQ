import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * ICD-10-CM condition catalog for the clinical pickers (chief complaints,
 * pre-existing diseases, diagnosis).
 *
 * The FULL ICD-10-CM code set (~71.7k codes, CMS public domain) ships bundled and
 * gzipped in ./data and loads once at boot. A small curated "common" list (eye-care
 * launch vertical + frequent comorbidities/symptoms) is layered on top for nicer
 * labels and to rank everyday conditions first — searches still cover every code.
 */
export type ConditionKind = "symptom" | "diagnosis" | "comorbidity";

export type ConditionCatalogEntry = {
  icd10Code: string;
  label: string;
  category: string;
  kind?: ConditionKind;
};

/** Curated everyday conditions — boosted to the top of results + friendlier labels. */
export const COMMON_CONDITIONS: ConditionCatalogEntry[] = [
  // Presenting symptoms / complaints
  { icd10Code: "H53.8", label: "Blurred / diminished vision", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H53.2", label: "Diplopia (double vision)", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H57.10", label: "Ocular pain, unspecified eye", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H57.8", label: "Redness / irritation of eye", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H53.9", label: "Visual disturbance, unspecified", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "R51.9", label: "Headache", category: "General symptom", kind: "symptom" },
  { icd10Code: "R42", label: "Dizziness / giddiness", category: "General symptom", kind: "symptom" },
  { icd10Code: "R50.9", label: "Fever, unspecified", category: "General symptom", kind: "symptom" },
  // Cataract / glaucoma / retina
  { icd10Code: "H25.9", label: "Age-related cataract, unspecified", category: "Cataract", kind: "diagnosis" },
  { icd10Code: "H26.9", label: "Cataract, unspecified (other)", category: "Cataract", kind: "diagnosis" },
  { icd10Code: "H26.4", label: "After-cataract (posterior capsular opacification)", category: "Cataract", kind: "diagnosis" },
  { icd10Code: "H40.9", label: "Glaucoma, unspecified", category: "Glaucoma", kind: "diagnosis" },
  { icd10Code: "H40.10", label: "Primary open-angle glaucoma", category: "Glaucoma", kind: "diagnosis" },
  { icd10Code: "E11.319", label: "Type 2 diabetes with diabetic retinopathy", category: "Retina", kind: "diagnosis" },
  { icd10Code: "H35.30", label: "Age-related macular degeneration, unspecified", category: "Retina", kind: "diagnosis" },
  { icd10Code: "H35.81", label: "Macular oedema", category: "Retina", kind: "diagnosis" },
  // Cornea / surface / refractive
  { icd10Code: "H04.123", label: "Dry eye syndrome, bilateral", category: "Ocular surface", kind: "diagnosis" },
  { icd10Code: "H10.9", label: "Conjunctivitis, unspecified", category: "Ocular surface", kind: "diagnosis" },
  { icd10Code: "H11.00", label: "Pterygium, unspecified eye", category: "Ocular surface", kind: "diagnosis" },
  { icd10Code: "H16.9", label: "Keratitis, unspecified", category: "Cornea", kind: "diagnosis" },
  { icd10Code: "H18.60", label: "Keratoconus, unspecified", category: "Cornea", kind: "diagnosis" },
  { icd10Code: "H52.4", label: "Presbyopia", category: "Refractive", kind: "diagnosis" },
  { icd10Code: "H52.10", label: "Myopia, unspecified eye", category: "Refractive", kind: "diagnosis" },
  { icd10Code: "H52.209", label: "Astigmatism, unspecified eye", category: "Refractive", kind: "diagnosis" },
  { icd10Code: "H50.9", label: "Strabismus (squint), unspecified", category: "Neuro-ophthalmology", kind: "diagnosis" },
  // Comorbidities
  { icd10Code: "E11.9", label: "Type 2 diabetes mellitus", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "E10.9", label: "Type 1 diabetes mellitus", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "E03.9", label: "Hypothyroidism, unspecified", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "E78.5", label: "Hyperlipidaemia / dyslipidaemia", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "I10", label: "Essential (primary) hypertension", category: "Cardiovascular", kind: "comorbidity" },
  { icd10Code: "I25.10", label: "Coronary artery disease", category: "Cardiovascular", kind: "comorbidity" },
  { icd10Code: "I48.91", label: "Atrial fibrillation", category: "Cardiovascular", kind: "comorbidity" },
  { icd10Code: "J45.909", label: "Asthma, unspecified", category: "Respiratory", kind: "comorbidity" },
  { icd10Code: "J44.9", label: "COPD, unspecified", category: "Respiratory", kind: "comorbidity" },
  { icd10Code: "N18.9", label: "Chronic kidney disease, unspecified", category: "Renal", kind: "comorbidity" },
  { icd10Code: "K21.9", label: "Gastro-oesophageal reflux disease (GERD)", category: "Gastro", kind: "comorbidity" },
  { icd10Code: "F41.9", label: "Anxiety disorder, unspecified", category: "Mental health", kind: "comorbidity" },
  { icd10Code: "Z79.4", label: "Long-term insulin use", category: "Medication history", kind: "comorbidity" },
  { icd10Code: "Z79.01", label: "Long-term anticoagulant use", category: "Medication history", kind: "comorbidity" }
];

/** @deprecated Kept for back-compat; use searchConditionCatalog / COMMON_CONDITIONS. */
export const OPHTHALMOLOGY_CONDITION_CATALOG = COMMON_CONDITIONS;

type IndexedEntry = ConditionCatalogEntry & { common: boolean; haystack: string };

/** Load + index the full ICD-10-CM set once (gunzipped from the bundled file). */
const buildIndex = (): IndexedEntry[] => {
  const commonByCode = new Map(COMMON_CONDITIONS.map((c) => [c.icd10Code, c]));
  let full: { c: string; l: string; g: string }[] = [];
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw = gunzipSync(readFileSync(join(dir, "data/icd10cm.min.json.gz")));
    full = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    // Dataset missing (e.g. not copied into a prod build) — degrade to the common
    // set rather than crashing the process.
    console.warn("[icd10] full catalog unavailable, using common set only:", String(error));
  }

  const seen = new Set<string>();
  const entries: IndexedEntry[] = [];
  const add = (e: ConditionCatalogEntry, common: boolean) => {
    if (seen.has(e.icd10Code)) return;
    seen.add(e.icd10Code);
    entries.push({ ...e, common, haystack: `${e.icd10Code} ${e.label}`.toLowerCase() });
  };
  // Curated first so common conditions carry their friendly labels + boost flag.
  for (const c of COMMON_CONDITIONS) add(c, true);
  for (const row of full) {
    const curated = commonByCode.get(row.c);
    add(curated ?? { icd10Code: row.c, label: row.l, category: row.g || "ICD-10" }, Boolean(curated));
  }
  return entries;
};

const INDEX: IndexedEntry[] = buildIndex();

/** Total codes loaded (full ICD-10-CM when the dataset is present). */
export const conditionCatalogSize = INDEX.length;

const strip = ({ common, haystack, ...entry }: IndexedEntry): ConditionCatalogEntry => entry;

/**
 * Case-insensitive search over code + label across the FULL ICD-10-CM set.
 * Ranking: exact code, then curated-common, then code prefix, then everything else.
 * Empty query returns the curated common list (a friendly default for the picker).
 */
export const searchConditionCatalog = (query: string, limit = 40): ConditionCatalogEntry[] => {
  const q = query.trim().toLowerCase();
  if (!q) return COMMON_CONDITIONS.slice(0, limit);
  // Multi-word queries match when EVERY token appears (any order): "femur fracture".
  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: { entry: IndexedEntry; score: number }[] = [];
  for (const entry of INDEX) {
    if (!tokens.every((t) => entry.haystack.includes(t))) continue;
    const code = entry.icd10Code.toLowerCase();
    let score = 4;
    if (code === q) score = 0;
    else if (entry.common) score = 1;
    else if (code.startsWith(q) || entry.haystack.includes(q)) score = 2;
    else if (entry.label.toLowerCase().startsWith(q)) score = 3;
    scored.push({ entry, score });
  }
  scored.sort((a, b) => a.score - b.score || a.entry.icd10Code.localeCompare(b.entry.icd10Code));
  return scored.slice(0, limit).map((s) => strip(s.entry));
};
