/**
 * Curated ICD-10-CM condition catalog for the clinical pickers (chief complaints,
 * pre-existing diseases, diagnosis). Eye-care-first (the launch vertical) plus the
 * common comorbidities and presenting symptoms a hospital front office actually
 * records. Codes are real ICD-10-CM; labels are written for a clinician UI.
 *
 * This is a strong common set, not the full ~70k ICD-10 tree — a complete dataset
 * can later replace this array behind the same `/clinical/conditions` endpoint with
 * no code change. `kind` lets the UI bias a picker (complaints vs diagnoses) while
 * still allowing any code anywhere.
 */
export type ConditionKind = "symptom" | "diagnosis" | "comorbidity";

export type ConditionCatalogEntry = {
  icd10Code: string;
  label: string;
  category: string;
  kind?: ConditionKind;
};

export const CONDITION_CATALOG: ConditionCatalogEntry[] = [
  // ---- Presenting symptoms / complaints (eye + general) --------------------
  { icd10Code: "H53.8", label: "Blurred / diminished vision", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H53.2", label: "Diplopia (double vision)", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H53.14", label: "Visual discomfort / eye strain", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H57.13", label: "Ocular pain, bilateral", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H57.10", label: "Ocular pain, unspecified eye", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H04.201", label: "Watering / epiphora, right eye", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H57.8", label: "Redness / irritation of eye", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H53.19", label: "Glare / haloes, other visual disturbance", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H53.60", label: "Night blindness, unspecified", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H53.9", label: "Visual disturbance, unspecified", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "H53.13", label: "Sudden visual loss", category: "Eye symptom", kind: "symptom" },
  { icd10Code: "R51.9", label: "Headache", category: "General symptom", kind: "symptom" },
  { icd10Code: "R42", label: "Dizziness / giddiness", category: "General symptom", kind: "symptom" },
  { icd10Code: "R53.83", label: "Fatigue / weakness", category: "General symptom", kind: "symptom" },
  { icd10Code: "R50.9", label: "Fever, unspecified", category: "General symptom", kind: "symptom" },
  { icd10Code: "R10.9", label: "Abdominal pain, unspecified", category: "General symptom", kind: "symptom" },
  { icd10Code: "R05.9", label: "Cough", category: "General symptom", kind: "symptom" },
  { icd10Code: "R07.9", label: "Chest pain, unspecified", category: "General symptom", kind: "symptom" },
  { icd10Code: "R06.02", label: "Shortness of breath", category: "General symptom", kind: "symptom" },
  { icd10Code: "M54.9", label: "Back pain, unspecified", category: "General symptom", kind: "symptom" },

  // ---- Cataract ------------------------------------------------------------
  { icd10Code: "H25.9", label: "Age-related cataract, unspecified", category: "Cataract", kind: "diagnosis" },
  { icd10Code: "H25.13", label: "Age-related nuclear cataract, bilateral", category: "Cataract", kind: "diagnosis" },
  { icd10Code: "H25.11", label: "Age-related nuclear cataract, right eye", category: "Cataract", kind: "diagnosis" },
  { icd10Code: "H25.12", label: "Age-related nuclear cataract, left eye", category: "Cataract", kind: "diagnosis" },
  { icd10Code: "H26.9", label: "Cataract, unspecified (other)", category: "Cataract", kind: "diagnosis" },
  { icd10Code: "H26.4", label: "After-cataract (posterior capsular opacification)", category: "Cataract", kind: "diagnosis" },
  { icd10Code: "H26.001", label: "Infantile / juvenile cataract, right eye", category: "Cataract", kind: "diagnosis" },
  { icd10Code: "Z96.1", label: "Presence of intraocular lens (pseudophakia)", category: "Cataract", kind: "diagnosis" },

  // ---- Glaucoma ------------------------------------------------------------
  { icd10Code: "H40.9", label: "Glaucoma, unspecified", category: "Glaucoma", kind: "diagnosis" },
  { icd10Code: "H40.10", label: "Primary open-angle glaucoma", category: "Glaucoma", kind: "diagnosis" },
  { icd10Code: "H40.20", label: "Primary angle-closure glaucoma", category: "Glaucoma", kind: "diagnosis" },
  { icd10Code: "H40.00", label: "Glaucoma suspect, unspecified", category: "Glaucoma", kind: "diagnosis" },
  { icd10Code: "H40.05", label: "Ocular hypertension", category: "Glaucoma", kind: "diagnosis" },
  { icd10Code: "H40.89", label: "Other specified glaucoma", category: "Glaucoma", kind: "diagnosis" },

  // ---- Retina --------------------------------------------------------------
  { icd10Code: "E11.319", label: "Type 2 diabetes with diabetic retinopathy", category: "Retina", kind: "diagnosis" },
  { icd10Code: "E11.359", label: "Type 2 diabetes with proliferative retinopathy", category: "Retina", kind: "diagnosis" },
  { icd10Code: "H35.30", label: "Age-related macular degeneration, unspecified", category: "Retina", kind: "diagnosis" },
  { icd10Code: "H35.81", label: "Macular oedema", category: "Retina", kind: "diagnosis" },
  { icd10Code: "H33.20", label: "Retinal detachment with break, unspecified eye", category: "Retina", kind: "diagnosis" },
  { icd10Code: "H34.9", label: "Retinal vascular occlusion, unspecified", category: "Retina", kind: "diagnosis" },
  { icd10Code: "H35.00", label: "Background retinopathy, unspecified", category: "Retina", kind: "diagnosis" },

  // ---- Cornea / ocular surface / oculoplasty -------------------------------
  { icd10Code: "H04.123", label: "Dry eye syndrome, bilateral", category: "Ocular surface", kind: "diagnosis" },
  { icd10Code: "H10.9", label: "Conjunctivitis, unspecified", category: "Ocular surface", kind: "diagnosis" },
  { icd10Code: "H10.30", label: "Acute conjunctivitis, unspecified", category: "Ocular surface", kind: "diagnosis" },
  { icd10Code: "H11.00", label: "Pterygium, unspecified eye", category: "Ocular surface", kind: "diagnosis" },
  { icd10Code: "H16.9", label: "Keratitis, unspecified", category: "Cornea", kind: "diagnosis" },
  { icd10Code: "H16.0", label: "Corneal ulcer", category: "Cornea", kind: "diagnosis" },
  { icd10Code: "H18.60", label: "Keratoconus, unspecified", category: "Cornea", kind: "diagnosis" },
  { icd10Code: "H00.019", label: "Hordeolum (stye), unspecified eye", category: "Oculoplasty", kind: "diagnosis" },
  { icd10Code: "H00.19", label: "Chalazion, unspecified eye", category: "Oculoplasty", kind: "diagnosis" },
  { icd10Code: "H01.009", label: "Blepharitis, unspecified", category: "Oculoplasty", kind: "diagnosis" },

  // ---- Refractive / neuro --------------------------------------------------
  { icd10Code: "H52.4", label: "Presbyopia", category: "Refractive", kind: "diagnosis" },
  { icd10Code: "H52.10", label: "Myopia, unspecified eye", category: "Refractive", kind: "diagnosis" },
  { icd10Code: "H52.00", label: "Hypermetropia, unspecified eye", category: "Refractive", kind: "diagnosis" },
  { icd10Code: "H52.209", label: "Astigmatism, unspecified eye", category: "Refractive", kind: "diagnosis" },
  { icd10Code: "H52.7", label: "Disorder of refraction, unspecified", category: "Refractive", kind: "diagnosis" },
  { icd10Code: "H50.9", label: "Strabismus (squint), unspecified", category: "Neuro-ophthalmology", kind: "diagnosis" },
  { icd10Code: "H47.9", label: "Disorder of optic nerve / visual pathways", category: "Neuro-ophthalmology", kind: "diagnosis" },

  // ---- Comorbidities (pre-existing diseases) -------------------------------
  { icd10Code: "E11.9", label: "Type 2 diabetes mellitus", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "E10.9", label: "Type 1 diabetes mellitus", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "E11.65", label: "Type 2 diabetes with hyperglycaemia", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "E03.9", label: "Hypothyroidism, unspecified", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "E05.90", label: "Hyperthyroidism / thyrotoxicosis", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "E78.5", label: "Hyperlipidaemia / dyslipidaemia", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "E66.9", label: "Obesity, unspecified", category: "Endocrine", kind: "comorbidity" },
  { icd10Code: "I10", label: "Essential (primary) hypertension", category: "Cardiovascular", kind: "comorbidity" },
  { icd10Code: "I25.10", label: "Coronary artery disease", category: "Cardiovascular", kind: "comorbidity" },
  { icd10Code: "I48.91", label: "Atrial fibrillation", category: "Cardiovascular", kind: "comorbidity" },
  { icd10Code: "I50.9", label: "Heart failure, unspecified", category: "Cardiovascular", kind: "comorbidity" },
  { icd10Code: "I63.9", label: "Cerebral infarction (stroke)", category: "Cardiovascular", kind: "comorbidity" },
  { icd10Code: "J45.909", label: "Asthma, unspecified", category: "Respiratory", kind: "comorbidity" },
  { icd10Code: "J44.9", label: "COPD, unspecified", category: "Respiratory", kind: "comorbidity" },
  { icd10Code: "N18.9", label: "Chronic kidney disease, unspecified", category: "Renal", kind: "comorbidity" },
  { icd10Code: "N18.6", label: "End-stage renal disease", category: "Renal", kind: "comorbidity" },
  { icd10Code: "K21.9", label: "Gastro-oesophageal reflux disease (GERD)", category: "Gastro", kind: "comorbidity" },
  { icd10Code: "M10.9", label: "Gout, unspecified", category: "Musculoskeletal", kind: "comorbidity" },
  { icd10Code: "M06.9", label: "Rheumatoid arthritis, unspecified", category: "Musculoskeletal", kind: "comorbidity" },
  { icd10Code: "F32.9", label: "Depression, unspecified", category: "Mental health", kind: "comorbidity" },
  { icd10Code: "F41.9", label: "Anxiety disorder, unspecified", category: "Mental health", kind: "comorbidity" },
  { icd10Code: "B24", label: "HIV disease", category: "Infectious", kind: "comorbidity" },
  { icd10Code: "B18.9", label: "Chronic viral hepatitis, unspecified", category: "Infectious", kind: "comorbidity" },
  { icd10Code: "Z79.4", label: "Long-term insulin use", category: "Medication history", kind: "comorbidity" },
  { icd10Code: "Z79.01", label: "Long-term anticoagulant use", category: "Medication history", kind: "comorbidity" },
  { icd10Code: "Z87.891", label: "Personal history of nicotine dependence", category: "History", kind: "comorbidity" }
];

/** @deprecated Kept for back-compat; use CONDITION_CATALOG. */
export const OPHTHALMOLOGY_CONDITION_CATALOG = CONDITION_CATALOG;

/** Case-insensitive search over code + label (server-side filter for the picker). */
export const searchConditionCatalog = (query: string, limit = 50): ConditionCatalogEntry[] => {
  const q = query.trim().toLowerCase();
  if (!q) return CONDITION_CATALOG.slice(0, limit);
  const matches = CONDITION_CATALOG.filter(
    (entry) => entry.label.toLowerCase().includes(q) || entry.icd10Code.toLowerCase().includes(q)
  );
  return matches.slice(0, limit);
};
