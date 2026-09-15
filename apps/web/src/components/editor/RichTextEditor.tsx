import React, { useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold, Italic, Underline as UnderlineIcon,
  Heading2, Heading3, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Undo, Redo, Code,
  Quote, Minus, Eye
} from "lucide-react"
import { ReadabilityHighlight } from "./readability"

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Your generated post will appear here...",
  editable = true,
}: RichTextEditorProps) {
  const [showReadability, setShowReadability] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }) as any,
      Placeholder.configure({ placeholder }),
      ReadabilityHighlight,
    ],
    content,
    editable,
    onCreate: ({ editor }) => {
      setWordCount(countWords(editor.getText()))
    },
    onUpdate: ({ editor }) => {
      setWordCount(countWords(editor.getText()))
      onChangeRef.current(editor.getHTML())
    },
  })

  // Sync external content changes (e.g. streaming AI output)
  useEffect(() => {
    if (!editor) return
    // Only update if content changed externally (streaming)
    if (!editor.isFocused && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false })
      setWordCount(countWords(editor.getText()))
    }
  }, [content, editor])

  // Sync editable state dynamically
  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editable, editor])

  if (!editor) return null

  const ToolbarButton = ({
    onClick,
    active = false,
    disabled = false,
    title,
    children,
  }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    title: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-purple-100 text-purple-700"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )

  return (
    <div className={`flex flex-col h-full border border-gray-200 rounded-xl overflow-hidden bg-white ${showReadability ? 'show-readability' : ''}`}>
      <style>{`
        .show-readability .readability-long-sentence {
          background-color: #fef3c7;
          border-bottom: 2px solid #fcd34d;
        }
        .show-readability .readability-complex-word {
          background-color: #dbeafe;
          border-bottom: 2px solid #93c5fd;
        }
      `}</style>

      {/* Toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 
                        border-b border-gray-100 bg-gray-50 flex-shrink-0">

          {/* Undo / Redo */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Headings */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Text formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline"
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            title="Inline code"
          >
            <Code className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered list"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Quote"
          >
            <Quote className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Divider"
          >
            <Minus className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Alignment */}
          <ToolbarButton
            onClick={() => (editor.chain().focus() as any).setTextAlign("left").run()}
            active={editor.isActive({ textAlign: "left" })}
            title="Align left"
          >
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => (editor.chain().focus() as any).setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
            title="Align center"
          >
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => (editor.chain().focus() as any).setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
            title="Align right"
          >
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Link */}
          <ToolbarButton
            onClick={() => {
              const url = window.prompt("Enter URL:")
              if (url) editor.chain().focus().setLink({ href: url }).run()
            }}
            active={editor.isActive("link")}
            title="Add link"
          >
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Readability Toggle */}
          <ToolbarButton
            onClick={() => setShowReadability(!showReadability)}
            active={showReadability}
            title="Highlight Readability Issues"
          >
            <Eye className={`w-4 h-4 ${showReadability ? 'text-purple-600' : ''}`} />
          </ToolbarButton>

          {/* Character count — right aligned */}
          <div className="ml-auto text-xs text-gray-400 pr-1">
            {wordCount} words
          </div>
        </div>
      )}

      {/* Editor content area */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto px-6 py-4 prose prose-sm max-w-none
                   focus:outline-none [&_.ProseMirror]:min-h-full 
                   [&_.ProseMirror]:outline-none
                   [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
                   [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-300
                   [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
                   [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left"
      />
    </div>
  )
}
