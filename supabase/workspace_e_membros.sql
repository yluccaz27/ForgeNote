-- Só o workspace e os membros, sem schema e sem dados de exemplo.
-- Use se o schema já foi criado, ou depois de adicionar uma conta nova no Auth.
insert into public.workspaces (id, nome)
values ('00000000-0000-4000-8000-000000000001', 'ACDB')
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, user_id, papel)
select '00000000-0000-4000-8000-000000000001', id, 'dono' from auth.users
on conflict do nothing;
