import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// In-memory PostgreSQL with synthetic Supabase auth scaffolding. No network or real user data.
const pg = await PGlite.create();
try {
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;`);
  await pg.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  const tables = (await pg.query("select tablename from pg_tables where schemaname='public'")).rows;
  assert.equal(tables.length, 26);
  for (const {tablename} of tables) {
    assert.equal((await pg.query(`select count(*)::int n from public."${tablename}"`)).rows[0].n, 0);
  }
  const unprotected = await pg.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and relkind='r' and not relrowsecurity`);
  assert.equal(unprotected.rows.length, 0, 'Every application table must have RLS');
  const broad = await pg.query("select tablename from pg_policies where schemaname='public' and (qual='true' or with_check='true')");
  assert.equal(broad.rows.length, 0);
  console.log('PASS: fresh install, 26 empty tables, RLS enabled and no permissive policies');

  const alice='00000000-0000-4000-8000-000000000001';
  const bob='00000000-0000-4000-8000-000000000002';
  await pg.query('insert into auth.users(id) values ($1),($2)',[alice,bob]);
  async function asUser(id) {
    await pg.exec('RESET ROLE');
    await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    await pg.exec('SET ROLE authenticated');
  }
  await asUser(alice);
  const task=(await pg.query("insert into tasks(title,scheduled_date) values ('Synthetic task','2026-01-01') returning id,user_id")).rows[0];
  await assert.rejects(pg.query("insert into tasks(title) values ('Unscheduled')"),/not-null/);
  assert.equal(task.user_id,alice);
  const goal=(await pg.query("insert into goals(title) values ('Synthetic goal') returning id")).rows[0];
  await pg.query('select increment_actual_minutes($1,5)',[task.id]);
  assert.equal((await pg.query('select actual_minutes from tasks where id=$1',[task.id])).rows[0].actual_minutes,5);
  await asUser(bob);
  assert.equal((await pg.query('select * from tasks')).rows.length,0);
  assert.equal((await pg.query('update tasks set title=$1 where id=$2 returning id',['Unauthorized',task.id])).rows.length,0);
  await assert.rejects(pg.query('insert into tasks(title,scheduled_date,user_id) values ($1,$2,$3)',['Wrong owner','2026-01-01',alice]),/row-level security/);
  await assert.rejects(pg.query('insert into tasks(title,scheduled_date,goal_id) values ($1,$2,$3)',['Wrong goal','2026-01-01',goal.id]),/foreign key/);
  await pg.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(pg.query('select * from tasks'),/permission denied/);
  console.log('PASS: browser ownership, required scheduled date, anonymous denial, authorized time-logging RPC');

  // Service-role access bypasses RLS, but must not create cross-account relationships.
  await pg.exec('RESET ROLE; SET ROLE service_role');
  await assert.rejects(pg.query('insert into tasks(title,scheduled_date,user_id,goal_id) values ($1,$2,$3,$4)',['Bad link','2026-01-01',bob,goal.id]),/foreign key/);
  await assert.rejects(pg.query('insert into goal_logs(user_id,goal_id,note) values ($1,$2,$3)',[bob,goal.id,'Bad link']),/foreign key/);
  await pg.query('insert into goal_logs(user_id,goal_id,note) values ($1,$2,$3)',[alice,goal.id,'Synthetic note']);
  await pg.query('update tasks set goal_id=$1 where id=$2',[goal.id,task.id]);
  await pg.query('delete from goals where id=$1',[goal.id]);
  const remaining=(await pg.query('select user_id,goal_id from tasks where id=$1',[task.id])).rows[0];
  assert.equal(remaining.user_id,alice);assert.equal(remaining.goal_id,null);
  assert.equal((await pg.query('select * from goal_logs')).rows.length,0);
  console.log('PASS: privileged MCP relationship isolation, same-owner links, cascade and SET NULL behavior');

  // Every application FK must carry the owner on both sides, not just an object UUID.
  const unsafe=await pg.query(`select c.conname from pg_constraint c
    join pg_namespace n on n.oid=c.connamespace join pg_class target on target.oid=c.confrelid
    join pg_namespace tn on tn.oid=target.relnamespace
    where c.contype='f' and n.nspname='public' and tn.nspname='public'
      and (array_length(c.conkey,1)<>2 or array_length(c.confkey,1)<>2)`);
  assert.equal(unsafe.rows.length,0);
  console.log('PASS: every application relationship enforces same-owner references');
} catch(e) {
  console.error('Schema verification failed:',e.message);process.exitCode=1;
} finally { await pg.close(); }
