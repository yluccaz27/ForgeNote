-- ForgeNote: setup do banco (schema + RLS + storage + realtime) e workspace vazio.
-- Sem dados de exemplo: o banco de produção começa limpo de propósito.
-- Cole tudo no SQL Editor do Supabase e clique Run. Rode uma vez só.

-- ForgeNote: schema inicial + RLS
-- Toda a segurança está aqui: a anon key é pública, então cada tabela tem RLS
-- e só membros do workspace leem/escrevem seus dados.

create extension if not exists "pgcrypto";

-- ───────────────────────── Workspaces ─────────────────────────
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'editor' check (papel in ('dono', 'editor')),
  primary key (workspace_id, user_id)
);

-- security definer evita recursão de RLS em workspace_members
create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

-- ───────────────────────── Predefinições ─────────────────────────
create table public.predefinicoes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null,
  icone text not null default '▣'
);

create table public.predef_abas (
  id uuid primary key default gen_random_uuid(),
  predefinicao_id uuid not null references public.predefinicoes(id) on delete cascade,
  nome text not null,
  ordem int not null default 0
);

create table public.predef_campos (
  id uuid primary key default gen_random_uuid(),
  aba_id uuid not null references public.predef_abas(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('texto','numero','data','selecao','relacao','imagem')),
  config_json jsonb not null default '{}'::jsonb,
  ordem int not null default 0,
  organiza_pasta boolean not null default false
);

-- ───────────────────────── Notes ─────────────────────────
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  predefinicao_id uuid references public.predefinicoes(id) on delete set null,
  titulo text not null default 'Sem título',
  titulo_provisorio boolean not null default true,
  resumo text not null default '',
  resumo_provisorio boolean not null default true,
  corpo_json jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_note()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_note();

create table public.note_abas (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  nome text not null,
  ordem int not null default 0
);

create table public.note_campos (
  id uuid primary key default gen_random_uuid(),
  aba_id uuid not null references public.note_abas(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('texto','numero','data','selecao','relacao','imagem')),
  config_json jsonb not null default '{}'::jsonb,
  ordem int not null default 0,
  organiza_pasta boolean not null default false
);

create table public.note_valores (
  id uuid primary key default gen_random_uuid(),
  campo_id uuid not null unique references public.note_campos(id) on delete cascade,
  valor_json jsonb
);

-- ───────────────────────── Gaveteiros e pastas ─────────────────────────
create table public.gaveteiros (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null,
  cor text not null default '#2F363B',
  icone text not null default '▤',
  capa_url text,
  ordem int not null default 0
);

create table public.pastas (
  id uuid primary key default gen_random_uuid(),
  gaveteiro_id uuid not null references public.gaveteiros(id) on delete cascade,
  nome text not null,
  cor text,
  origem text not null default 'manual' check (origem in ('manual','regra')),
  regra_campo_id text,               -- nome do campo que gera a regra (note_campos é cópia por note, então a regra liga pelo nome)
  regra_valor_note_id uuid references public.notes(id) on delete cascade, -- valor de relação
  regra_valor_texto text              -- valor de seleção
);

create table public.note_pasta (
  note_id uuid not null references public.notes(id) on delete cascade,
  pasta_id uuid not null references public.pastas(id) on delete cascade,
  primary key (note_id, pasta_id)
);

-- ───────────────────────── Quadros ─────────────────────────
create table public.quadros (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null,
  filtro_json jsonb not null default '{"gaveteiros":[],"pastas":[]}'::jsonb
);

create table public.quadro_posicoes (
  quadro_id uuid not null references public.quadros(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  x double precision not null default 0,
  y double precision not null default 0,
  oculto boolean not null default false,
  primary key (quadro_id, note_id)
);

create table public.conexoes (
  id uuid primary key default gen_random_uuid(),
  origem_note_id uuid not null references public.notes(id) on delete cascade,
  destino_note_id uuid not null references public.notes(id) on delete cascade,
  rotulo text not null default '',
  tipo text not null default 'manual' check (tipo in ('manual','campo')),
  campo_id uuid references public.note_campos(id) on delete cascade
);

create table public.quadro_conexoes_ocultas (
  quadro_id uuid not null references public.quadros(id) on delete cascade,
  conexao_id uuid not null references public.conexoes(id) on delete cascade,
  primary key (quadro_id, conexao_id)
);

-- ───────────────────────── Timeline ─────────────────────────
create table public.calendarios (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null,
  config_json jsonb not null
);

create table public.timelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null,
  calendario_id uuid references public.calendarios(id) on delete set null
);

create table public.trilhas (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references public.timelines(id) on delete cascade,
  nome text not null,
  cor text,
  ordem int not null default 0,
  note_id uuid references public.notes(id) on delete set null,
  recolhida boolean not null default false
);

create table public.eventos_timeline (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references public.timelines(id) on delete cascade,
  trilha_id uuid not null references public.trilhas(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  inicio_json jsonb not null,      -- {"dia": <número absoluto de dias>}
  fim_json jsonb,
  expandido boolean not null default false
);

-- ───────────────────────── Índices ─────────────────────────
create index on public.notes (workspace_id);
create index on public.note_abas (note_id);
create index on public.note_campos (aba_id);
create index on public.pastas (gaveteiro_id);
create index on public.note_pasta (pasta_id);
create index on public.conexoes (origem_note_id);
create index on public.conexoes (destino_note_id);
create index on public.eventos_timeline (timeline_id);

-- ───────────────────────── RLS ─────────────────────────
-- helpers de caminho até o workspace
create or replace function public.ws_of_note(n uuid) returns uuid
language sql stable security definer set search_path = public as $$ select workspace_id from public.notes where id = n $$;
create or replace function public.ws_of_note_aba(a uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select n.workspace_id from public.note_abas a2 join public.notes n on n.id = a2.note_id where a2.id = a $$;
create or replace function public.ws_of_note_campo(c uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select n.workspace_id from public.note_campos c2
  join public.note_abas a on a.id = c2.aba_id join public.notes n on n.id = a.note_id where c2.id = c $$;
create or replace function public.ws_of_predef(p uuid) returns uuid
language sql stable security definer set search_path = public as $$ select workspace_id from public.predefinicoes where id = p $$;
create or replace function public.ws_of_predef_aba(a uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.workspace_id from public.predef_abas a2 join public.predefinicoes p on p.id = a2.predefinicao_id where a2.id = a $$;
create or replace function public.ws_of_gaveteiro(g uuid) returns uuid
language sql stable security definer set search_path = public as $$ select workspace_id from public.gaveteiros where id = g $$;
create or replace function public.ws_of_pasta(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select g.workspace_id from public.pastas p2 join public.gaveteiros g on g.id = p2.gaveteiro_id where p2.id = p $$;
create or replace function public.ws_of_quadro(q uuid) returns uuid
language sql stable security definer set search_path = public as $$ select workspace_id from public.quadros where id = q $$;
create or replace function public.ws_of_timeline(t uuid) returns uuid
language sql stable security definer set search_path = public as $$ select workspace_id from public.timelines where id = t $$;
create or replace function public.ws_of_conexao(c uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select n.workspace_id from public.conexoes c2 join public.notes n on n.id = c2.origem_note_id where c2.id = c $$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.predefinicoes enable row level security;
alter table public.predef_abas enable row level security;
alter table public.predef_campos enable row level security;
alter table public.notes enable row level security;
alter table public.note_abas enable row level security;
alter table public.note_campos enable row level security;
alter table public.note_valores enable row level security;
alter table public.gaveteiros enable row level security;
alter table public.pastas enable row level security;
alter table public.note_pasta enable row level security;
alter table public.quadros enable row level security;
alter table public.quadro_posicoes enable row level security;
alter table public.conexoes enable row level security;
alter table public.quadro_conexoes_ocultas enable row level security;
alter table public.calendarios enable row level security;
alter table public.timelines enable row level security;
alter table public.trilhas enable row level security;
alter table public.eventos_timeline enable row level security;

-- workspaces: membros leem; criação/remoção de workspaces e membros fica no painel (service role)
create policy ws_select on public.workspaces for select using (public.is_member(id));
create policy ws_update on public.workspaces for update using (public.is_member(id)) with check (public.is_member(id));
create policy wm_select on public.workspace_members for select using (public.is_member(workspace_id));

-- tabelas com workspace_id direto
create policy pd_all on public.predefinicoes for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy no_all on public.notes for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy gv_all on public.gaveteiros for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy qd_all on public.quadros for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy ca_all on public.calendarios for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy tl_all on public.timelines for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

-- tabelas filhas
create policy pa_all on public.predef_abas for all
  using (public.is_member(public.ws_of_predef(predefinicao_id))) with check (public.is_member(public.ws_of_predef(predefinicao_id)));
create policy pc_all on public.predef_campos for all
  using (public.is_member(public.ws_of_predef_aba(aba_id))) with check (public.is_member(public.ws_of_predef_aba(aba_id)));
create policy na_all on public.note_abas for all
  using (public.is_member(public.ws_of_note(note_id))) with check (public.is_member(public.ws_of_note(note_id)));
create policy nc_all on public.note_campos for all
  using (public.is_member(public.ws_of_note_aba(aba_id))) with check (public.is_member(public.ws_of_note_aba(aba_id)));
create policy nv_all on public.note_valores for all
  using (public.is_member(public.ws_of_note_campo(campo_id))) with check (public.is_member(public.ws_of_note_campo(campo_id)));
create policy ps_all on public.pastas for all
  using (public.is_member(public.ws_of_gaveteiro(gaveteiro_id))) with check (public.is_member(public.ws_of_gaveteiro(gaveteiro_id)));
create policy np_all on public.note_pasta for all
  using (public.is_member(public.ws_of_pasta(pasta_id)) and public.is_member(public.ws_of_note(note_id)))
  with check (public.is_member(public.ws_of_pasta(pasta_id)) and public.is_member(public.ws_of_note(note_id)));
create policy qp_all on public.quadro_posicoes for all
  using (public.is_member(public.ws_of_quadro(quadro_id))) with check (public.is_member(public.ws_of_quadro(quadro_id)));
create policy cx_all on public.conexoes for all
  using (public.is_member(public.ws_of_note(origem_note_id)))
  with check (public.is_member(public.ws_of_note(origem_note_id)) and public.is_member(public.ws_of_note(destino_note_id)));
create policy qo_all on public.quadro_conexoes_ocultas for all
  using (public.is_member(public.ws_of_quadro(quadro_id))) with check (public.is_member(public.ws_of_quadro(quadro_id)) and public.is_member(public.ws_of_conexao(conexao_id)));
create policy tr_all on public.trilhas for all
  using (public.is_member(public.ws_of_timeline(timeline_id))) with check (public.is_member(public.ws_of_timeline(timeline_id)));
create policy ev_all on public.eventos_timeline for all
  using (public.is_member(public.ws_of_timeline(timeline_id)))
  with check (public.is_member(public.ws_of_timeline(timeline_id)) and public.is_member(public.ws_of_note(note_id)));

-- ───────────────────────── Storage (imagens) ─────────────────────────
-- Bucket privado; caminho = <workspace_id>/<arquivo>.webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', false, 2097152, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy img_select on storage.objects for select
  using (bucket_id = 'imagens' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy img_insert on storage.objects for insert
  with check (bucket_id = 'imagens' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy img_update on storage.objects for update
  using (bucket_id = 'imagens' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy img_delete on storage.objects for delete
  using (bucket_id = 'imagens' and public.is_member(((storage.foldername(name))[1])::uuid));

-- ───────────────────────── Realtime ─────────────────────────
alter publication supabase_realtime add table
  public.notes, public.note_abas, public.note_campos, public.note_valores,
  public.pastas, public.note_pasta, public.gaveteiros,
  public.conexoes, public.quadro_posicoes, public.quadro_conexoes_ocultas,
  public.trilhas, public.eventos_timeline;

-- Workspace e membros (pode rodar de novo sem duplicar)
insert into public.workspaces (id, nome)
values ('00000000-0000-4000-8000-000000000001', 'ACDB')
on conflict (id) do nothing;

-- Todos os usuários do Auth viram membros do ACDB (cadastro público está fechado).
insert into public.workspace_members (workspace_id, user_id, papel)
select '00000000-0000-4000-8000-000000000001', id, 'dono' from auth.users
on conflict do nothing;
