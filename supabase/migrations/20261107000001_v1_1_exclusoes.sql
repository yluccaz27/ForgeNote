-- ForgeNote v1.1: exclusão com desfazer (soft delete), título ligado ao Nome
-- e conexões manuais ligadas ao quadro onde nasceram.
-- Não altera a migration inicial. Não insere dados.

-- ───────── soft delete ─────────
alter table public.notes          add column if not exists deleted_at timestamptz;
alter table public.gaveteiros     add column if not exists deleted_at timestamptz;
alter table public.pastas         add column if not exists deleted_at timestamptz;
alter table public.quadros        add column if not exists deleted_at timestamptz;
alter table public.calendarios    add column if not exists deleted_at timestamptz;
alter table public.timelines      add column if not exists deleted_at timestamptz;
alter table public.trilhas        add column if not exists deleted_at timestamptz;
alter table public.predefinicoes  add column if not exists deleted_at timestamptz;

-- ───────── título do note acompanha o campo Nome ─────────
alter table public.notes add column if not exists titulo_ligado boolean not null default true;

-- ───────── conexão manual lembra o quadro onde foi puxada ─────────
alter table public.conexoes add column if not exists quadro_id uuid references public.quadros(id) on delete set null;

-- ───────── leitura sem a lixeira ─────────
-- As policies de acesso continuam por membro do workspace: o "Desfazer" precisa
-- enxergar a linha excluída para restaurá-la (UPDATE exige passar no USING).
-- A lixeira fica fora das leituras do app pelo filtro deleted_at is null, e
-- estas policies RESTRICTIVE garantem que ninguém crie linhas já excluídas.
create policy no_sem_lixo_ins on public.notes as restrictive for insert with check (deleted_at is null);
create policy gv_sem_lixo_ins on public.gaveteiros as restrictive for insert with check (deleted_at is null);
create policy ps_sem_lixo_ins on public.pastas as restrictive for insert with check (deleted_at is null);
create policy qd_sem_lixo_ins on public.quadros as restrictive for insert with check (deleted_at is null);
create policy ca_sem_lixo_ins on public.calendarios as restrictive for insert with check (deleted_at is null);
create policy tl_sem_lixo_ins on public.timelines as restrictive for insert with check (deleted_at is null);
create policy tr_sem_lixo_ins on public.trilhas as restrictive for insert with check (deleted_at is null);
create policy pd_sem_lixo_ins on public.predefinicoes as restrictive for insert with check (deleted_at is null);

create index if not exists notes_deleted_at on public.notes (deleted_at) where deleted_at is not null;

-- ───────── limpeza definitiva depois de 30 dias ─────────
-- O app chama esta função ao abrir. Se o pg_cron estiver ativo no projeto,
-- dá para agendar também: select cron.schedule('forgenote-lixeira', '0 4 * * *', 'select public.limpar_lixeira()');
create or replace function public.limpar_lixeira()
returns void language plpgsql security invoker set search_path = public as $$
declare limite timestamptz := now() - interval '30 days';
begin
  delete from public.eventos_timeline e using public.notes n where e.note_id = n.id and n.deleted_at < limite;
  delete from public.notes where deleted_at < limite;
  delete from public.pastas where deleted_at < limite;
  delete from public.gaveteiros where deleted_at < limite;
  delete from public.quadros where deleted_at < limite;
  delete from public.trilhas where deleted_at < limite;
  delete from public.timelines where deleted_at < limite;
  delete from public.calendarios c where deleted_at < limite
    and not exists (select 1 from public.timelines t where t.calendario_id = c.id and t.deleted_at is null);
  delete from public.predefinicoes where deleted_at < limite;
end $$;
grant execute on function public.limpar_lixeira() to authenticated;

-- ───────── realtime das tabelas que agora também mudam por exclusão ─────────
alter publication supabase_realtime add table
  public.quadros, public.calendarios, public.timelines,
  public.predefinicoes, public.predef_abas, public.predef_campos;
