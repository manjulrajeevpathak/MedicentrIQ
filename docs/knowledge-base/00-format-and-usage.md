# Knowledge Base — Format & Usage Guide

This folder is the RAG corpus for the WhatsApp assistant. One file per
condition/service. The content is written for **patients** (the bot's
audience), reviewed by the hospital before going live.

## Why the documents look the way they do (RAG design rules)

1. **One idea per `##` section.** Each H2 section is a self-contained chunk:
   it names the condition explicitly (never "it" or "this disease" as the
   first reference), so a chunk retrieved alone still makes sense.
2. **Q&A blocks mirror real patient phrasing.** Retrieval matches patient
   questions best when the corpus contains the questions themselves
   ("Will cataract surgery hurt?"), not just encyclopedic prose.
3. **~100–300 words per section.** Long enough to answer, short enough that
   a retriever can pack 3–5 chunks into the model's context.
4. **Frontmatter metadata** (`topic`, `aliases`, `priority`) supports
   filtering and boosts. `aliases` include Hindi/Hinglish terms patients
   actually type (motiyabind, chashma, bhengapan…).
5. **No hospital-specific pricing, doctor names, or timings.** Those live in
   the per-tenant Assistant settings (topics/policy) and change often. The
   corpus is clinical/educational content only, so one corpus serves every
   tenant.
6. **Red flags are repeated per-disease AND collected in
   `12-emergencies-red-flags.md`.** Safety guidance must be retrievable from
   either direction.
7. **The bot must never diagnose or prescribe.** Every file ends with the
   same safety footer; the assistant's policy layer enforces this too.

## How to load into the assistant

Today the assistant injects knowledge items from Assistant → Knowledge
wholesale into the prompt. These files are larger than that budget, so:

- **Interim (works today):** paste the "Summary for prompt" section of each
  file (the first `##` block) as a knowledge item; the bot hands off deeper
  questions.
- **Target (RAG):** index every H2 section of every file as one vector-store
  chunk with its frontmatter as metadata; retrieve top-k per inbound message
  and inject only those chunks. The section structure here is already the
  chunking — split on `^## `.

## File map

| File | Topic | Priority |
|---|---|---|
| 01-cataract.md | Cataract, surgery types, IOLs | P1 |
| 02-refractive-errors.md | Myopia, hyperopia, astigmatism, presbyopia | P1 |
| 03-lasik-refractive-surgery.md | LASIK, PRK, SMILE, ICL | P2 |
| 04-glaucoma.md | Glaucoma (kala motia) | P1 |
| 05-diabetic-retinopathy.md | Diabetic retinopathy | P1 |
| 06-retinal-diseases.md | Retinal detachment, ARMD, RVO, macular hole | P1 |
| 07-cornea.md | Keratoconus, infections, transplant | P2 |
| 08-squint-pediatric.md | Squint, lazy eye, paediatric eye care | P2 |
| 09-oculoplasty.md | Ptosis, stye/chalazion, watering eyes, sockets | P2 |
| 10-uveitis-red-eye.md | Uveitis, conjunctivitis, dry eye | P2 |
| 11-low-vision.md | Low-vision rehabilitation | P3 |
| 12-emergencies-red-flags.md | When to come NOW | P1 |
