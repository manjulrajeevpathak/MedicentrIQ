CREATE TABLE IF NOT EXISTS healthcareos_core_records (
  collection text NOT NULL,
  record_id text NOT NULL,
  tenant_id text,
  patient_id text,
  status text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, record_id)
);

ALTER TABLE healthcareos_core_records
  ADD COLUMN IF NOT EXISTS tenant_id text;

CREATE INDEX IF NOT EXISTS idx_healthcareos_core_records_collection
  ON healthcareos_core_records (collection);

CREATE INDEX IF NOT EXISTS idx_healthcareos_core_records_tenant
  ON healthcareos_core_records (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_healthcareos_core_records_patient
  ON healthcareos_core_records (patient_id)
  WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_healthcareos_core_records_status
  ON healthcareos_core_records (status)
  WHERE status IS NOT NULL;
