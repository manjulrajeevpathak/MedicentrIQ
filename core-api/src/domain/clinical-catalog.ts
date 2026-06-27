/**
 * Curated ophthalmology ICD-10-CM condition catalog for the clinical condition
 * picker. This is a deliberately small, eye-care-first list — full ICD-10 search
 * (e.g. via an external code service) is a later enhancement. Codes are real
 * ICD-10-CM codes; labels are written for readability in a clinician UI.
 */
export type ConditionCatalogEntry = {
  icd10Code: string;
  label: string;
  category: string;
};

export const OPHTHALMOLOGY_CONDITION_CATALOG: ConditionCatalogEntry[] = [
  { icd10Code: "H25.9", label: "Age-related cataract, unspecified", category: "Cataract" },
  { icd10Code: "H26.9", label: "Cataract, unspecified (other)", category: "Cataract" },
  { icd10Code: "H40.9", label: "Glaucoma, unspecified", category: "Glaucoma" },
  { icd10Code: "H40.10", label: "Primary open-angle glaucoma, unspecified", category: "Glaucoma" },
  { icd10Code: "E11.319", label: "Type 2 diabetes mellitus with unspecified diabetic retinopathy", category: "Retina" },
  { icd10Code: "H35.30", label: "Age-related macular degeneration, unspecified", category: "Retina" },
  { icd10Code: "H04.123", label: "Dry eye syndrome, bilateral", category: "Ocular surface" },
  { icd10Code: "H10.9", label: "Conjunctivitis, unspecified", category: "Ocular surface" },
  { icd10Code: "H11.00", label: "Pterygium, unspecified eye", category: "Ocular surface" },
  { icd10Code: "H52.4", label: "Presbyopia", category: "Refractive" },
  { icd10Code: "H52.10", label: "Myopia, unspecified eye", category: "Refractive" },
  { icd10Code: "H52.7", label: "Disorder of refraction, unspecified", category: "Refractive" }
];
