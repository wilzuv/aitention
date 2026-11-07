BEGIN;
-- Independent agent estimates; legacy current_credence is never rewritten.
CREATE TABLE public.agent_credence_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 hypothesis_id uuid NOT NULL,
 expected_revision uuid,
 prior_credence smallint CHECK (prior_credence BETWEEN 0 AND 100),
 posterior_credence smallint CHECK (posterior_credence BETWEEN 0 AND 100),
 rationale text NOT NULL CHECK (length(trim(rationale)) > 0),
 source_references jsonb NOT NULL CHECK (jsonb_typeof(source_references) = 'array'),
 writer_id text NOT NULL CHECK (length(trim(writer_id)) > 0),
 run_id text NOT NULL,
 model_id text,
 idempotency_key text NOT NULL CHECK (length(trim(idempotency_key)) > 0),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (hypothesis_id,user_id) REFERENCES public.hypotheses(id,user_id) ON DELETE CASCADE,
 UNIQUE(user_id,hypothesis_id,idempotency_key)
);
CREATE INDEX agent_credence_history ON public.agent_credence_assessments(user_id,hypothesis_id,recorded_at);
ALTER TABLE public.agent_credence_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_credence_read ON public.agent_credence_assessments FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY agent_credence_insert ON public.agent_credence_assessments FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
REVOKE ALL ON public.agent_credence_assessments FROM anon, authenticated;
GRANT SELECT,INSERT ON public.agent_credence_assessments TO authenticated,service_role;
-- Invoker privileges: both authenticated and privileged MCP calls remain owner-scoped.
CREATE FUNCTION public.check_agent_credence_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE previous public.agent_credence_assessments;
BEGIN
 PERFORM 1 FROM public.hypotheses WHERE id=NEW.hypothesis_id AND user_id=NEW.user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Hypothesis not accessible'; END IF;
 SELECT * INTO previous FROM public.agent_credence_assessments WHERE hypothesis_id=NEW.hypothesis_id AND user_id=NEW.user_id ORDER BY recorded_at DESC, id DESC LIMIT 1;
 IF previous.id IS DISTINCT FROM NEW.expected_revision THEN RAISE EXCEPTION 'Stale agent credence revision'; END IF;
 NEW.prior_credence := previous.posterior_credence;
 NEW.recorded_at := clock_timestamp();
 RETURN NEW;
END $$;
CREATE TRIGGER agent_credence_revision BEFORE INSERT ON public.agent_credence_assessments FOR EACH ROW EXECUTE FUNCTION public.check_agent_credence_revision();
COMMIT;
