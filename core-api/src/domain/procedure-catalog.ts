/**
 * Curated procedure catalog for the OPD "Advise → Procedure" picker.
 * Ophthalmology-first (launch vertical) plus common referral actions. Admission
 * is intentionally out of scope here — it moves to the IPD feature.
 *
 * Procedures are coded with CPT where a standard code exists (CPT is the
 * procedure-coding standard for outpatient/surgical work); ICD-10-PCS is
 * deliberately NOT used — it is inpatient-only and its descriptions are unusable
 * in a clinician picker. Referral rows carry a short internal code.
 * A fuller CPT set can replace this array behind the same endpoint later.
 */
export type ProcedureCatalogEntry = {
  code: string;
  label: string;
  category: string;
};

export const PROCEDURE_CATALOG: ProcedureCatalogEntry[] = [
  // ---- Cataract / lens -----------------------------------------------------
  { code: "66984", label: "Cataract surgery — phacoemulsification + IOL", category: "Cataract" },
  { code: "66982", label: "Complex cataract surgery + IOL", category: "Cataract" },
  { code: "66983", label: "Cataract extraction (ICCE/ECCE) + IOL", category: "Cataract" },
  { code: "66821", label: "YAG laser posterior capsulotomy", category: "Cataract" },
  { code: "66985", label: "Secondary IOL implantation", category: "Cataract" },

  // ---- Glaucoma ------------------------------------------------------------
  { code: "66170", label: "Trabeculectomy (filtering surgery)", category: "Glaucoma" },
  { code: "66172", label: "Trabeculectomy with scarring/antimetabolite", category: "Glaucoma" },
  { code: "66761", label: "Laser peripheral iridotomy (LPI)", category: "Glaucoma" },
  { code: "65855", label: "Laser trabeculoplasty (SLT/ALT)", category: "Glaucoma" },
  { code: "0191T", label: "Glaucoma drainage device / MIGS stent", category: "Glaucoma" },

  // ---- Retina --------------------------------------------------------------
  { code: "67028", label: "Intravitreal injection (anti-VEGF / steroid)", category: "Retina" },
  { code: "67040", label: "Pars plana vitrectomy", category: "Retina" },
  { code: "67145", label: "Laser retinopexy / prophylaxis (retinal tear)", category: "Retina" },
  { code: "67210", label: "Focal / grid laser photocoagulation", category: "Retina" },
  { code: "67228", label: "Pan-retinal photocoagulation (PRP)", category: "Retina" },

  // ---- Cornea / ocular surface --------------------------------------------
  { code: "65730", label: "Penetrating keratoplasty (corneal graft)", category: "Cornea" },
  { code: "65426", label: "Pterygium excision with graft", category: "Ocular surface" },
  { code: "65420", label: "Pterygium excision without graft", category: "Ocular surface" },
  { code: "65435", label: "Corneal epithelial debridement", category: "Cornea" },
  { code: "0402T", label: "Corneal collagen cross-linking (CXL)", category: "Cornea" },

  // ---- Oculoplasty / adnexa -----------------------------------------------
  { code: "67840", label: "Excision of eyelid lesion", category: "Oculoplasty" },
  { code: "67800", label: "Incision & curettage of chalazion", category: "Oculoplasty" },
  { code: "67917", label: "Ectropion / entropion repair", category: "Oculoplasty" },
  { code: "15823", label: "Blepharoplasty (upper lid)", category: "Oculoplasty" },
  { code: "68761", label: "Punctal plug insertion", category: "Oculoplasty" },
  { code: "68810", label: "Probing of nasolacrimal duct", category: "Oculoplasty" },
  { code: "68720", label: "Dacryocystorhinostomy (DCR)", category: "Oculoplasty" },

  // ---- Refractive / other --------------------------------------------------
  { code: "65855R", label: "LASIK / refractive laser correction", category: "Refractive" },
  { code: "65091", label: "Evisceration of eye", category: "Oculoplasty" },
  { code: "65103", label: "Enucleation of eye", category: "Oculoplasty" },
  { code: "67515", label: "Sub-tenon / peribulbar injection", category: "Procedure" },
  { code: "65205", label: "Removal of corneal / conjunctival foreign body", category: "Procedure" },
  { code: "68840", label: "Lacrimal syringing / irrigation", category: "Procedure" },

  // ---- Referral (admission itself moves to the IPD feature) ----------------
  { code: "REF-SPECIALIST", label: "Refer to specialist / super-speciality", category: "Referral" },
  { code: "REF-HIGHER", label: "Refer to higher centre", category: "Referral" },
  { code: "REF-PHYSICIAN", label: "Refer to physician (systemic work-up)", category: "Referral" }
];

type IndexedProcedure = ProcedureCatalogEntry & { haystack: string };

const INDEX: IndexedProcedure[] = PROCEDURE_CATALOG.map((p) => ({
  ...p,
  haystack: `${p.code} ${p.label}`.toLowerCase()
}));

/** Case-insensitive token-AND search over code + label. Empty query → full list. */
export const searchProcedureCatalog = (query: string, limit = 40): ProcedureCatalogEntry[] => {
  const q = query.trim().toLowerCase();
  if (!q) return PROCEDURE_CATALOG.slice(0, limit);
  const tokens = q.split(/\s+/).filter(Boolean);
  return INDEX.filter((p) => tokens.every((t) => p.haystack.includes(t)))
    .slice(0, limit)
    .map(({ haystack, ...entry }) => entry);
};
