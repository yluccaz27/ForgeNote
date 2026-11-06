# ForgeNote

Ferramenta de worldbuilding para escrever personagens, organizar o mundo e enxergar como tudo se conecta.

ForgeNote parte de uma ideia simples: **cada coisa existe uma vez só**. Um personagem, uma facção ou um evento é um único note, e as quatro áreas do app são jeitos diferentes de olhar para os mesmos notes. Editou em um lugar, mudou em todos.

## Recursos

**Note**
Tela em três blocos: Identificação (título, tipo e onde o note fica guardado), Ficha (seções com campos de texto, número, data, seleção, relação e imagem) e História (texto livre). Fichas podem virar predefinições reutilizáveis.

**Gaveteiro**
Projetos organizados em gaveteiros e pastas. Um note pode estar em várias pastas ao mesmo tempo, e pastas podem se organizar sozinhas a partir dos campos da ficha.

**Quadro**
Canvas livre onde os notes viram cartões e as relações viram linhas. As conexões vindas da ficha aparecem automaticamente, e as manuais se puxam de um cartão a outro.

**Timeline**
Linha do tempo com calendário próprio (eras, meses e dias customizáveis), zoom, trilhas e eventos que expandem para edição e recolhem para leitura.

Tudo o que se cria pode ser excluído, com confirmação e Desfazer. Itens excluídos ficam 30 dias na lixeira antes de sumir de vez. Pressione `?` no app para ver os atalhos de teclado.

## Stack

| Camada | Tecnologia |
|---|---|
| Interface | React, TypeScript, Vite, Tailwind CSS |
| Estado | TanStack Query, Zustand |
| Quadro | React Flow |
| Editor | TipTap |
| Back-end | Supabase (Auth, Postgres, Storage, Realtime) |
| Hospedagem | GitHub Pages |

## Desenvolvimento

Requer **Node 20+**.

```bash
npm install
npm run dev
```

Sem variáveis de ambiente, o app roda em **modo local**, com os dados salvos no navegador e um conjunto de exemplos fictícios. É útil para desenvolver a interface sem depender do back-end.

### Variáveis de ambiente

Copie `.env.example` para `.env`:

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (anon/publishable) |

O arquivo `.env` não é versionado.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Serve o build localmente |
| `npm run gen:types` | Gera os tipos do banco (requer `SUPABASE_PROJECT_ID`) |

## Deploy

O deploy é feito automaticamente pelo GitHub Actions a cada push na `main`. As variáveis de ambiente são lidas dos *repository secrets*.

## Estrutura

```
src/
  features/    as quatro áreas do app
  lib/         dados, regras de domínio e calendário
supabase/      migrations do banco
```

As migrations ficam em `supabase/migrations` e rodam em ordem. Nenhuma delas insere dados.

## Segurança

O acesso é restrito a contas autorizadas. O cadastro público é desativado, e todos os dados ficam protegidos por políticas de acesso no banco. Nenhum conteúdo de projeto é armazenado neste repositório.

## Licença

Projeto privado. Todos os direitos reservados.
