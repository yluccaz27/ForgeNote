import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditorContent, useEditor, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { cache } from '../lib/data'
import { noteParaNome, salvarCorpo } from '../lib/domain'
import { toast, useUI } from '../store/ui'

const RE = /\[\[([^[\]\n]{1,80})\]\]/g

function decorar(doc: PMNode, existe: (nome: string) => boolean) {
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (const m of node.text.matchAll(RE)) {
      const from = pos + m.index!, to = from + m[0].length
      decos.push(Decoration.inline(from, to, {
        class: existe(m[1]) ? 'mencao' : 'mencao mencao-quebrada',
        'data-mencao': m[1],
      }))
    }
  })
  return DecorationSet.create(doc, decos)
}

/** [[Nome]] vira link clicável (v1: não gera conexão). */
const Mencoes = Extension.create<{ abrir: (nome: string) => void; existe: (nome: string) => boolean }>({
  name: 'mencoes',
  addOptions() { return { abrir: () => {}, existe: () => false } },
  addProseMirrorPlugins() {
    const opts = this.options
    return [new Plugin({
      key: new PluginKey('mencoes'),
      state: {
        init: (_, { doc }) => decorar(doc, opts.existe),
        apply: (tr, old) => (tr.docChanged ? decorar(tr.doc, opts.existe) : old),
      },
      props: {
        decorations(state) { return this.getState(state) },
        handleClick(_view, _pos, ev) {
          const el = (ev.target as HTMLElement).closest('[data-mencao]') as HTMLElement | null
          if (!el) return false
          // menção quebrada só abre com Ctrl+clique, para deixar corrigir o texto
          if (el.classList.contains('mencao-quebrada') && !(ev.ctrlKey || ev.metaKey)) return false
          opts.abrir(el.dataset.mencao!)
          return true
        },
      },
    })]
  },
})

export function Notepad({ noteId, compacto = false, placeholder }: { noteId: string; compacto?: boolean; placeholder?: string }) {
  const nav = useNavigate()
  const timer = useRef<number>()
  const pendente = useRef<unknown>(null)
  const note = cache('notes').find((n) => n.id === noteId)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2] }, codeBlock: false, code: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Escreva livremente: passado, motivações, segredos…' }),
      Mencoes.configure({
        existe: (nome) => { const ws = useUI.getState().wsId; return !!ws && !!noteParaNome(ws, nome) },
        abrir: (nome) => {
          const ws = useUI.getState().wsId
          if (!ws) return
          const alvo = noteParaNome(ws, nome)
          if (alvo) nav(`/note/${alvo.id}`)
          else toast(`Nenhum note chamado "${nome}".`, { rotulo: 'Criar', fn: () => useUI.getState().abrirCriar({ titulo: nome }) })
        },
      }),
    ],
    content: (note?.corpo_json as object) ?? '',
    editorProps: { attributes: { 'aria-label': 'História', spellcheck: 'true' } },
    onUpdate: ({ editor }) => {
      pendente.current = editor.getJSON()
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => { salvarCorpo(noteId, pendente.current); pendente.current = null }, 500)
    },
  }, [noteId])

  // salva o que faltou ao sair
  useEffect(() => () => {
    clearTimeout(timer.current)
    if (pendente.current) salvarCorpo(noteId, pendente.current)
  }, [noteId])

  return <div className={`notepad ${compacto ? 'notepad-compacto' : ''}`}><EditorContent editor={editor} /></div>
}
