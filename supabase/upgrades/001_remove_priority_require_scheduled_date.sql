-- Upgrade for databases installed from an earlier schema.sql.
-- Removes task priority and makes tasks.scheduled_date required (the Inbox of
-- unscheduled tasks is gone). Fresh installations already match; do not run
-- this on them. Transactional: a failure leaves the database unchanged.

BEGIN;

-- Former Inbox tasks have no scheduled date; plan them for today.
UPDATE public.tasks SET scheduled_date = CURRENT_DATE WHERE scheduled_date IS NULL;

ALTER TABLE public.tasks
    DROP CONSTRAINT tasks_priority_check,
    DROP COLUMN priority,
    ALTER COLUMN scheduled_date SET NOT NULL;

DROP INDEX public.tasks_unique_open_recurring_per_day;
CREATE UNIQUE INDEX tasks_unique_open_recurring_per_day ON public.tasks USING btree (user_id, title, scheduled_date) WHERE ((status = 'open'::text) AND (recurrence_rule IS NOT NULL));

COMMIT;
