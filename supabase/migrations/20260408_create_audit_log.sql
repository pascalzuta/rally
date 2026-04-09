-- Audit log table for tracking changes to key tables
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL, -- INSERT, UPDATE, DELETE
  old_data jsonb,
  new_data jsonb,
  changed_by uuid, -- auth.uid()
  changed_at timestamptz DEFAULT now()
);

-- Enable RLS but allow all reads for admins
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read audit" ON audit_log FOR SELECT USING (true);
CREATE POLICY "System insert audit" ON audit_log FOR INSERT WITH CHECK (true);

-- Trigger function
CREATE OR REPLACE FUNCTION audit_tournament_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (
    'tournaments',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
CREATE TRIGGER tournament_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION audit_tournament_changes();
