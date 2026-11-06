# ForgeNote

Mesa de worldbuilding do ACDB. Tudo é **note**: Gaveteiro, Quadro e Timeline são jeitos diferentes de olhar os mesmos notes. Um note existe uma vez só; editar em um lugar muda em todos.

- **Note**: ficha com abas e campos (texto, número, data no calendário do mundo, seleção, relação, imagem) + notepad (TipTap) com `[[Nome]]`.
- **Gaveteiro**: gaveteiros com capa, pastas manuais e pastas automáticas (por campo com 📁). Um note pode estar em várias pastas.
- **Quadro**: papéis numa mesa de ardósia, fios de lacre. Conexões de campo aparecem sozinhas; linhas manuais se puxam de um papel a outro.
- **Timeline**: calendário próprio (eras, meses, semana), régua com zoom, trilhas livres e por note, eventos que são notes.

Stack: React + Vite + TypeScript, Tailwind, TanStack Query + Zustand, React Flow, TipTap, Supabase (Auth + Postgres + Storage), GitHub Pages.

## Rodar local

Precisa de Node 20+.

```bash
npm install
npm run dev
```

Sem `.env`, o app abre no **modo local**: os dados ficam no `localStorage` deste navegador, já com o seed do ACDB. Bom para testar. "Conta > Restaurar dados de exemplo" zera tudo.

## Ligar ao Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (plano grátis serve).
2. **Desligue o cadastro público**: Authentication > Sign In / Providers > desmarque "Allow new users to sign up". As contas são criadas por você.
3. Crie as duas contas: Authentication > Users > Add user (e-mail + senha, "Auto Confirm User").
4. SQL Editor > cole `supabase/setup_completo.sql` > Run. Ele cria o schema, o RLS, o bucket de imagens, o Realtime, o workspace ACDB **vazio** e põe todos os usuários do Auth como membros.
   - Pelo CLI, o schema sozinho: `supabase link --project-ref SEU_REF` e `supabase db push`; depois rode `supabase/workspace_e_membros.sql`.
   - Conta nova depois? Rode só `supabase/workspace_e_membros.sql` de novo.
5. Copie `.env.example` para `.env` e preencha com Project Settings > API (`Project URL` e a publishable/anon key).

**O banco do Supabase não tem dados de exemplo, de propósito.** Não existe seed SQL no projeto. Os dados de exemplo (`src/lib/seedData.ts`) só alimentam o modo local no navegador.

Workspace novo começa vazio: crie um gaveteiro na aba Gaveteiro e, na Timeline, o calendário do mundo antes da primeira timeline.

A anon key é pública por natureza. **Toda a segurança está no RLS**: cada tabela só deixa ler e escrever quem é membro do workspace. O bucket `imagens` é privado e segue a mesma regra pelo primeiro segmento do caminho (`<workspace_id>/arquivo.webp`).

### Tipos do banco

`src/lib/types.ts` espelha o schema à mão. Para gerar os tipos oficiais:

```bash
SUPABASE_PROJECT_ID=seu-ref npm run gen:types
```

## Deploy no GitHub Pages

1. Suba o repositório no GitHub (branch `main`).
2. Settings > Pages > Source: **GitHub Actions**.
3. Settings > Secrets and variables > Actions > New repository secret:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Faça push. O workflow `.github/workflows/deploy.yml` builda e publica.
5. No Supabase, Authentication > URL Configuration: adicione a URL do Pages (`https://SEU_USUARIO.github.io/SEU_REPO/`) em Site URL / Redirect URLs (usado pelos convites).

O app usa `HashRouter` e `base: './'`, então funciona em qualquer subcaminho sem 404.html.

## Atalhos

| Tecla | O que faz |
|---|---|
| `N` | Novo note |
| `Ctrl+K` | Busca global (título, resumo e texto) |
| `Esc` | Recolhe o evento ou fecha o painel |
| `F` | Modo foco no quadro (no papel selecionado) |
| `Tab` / `Enter` / setas | No quadro: navegar entre papéis, abrir, mover 8px (Shift = 32px) |
| `Ctrl+scroll` | Zoom na timeline, no ponto do cursor |
| `F2` / `Alt+setas` | Renomear / reordenar abas da ficha |

## Decisões tomadas

- **Excluir note referenciado**: o app lista onde ele é usado (campos de relação, eventos, trilhas) e, ao confirmar, remove as referências.
- **Pasta automática de relação** fica ligada ao note de destino por id: renomear o note renomeia a pasta. Pasta automática vazia some.
- **Pasta automática** usa o valor, não o campo: "ID0" vinda de "Facção" e de outro campo é a mesma pasta.
- **Gaveteiro do note** para pastas automáticas: os gaveteiros onde o note já está; se nenhum, o primeiro do workspace.
- **Título**: o campo "Nome"/"Título" e o título do note andam juntos. Sem nenhum dos dois, o título vem da primeira linha do texto e fica marcado como provisório (lápis tracejado, papel esmaecido no quadro).
- **Datas** são número absoluto de dias. Ano sem bissexto; o tamanho do ano é a soma dos meses.
- **Conflito**: last write wins. Com Supabase, o Realtime recarrega a tela quando o outro edita.
- Migrations: a coluna `pastas.regra_campo_id` guarda o **nome** do campo (texto), porque `note_campos` é uma cópia por note. Também há `pastas.regra_valor_texto` (valor de Seleção) e `trilhas.recolhida`.

## Estrutura

```
src/lib/backend.ts    camada de dados (Supabase ou local), mesma interface
src/lib/data.ts       cache TanStack Query + escrita otimista em fila
src/lib/domain.ts     regras: título/resumo provisório, conexões por campo, pastas por regra
src/lib/calendar.ts   calendário customizável
src/features/*        as 4 abas
supabase/migrations   schema + RLS + storage + realtime
```
