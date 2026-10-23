-- Aitention: fresh-install schema for a NEW Supabase project (PostgreSQL 15+).
-- No imported records, old migrations, or deployment identifiers.
-- Run once in the Supabase SQL Editor. Failure rolls the entire installation back.
BEGIN;
SET LOCAL check_function_bodies = false;
SET LOCAL search_path = public, extensions;

CREATE FUNCTION public.enforce_prediction_immutability() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF OLD.outcome IS NOT NULL THEN
    IF NEW.prediction IS DISTINCT FROM OLD.prediction
       OR NEW.confidence IS DISTINCT FROM OLD.confidence
       OR NEW.reasoning IS DISTINCT FROM OLD.reasoning THEN
      RAISE EXCEPTION 'Cannot modify prediction/confidence/reasoning after resolution';
    END IF;
  END IF;
  NEW.updated_at = now();
  IF NEW.outcome IS NOT NULL AND OLD.outcome IS NULL THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.increment_actual_minutes(task_id uuid, add_minutes integer) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$ UPDATE public.tasks SET actual_minutes=coalesce(actual_minutes,0)+add_minutes, updated_at=now() WHERE id=task_id AND user_id=auth.uid() $$;

CREATE TABLE public.app_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL
);

CREATE TABLE public.decision_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    decision_id uuid NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    title text NOT NULL,
    context text NOT NULL,
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    chosen_option text,
    rationale text,
    decided_at timestamp with time zone,
    review_date date,
    reviewed_at timestamp with time zone,
    review_outcome text,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid,
    milestone_id uuid,
    CONSTRAINT decisions_review_outcome_check CHECK (((review_outcome IS NULL) OR (review_outcome = ANY (ARRAY['good_call'::text, 'wrong_call'::text, 'partial'::text, 'inconclusive'::text])))),
    CONSTRAINT decisions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'decided'::text, 'abandoned'::text])))
);

CREATE TABLE public.experiment_hypotheses (
    experiment_id uuid NOT NULL,
    hypothesis_id uuid NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.experiment_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    experiment_id uuid NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    logged_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.experiments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    title text NOT NULL,
    protocol text NOT NULL,
    success_criteria text,
    status text DEFAULT 'running'::text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    conclusion text,
    concluded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid,
    milestone_id uuid,
    CONSTRAINT experiments_status_check CHECK ((status = ANY (ARRAY['running'::text, 'concluded'::text, 'abandoned'::text])))
);

CREATE TABLE public.focus_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    duration_minutes integer,
    post_session_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    pre_session_notes text,
    enjoyment_rating integer,
    source text DEFAULT 'manual'::text NOT NULL,
    CONSTRAINT focus_sessions_enjoyment_rating_check CHECK (((enjoyment_rating >= 1) AND (enjoyment_rating <= 7))),
    CONSTRAINT focus_sessions_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'agent'::text, 'mcp_external'::text])))
);


CREATE TABLE public.foundations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    title text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.goal_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    goal_id uuid NOT NULL,
    kind text DEFAULT 'note'::text NOT NULL,
    note text,
    from_status text,
    to_status text,
    logged_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_logs_check CHECK (((kind <> 'note'::text) OR (note IS NOT NULL))),
    CONSTRAINT goal_logs_from_status_check CHECK (((from_status IS NULL) OR (from_status = ANY (ARRAY['done'::text, 'failed'::text, 'dropped'::text])))),
    CONSTRAINT goal_logs_kind_check CHECK ((kind = ANY (ARRAY['note'::text, 'status_change'::text]))),
    CONSTRAINT goal_logs_to_status_check CHECK (((to_status IS NULL) OR (to_status = ANY (ARRAY['done'::text, 'failed'::text, 'dropped'::text]))))
);

CREATE TABLE public.goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    status text,
    parent_goal_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    notes text,
    review_date date,
    closed_at timestamp with time zone,
    foundation_id uuid,
    project_id uuid,
    milestone_id uuid,
    CONSTRAINT goals_status_check CHECK (((status IS NULL) OR (status = ANY (ARRAY['done'::text, 'failed'::text, 'dropped'::text]))))
);


CREATE TABLE public.hypotheses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    decision_id uuid,
    statement text NOT NULL,
    current_credence smallint CONSTRAINT hypotheses_confidence_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    basis text,
    archived_at timestamp with time zone,
    project_id uuid,
    milestone_id uuid,
    CONSTRAINT hypotheses_confidence_check CHECK (((current_credence >= 0) AND (current_credence <= 100)))
);

CREATE TABLE public.hypothesis_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    hypothesis_id uuid NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    prior_credence smallint,
    posterior_credence smallint,
    CONSTRAINT hypothesis_evidence_posterior_credence_check CHECK (((posterior_credence >= 0) AND (posterior_credence <= 100))),
    CONSTRAINT hypothesis_evidence_prior_credence_check CHECK (((prior_credence >= 0) AND (prior_credence <= 100)))
);

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    entry_date date NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.linear_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    identifier text NOT NULL,
    team_key text NOT NULL,
    title text,
    status text,
    url text,
    metadata_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.mcp_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    name text NOT NULL,
    token_hash text NOT NULL,
    token_prefix text NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.mood_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    logged_at timestamp with time zone DEFAULT now() NOT NULL,
    mood_rating integer,
    energy_rating integer,
    note text,
    context text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mood_logs_context_check CHECK ((context = ANY (ARRAY['morning_plan'::text, 'evening_review'::text, 'post_session'::text, 'manual'::text]))),
    CONSTRAINT mood_logs_energy_rating_check CHECK (((energy_rating >= 1) AND (energy_rating <= 7))),
    CONSTRAINT mood_logs_mood_rating_check CHECK (((mood_rating >= 1) AND (mood_rating <= 7)))
);

CREATE TABLE public.oura_daily_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    date date NOT NULL,
    readiness_score smallint,
    sleep_score smallint,
    sleep_hours numeric(4,2),
    steps integer,
    raw jsonb,
    synced_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    prediction text NOT NULL,
    confidence integer NOT NULL,
    reasoning text,
    source text NOT NULL,
    resolution_date date CONSTRAINT predictions_resolution_due_date_not_null NOT NULL,
    outcome text,
    resolution text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid,
    hypothesis_id uuid,
    milestone_id uuid,
    CONSTRAINT predictions_confidence_check CHECK (((confidence >= 0) AND (confidence <= 100))),
    CONSTRAINT predictions_outcome_check CHECK (((outcome IS NULL) OR (outcome = ANY (ARRAY['hit'::text, 'miss'::text, 'unresolvable'::text])))),
    CONSTRAINT predictions_source_check CHECK ((source = ANY (ARRAY['user'::text, 'agent'::text])))
);

CREATE TABLE public.project_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    target_date date,
    sort_order double precision DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    name text,
    description text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT projects_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);

CREATE TABLE public.recurrence_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    scheduled_for date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.session_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    session_id uuid NOT NULL,
    task_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    linked_when text NOT NULL,
    CONSTRAINT session_tasks_linked_when_check CHECK ((linked_when = ANY (ARRAY['before'::text, 'after'::text])))
);

CREATE TABLE public.task_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    task_id uuid NOT NULL,
    note text NOT NULL,
    logged_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    due_date date,
    scheduled_date date NOT NULL,
    goal_id uuid,
    estimated_minutes integer,
    actual_minutes integer DEFAULT 0,
    success_criteria text,
    notes text,
    reflection text,
    recurrence_rule jsonb,
    completed_at timestamp with time zone,
    discarded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid DEFAULT auth.uid() NOT NULL,
    schedule_history jsonb DEFAULT '[]'::jsonb,
    "position" integer DEFAULT 0 NOT NULL,
    linear_ticket_id uuid,
    project_id uuid,
    milestone_id uuid,
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'discarded'::text])))
);

CREATE TABLE public.user_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    provider text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_expires_at timestamp with time zone,
    connected_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    skill_name text NOT NULL,
    content text NOT NULL,
    is_override boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_setting_key_user_id_key UNIQUE (setting_key, user_id);

ALTER TABLE ONLY public.decision_notes
    ADD CONSTRAINT decision_notes_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.decision_notes
    ADD CONSTRAINT decision_notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.experiment_hypotheses
    ADD CONSTRAINT experiment_hypotheses_pkey PRIMARY KEY (experiment_id, hypothesis_id);

ALTER TABLE ONLY public.experiment_logs
    ADD CONSTRAINT experiment_logs_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.experiment_logs
    ADD CONSTRAINT experiment_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.foundations
    ADD CONSTRAINT foundations_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.foundations
    ADD CONSTRAINT foundations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.goal_logs
    ADD CONSTRAINT goal_logs_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.goal_logs
    ADD CONSTRAINT goal_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hypotheses
    ADD CONSTRAINT hypotheses_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.hypotheses
    ADD CONSTRAINT hypotheses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hypothesis_evidence
    ADD CONSTRAINT hypothesis_evidence_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.hypothesis_evidence
    ADD CONSTRAINT hypothesis_evidence_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.linear_tickets
    ADD CONSTRAINT linear_tickets_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.linear_tickets
    ADD CONSTRAINT linear_tickets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.linear_tickets
    ADD CONSTRAINT linear_tickets_user_identifier_unique UNIQUE (user_id, identifier);

ALTER TABLE ONLY public.mcp_tokens
    ADD CONSTRAINT mcp_tokens_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.mcp_tokens
    ADD CONSTRAINT mcp_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mcp_tokens
    ADD CONSTRAINT mcp_tokens_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.mood_logs
    ADD CONSTRAINT mood_logs_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.mood_logs
    ADD CONSTRAINT mood_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.oura_daily_records
    ADD CONSTRAINT oura_daily_records_date_user_id_key UNIQUE (date, user_id);

ALTER TABLE ONLY public.oura_daily_records
    ADD CONSTRAINT oura_daily_records_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.oura_daily_records
    ADD CONSTRAINT oura_daily_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.recurrence_completions
    ADD CONSTRAINT recurrence_completions_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.recurrence_completions
    ADD CONSTRAINT recurrence_completions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_tasks
    ADD CONSTRAINT session_tasks_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.session_tasks
    ADD CONSTRAINT session_tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_tasks
    ADD CONSTRAINT session_tasks_session_id_task_id_user_id_key UNIQUE (session_id, task_id, user_id);

ALTER TABLE ONLY public.task_logs
    ADD CONSTRAINT task_logs_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.task_logs
    ADD CONSTRAINT task_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_integrations
    ADD CONSTRAINT user_integrations_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.user_integrations
    ADD CONSTRAINT user_integrations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_integrations
    ADD CONSTRAINT user_integrations_user_id_provider_key UNIQUE (user_id, provider);

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT user_skills_id_owner_key UNIQUE (id, user_id);

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT user_skills_pkey PRIMARY KEY (id);

CREATE INDEX decision_notes_decision_idx ON public.decision_notes USING btree (decision_id, created_at);

CREATE INDEX decision_notes_user_idx ON public.decision_notes USING btree (user_id);

CREATE INDEX decisions_user_review_date_idx ON public.decisions USING btree (user_id, review_date) WHERE ((status = 'decided'::text) AND (review_date IS NOT NULL) AND (reviewed_at IS NULL));

CREATE INDEX decisions_user_status_idx ON public.decisions USING btree (user_id, status);

CREATE INDEX experiment_hypotheses_hypothesis_idx ON public.experiment_hypotheses USING btree (hypothesis_id);

CREATE INDEX experiment_hypotheses_user_idx ON public.experiment_hypotheses USING btree (user_id);

CREATE INDEX experiment_logs_experiment_idx ON public.experiment_logs USING btree (experiment_id, logged_at);

CREATE INDEX experiment_logs_user_idx ON public.experiment_logs USING btree (user_id);

CREATE INDEX experiments_user_status_idx ON public.experiments USING btree (user_id, status);

CREATE INDEX focus_sessions_user_source_idx ON public.focus_sessions USING btree (user_id, source);

CREATE INDEX goal_logs_goal_idx ON public.goal_logs USING btree (goal_id, logged_at);

CREATE INDEX goal_logs_user_idx ON public.goal_logs USING btree (user_id);

CREATE INDEX hypotheses_decision_idx ON public.hypotheses USING btree (decision_id) WHERE (decision_id IS NOT NULL);

CREATE INDEX hypotheses_user_archived_idx ON public.hypotheses USING btree (user_id, archived_at);

CREATE INDEX hypothesis_evidence_hypothesis_idx ON public.hypothesis_evidence USING btree (hypothesis_id, created_at);

CREATE INDEX hypothesis_evidence_user_idx ON public.hypothesis_evidence USING btree (user_id);

CREATE INDEX idx_decisions_milestone ON public.decisions USING btree (milestone_id) WHERE (milestone_id IS NOT NULL);

CREATE INDEX idx_decisions_project ON public.decisions USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX idx_experiments_milestone ON public.experiments USING btree (milestone_id) WHERE (milestone_id IS NOT NULL);

CREATE INDEX idx_experiments_project ON public.experiments USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX idx_focus_sessions_date ON public.focus_sessions USING btree (entry_date);

CREATE INDEX idx_focus_sessions_started ON public.focus_sessions USING btree (started_at);

CREATE INDEX idx_foundations_user ON public.foundations USING btree (user_id);

CREATE INDEX idx_goals_foundation ON public.goals USING btree (foundation_id) WHERE (foundation_id IS NOT NULL);

CREATE INDEX idx_goals_milestone ON public.goals USING btree (milestone_id) WHERE (milestone_id IS NOT NULL);

CREATE INDEX idx_goals_open ON public.goals USING btree (user_id) WHERE (status IS NULL);

CREATE INDEX idx_goals_project ON public.goals USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX idx_goals_review_date ON public.goals USING btree (user_id, review_date) WHERE (review_date IS NOT NULL);

CREATE INDEX idx_hypotheses_milestone ON public.hypotheses USING btree (milestone_id) WHERE (milestone_id IS NOT NULL);

CREATE INDEX idx_hypotheses_project ON public.hypotheses USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX idx_predictions_hypothesis ON public.predictions USING btree (hypothesis_id) WHERE (hypothesis_id IS NOT NULL);

CREATE INDEX idx_predictions_milestone ON public.predictions USING btree (milestone_id) WHERE (milestone_id IS NOT NULL);

CREATE INDEX idx_predictions_project ON public.predictions USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX idx_project_milestones_project ON public.project_milestones USING btree (project_id, sort_order);

CREATE INDEX idx_project_milestones_user ON public.project_milestones USING btree (user_id);

CREATE INDEX idx_projects_user ON public.projects USING btree (user_id);

CREATE INDEX idx_recurrence_completions_task_id ON public.recurrence_completions USING btree (task_id);

CREATE INDEX idx_recurrence_completions_user_id ON public.recurrence_completions USING btree (user_id);

CREATE INDEX idx_tasks_day_position ON public.tasks USING btree (user_id, scheduled_date, "position");

CREATE INDEX idx_tasks_due_date ON public.tasks USING btree (due_date);

CREATE INDEX idx_tasks_goal_id ON public.tasks USING btree (goal_id) WHERE (goal_id IS NOT NULL);

CREATE INDEX idx_tasks_milestone ON public.tasks USING btree (milestone_id) WHERE (milestone_id IS NOT NULL);

CREATE INDEX idx_tasks_project ON public.tasks USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX idx_tasks_scheduled_date ON public.tasks USING btree (scheduled_date);

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);

CREATE INDEX idx_tasks_user_id ON public.tasks USING btree (user_id);

CREATE INDEX journal_entries_entry_date_idx ON public.journal_entries USING btree (entry_date);

CREATE INDEX journal_entries_user_id_idx ON public.journal_entries USING btree (user_id);

CREATE INDEX linear_tickets_user_id_idx ON public.linear_tickets USING btree (user_id);

CREATE INDEX linear_tickets_user_identifier_idx ON public.linear_tickets USING btree (user_id, identifier);

CREATE INDEX linear_tickets_user_team_idx ON public.linear_tickets USING btree (user_id, team_key);

CREATE INDEX mcp_tokens_token_hash_active_idx ON public.mcp_tokens USING btree (token_hash) WHERE (revoked_at IS NULL);

CREATE INDEX mcp_tokens_user_id_idx ON public.mcp_tokens USING btree (user_id);

CREATE INDEX mood_logs_user_id_logged_at_idx ON public.mood_logs USING btree (user_id, logged_at);

CREATE INDEX oura_daily_records_user_id_date_idx ON public.oura_daily_records USING btree (user_id, date);

CREATE INDEX oura_daily_records_user_id_idx ON public.oura_daily_records USING btree (user_id);

CREATE INDEX predictions_open ON public.predictions USING btree (user_id, resolution_date) WHERE (outcome IS NULL);

CREATE INDEX predictions_user_lookup ON public.predictions USING btree (user_id, resolution_date);

CREATE INDEX session_tasks_session_id_idx ON public.session_tasks USING btree (session_id);

CREATE INDEX session_tasks_task_id_idx ON public.session_tasks USING btree (task_id);

CREATE INDEX session_tasks_user_id_idx ON public.session_tasks USING btree (user_id);

CREATE INDEX task_logs_task_idx ON public.task_logs USING btree (task_id, logged_at);

CREATE INDEX task_logs_user_idx ON public.task_logs USING btree (user_id);

CREATE INDEX tasks_linear_ticket_id_idx ON public.tasks USING btree (linear_ticket_id) WHERE (linear_ticket_id IS NOT NULL);

CREATE UNIQUE INDEX tasks_unique_open_recurring_per_day ON public.tasks USING btree (user_id, title, scheduled_date) WHERE ((status = 'open'::text) AND (recurrence_rule IS NOT NULL));

CREATE INDEX user_integrations_user_id_idx ON public.user_integrations USING btree (user_id);

CREATE INDEX user_skills_user_id ON public.user_skills USING btree (user_id);

CREATE UNIQUE INDEX user_skills_user_skill ON public.user_skills USING btree (user_id, skill_name);

CREATE TRIGGER predictions_immutable_after_resolution BEFORE UPDATE ON public.predictions FOR EACH ROW EXECUTE FUNCTION public.enforce_prediction_immutability();

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.decision_notes
    ADD CONSTRAINT decision_notes_decision_id_fkey FOREIGN KEY (decision_id, user_id) REFERENCES public.decisions(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_notes
    ADD CONSTRAINT decision_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_milestone_id_fkey FOREIGN KEY (milestone_id, user_id) REFERENCES public.project_milestones(id, user_id) ON DELETE SET NULL (milestone_id);

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_project_id_fkey FOREIGN KEY (project_id, user_id) REFERENCES public.projects(id, user_id) ON DELETE SET NULL (project_id);

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.experiment_hypotheses
    ADD CONSTRAINT experiment_hypotheses_experiment_id_fkey FOREIGN KEY (experiment_id, user_id) REFERENCES public.experiments(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.experiment_hypotheses
    ADD CONSTRAINT experiment_hypotheses_hypothesis_id_fkey FOREIGN KEY (hypothesis_id, user_id) REFERENCES public.hypotheses(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.experiment_hypotheses
    ADD CONSTRAINT experiment_hypotheses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.experiment_logs
    ADD CONSTRAINT experiment_logs_experiment_id_fkey FOREIGN KEY (experiment_id, user_id) REFERENCES public.experiments(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.experiment_logs
    ADD CONSTRAINT experiment_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_milestone_id_fkey FOREIGN KEY (milestone_id, user_id) REFERENCES public.project_milestones(id, user_id) ON DELETE SET NULL (milestone_id);

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_project_id_fkey FOREIGN KEY (project_id, user_id) REFERENCES public.projects(id, user_id) ON DELETE SET NULL (project_id);

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.foundations
    ADD CONSTRAINT foundations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.goal_logs
    ADD CONSTRAINT goal_logs_goal_id_fkey FOREIGN KEY (goal_id, user_id) REFERENCES public.goals(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.goal_logs
    ADD CONSTRAINT goal_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_foundation_id_fkey FOREIGN KEY (foundation_id, user_id) REFERENCES public.foundations(id, user_id) ON DELETE SET NULL (foundation_id);

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_milestone_id_fkey FOREIGN KEY (milestone_id, user_id) REFERENCES public.project_milestones(id, user_id) ON DELETE SET NULL (milestone_id);

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_parent_goal_id_fkey FOREIGN KEY (parent_goal_id, user_id) REFERENCES public.goals(id, user_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_project_id_fkey FOREIGN KEY (project_id, user_id) REFERENCES public.projects(id, user_id) ON DELETE SET NULL (project_id);

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.hypotheses
    ADD CONSTRAINT hypotheses_decision_id_fkey FOREIGN KEY (decision_id, user_id) REFERENCES public.decisions(id, user_id) ON DELETE SET NULL (decision_id);

ALTER TABLE ONLY public.hypotheses
    ADD CONSTRAINT hypotheses_milestone_id_fkey FOREIGN KEY (milestone_id, user_id) REFERENCES public.project_milestones(id, user_id) ON DELETE SET NULL (milestone_id);

ALTER TABLE ONLY public.hypotheses
    ADD CONSTRAINT hypotheses_project_id_fkey FOREIGN KEY (project_id, user_id) REFERENCES public.projects(id, user_id) ON DELETE SET NULL (project_id);

ALTER TABLE ONLY public.hypotheses
    ADD CONSTRAINT hypotheses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hypothesis_evidence
    ADD CONSTRAINT hypothesis_evidence_hypothesis_id_fkey FOREIGN KEY (hypothesis_id, user_id) REFERENCES public.hypotheses(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hypothesis_evidence
    ADD CONSTRAINT hypothesis_evidence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.linear_tickets
    ADD CONSTRAINT linear_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mcp_tokens
    ADD CONSTRAINT mcp_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.mood_logs
    ADD CONSTRAINT mood_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.oura_daily_records
    ADD CONSTRAINT oura_daily_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_hypothesis_id_fkey FOREIGN KEY (hypothesis_id, user_id) REFERENCES public.hypotheses(id, user_id) ON DELETE SET NULL (hypothesis_id);

ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_milestone_id_fkey FOREIGN KEY (milestone_id, user_id) REFERENCES public.project_milestones(id, user_id) ON DELETE SET NULL (milestone_id);

ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_project_id_fkey FOREIGN KEY (project_id, user_id) REFERENCES public.projects(id, user_id) ON DELETE SET NULL (project_id);

ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id, user_id) REFERENCES public.projects(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.recurrence_completions
    ADD CONSTRAINT recurrence_completions_task_id_fkey FOREIGN KEY (task_id, user_id) REFERENCES public.tasks(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.recurrence_completions
    ADD CONSTRAINT recurrence_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.session_tasks
    ADD CONSTRAINT session_tasks_session_id_fkey FOREIGN KEY (session_id, user_id) REFERENCES public.focus_sessions(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_tasks
    ADD CONSTRAINT session_tasks_task_id_fkey FOREIGN KEY (task_id, user_id) REFERENCES public.tasks(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_tasks
    ADD CONSTRAINT session_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.task_logs
    ADD CONSTRAINT task_logs_task_id_fkey FOREIGN KEY (task_id, user_id) REFERENCES public.tasks(id, user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.task_logs
    ADD CONSTRAINT task_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_goal_id_fkey FOREIGN KEY (goal_id, user_id) REFERENCES public.goals(id, user_id) ON DELETE SET NULL (goal_id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_linear_ticket_id_fkey FOREIGN KEY (linear_ticket_id, user_id) REFERENCES public.linear_tickets(id, user_id) ON DELETE SET NULL (linear_ticket_id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_milestone_id_fkey FOREIGN KEY (milestone_id, user_id) REFERENCES public.project_milestones(id, user_id) ON DELETE SET NULL (milestone_id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id, user_id) REFERENCES public.projects(id, user_id) ON DELETE SET NULL (project_id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.user_integrations
    ADD CONSTRAINT user_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT user_skills_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

CREATE POLICY "Users own data" ON public.app_settings TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users own data" ON public.focus_sessions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users own data" ON public.goals TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users own data" ON public.journal_entries TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users own data" ON public.mood_logs TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users own data" ON public.session_tasks TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users own data" ON public.tasks TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users own recurrence completions" ON public.recurrence_completions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.decision_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_notes_owner ON public.decision_notes TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY decisions_owner ON public.decisions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.experiment_hypotheses ENABLE ROW LEVEL SECURITY;

CREATE POLICY experiment_hypotheses_owner ON public.experiment_hypotheses TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.experiment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY experiment_logs_owner ON public.experiment_logs TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY experiments_owner ON public.experiments TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.foundations ENABLE ROW LEVEL SECURITY;

CREATE POLICY foundations_user_policy ON public.foundations TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.goal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY goal_logs_owner ON public.goal_logs TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hypotheses ENABLE ROW LEVEL SECURITY;

CREATE POLICY hypotheses_owner ON public.hypotheses TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.hypothesis_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY hypothesis_evidence_owner ON public.hypothesis_evidence TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.linear_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY linear_tickets_user_scope ON public.linear_tickets TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY mcp_tokens_owner ON public.mcp_tokens TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.oura_daily_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY predictions_user_scope ON public.predictions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_milestones_user_policy ON public.project_milestones TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_user_policy ON public.projects TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.recurrence_completions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session_tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_logs_owner ON public.task_logs TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_skills_user_policy ON public.user_skills TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "users manage own integrations" ON public.user_integrations TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "users manage own oura records" ON public.oura_daily_records TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- Explicit API permissions; RLS restricts authenticated users to their own rows.
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
REVOKE ALL ON public.app_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
REVOKE ALL ON public.decision_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_notes TO authenticated;
GRANT ALL ON public.decision_notes TO service_role;
REVOKE ALL ON public.decisions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;
REVOKE ALL ON public.experiment_hypotheses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiment_hypotheses TO authenticated;
GRANT ALL ON public.experiment_hypotheses TO service_role;
REVOKE ALL ON public.experiment_logs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiment_logs TO authenticated;
GRANT ALL ON public.experiment_logs TO service_role;
REVOKE ALL ON public.experiments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiments TO authenticated;
GRANT ALL ON public.experiments TO service_role;
REVOKE ALL ON public.focus_sessions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.focus_sessions TO authenticated;
GRANT ALL ON public.focus_sessions TO service_role;
REVOKE ALL ON public.foundations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foundations TO authenticated;
GRANT ALL ON public.foundations TO service_role;
REVOKE ALL ON public.goal_logs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_logs TO authenticated;
GRANT ALL ON public.goal_logs TO service_role;
REVOKE ALL ON public.goals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
REVOKE ALL ON public.hypotheses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hypotheses TO authenticated;
GRANT ALL ON public.hypotheses TO service_role;
REVOKE ALL ON public.hypothesis_evidence FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hypothesis_evidence TO authenticated;
GRANT ALL ON public.hypothesis_evidence TO service_role;
REVOKE ALL ON public.journal_entries FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
REVOKE ALL ON public.linear_tickets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linear_tickets TO authenticated;
GRANT ALL ON public.linear_tickets TO service_role;
REVOKE ALL ON public.mcp_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_tokens TO authenticated;
GRANT ALL ON public.mcp_tokens TO service_role;
REVOKE ALL ON public.mood_logs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mood_logs TO authenticated;
GRANT ALL ON public.mood_logs TO service_role;
REVOKE ALL ON public.oura_daily_records FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oura_daily_records TO authenticated;
GRANT ALL ON public.oura_daily_records TO service_role;
REVOKE ALL ON public.predictions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;
REVOKE ALL ON public.project_milestones FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
GRANT ALL ON public.project_milestones TO service_role;
REVOKE ALL ON public.projects FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
REVOKE ALL ON public.recurrence_completions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurrence_completions TO authenticated;
GRANT ALL ON public.recurrence_completions TO service_role;
REVOKE ALL ON public.session_tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_tasks TO authenticated;
GRANT ALL ON public.session_tasks TO service_role;
REVOKE ALL ON public.task_logs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_logs TO authenticated;
GRANT ALL ON public.task_logs TO service_role;
REVOKE ALL ON public.tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
REVOKE ALL ON public.user_integrations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_integrations TO authenticated;
GRANT ALL ON public.user_integrations TO service_role;
REVOKE ALL ON public.user_skills FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skills TO authenticated;
GRANT ALL ON public.user_skills TO service_role;

REVOKE ALL ON FUNCTION public.increment_actual_minutes(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_actual_minutes(uuid, integer) TO authenticated;
COMMIT;
