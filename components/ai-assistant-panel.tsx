'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAiPanel } from '@/lib/ai-context'
import { X, Trash2, Send, Sparkles, Loader2 } from 'lucide-react'

const SUGGESTIONS = [
  'Nie som plátca DPH. Musím vedieť prijať e-faktúru?',
  'Vysvetli mi ako mám zaokrúhľovať tak, aby bola faktúra platná',
  'Ako mám vytvárať opravné faktúry?',
  'Kto musí vystavovať elektronickú faktúru na Slovensku? Od kedy?',
]

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let msgCounter = 0

export function AiAssistantPanel() {
  const { pageContext } = useAiPanel()
  const [isOpen, setIsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const pageContextRef = useRef(pageContext)
  pageContextRef.current = pageContext

  // Listen for toggle events from navbar
  useEffect(() => {
    const handler = () => setIsOpen((v) => !v)
    window.addEventListener('ai-panel-toggle', handler)
    return () => window.removeEventListener('ai-panel-toggle', handler)
  }, [])

  // Broadcast state back to navbar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ai-panel-state', { detail: { open: isOpen } }))
  }, [isOpen])

  function closePanel() {
    setIsOpen(false)
  }

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMsg = { id: `u-${++msgCounter}`, role: 'user', content: text }
    const asstMsg: ChatMsg = { id: `a-${++msgCounter}`, role: 'assistant', content: '' }
    setMessages((prev) => [...prev, userMsg, asstMsg])
    setIsLoading(true)

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

    try {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, pageContext: pageContextRef.current }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) throw new Error('Failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            // Custom SSE format: { type: 'text-delta', textDelta: '...' }
            if (parsed.type === 'text-delta' && parsed.textDelta) {
              fullText += parsed.textDelta
              setMessages((prev) => prev.map((m) => m.id === asstMsg.id ? { ...m, content: fullText } : m))
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setMessages((prev) => prev.map((m) => m.id === asstMsg.id ? { ...m, content: 'Chyba pri komunikacii s AI. Skuste to znova.' } : m))
      }
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  // Auto-scroll to bottom on every message update (including streaming chunks)
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen])

  function handleSubmit(text?: string) {
    const msg = (text || input).trim()
    if (!msg || isLoading) return
    sendMessage(msg)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={closePanel}
        />
      )}

      {/* Panel */}
      <aside
        className={`
          fixed top-0 right-0 h-dvh z-50
          lg:relative lg:z-auto lg:h-full
          flex flex-col
          glass-card-heavy
          border-l border-[var(--glass-border)]
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-[340px] sm:w-[380px] translate-x-0' : 'w-0 translate-x-full lg:translate-x-0'}
        `}
        style={{ overflow: isOpen ? undefined : 'hidden' }}
      >
        {isOpen && (
          <div className="flex flex-col h-full min-h-0 min-w-[340px] sm:min-w-[380px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground leading-tight">Peppol Asistent</h3>
                  <p className="text-[10px] text-muted-foreground">UBL 2.1 / EN16931 / BIS 3.0</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={() => setMessages([])}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Vymazat konverzaciu"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={closePanel}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">Ahoj! Som tvoj e-fakturacny asistent.</h4>

                  <div className="grid grid-cols-1 gap-2 w-full">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSubmit(s)}
                        className="text-left text-xs px-3 py-2 rounded-xl glass-card hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))
              )}

              {isLoading && messages.length > 0 && messages[messages.length - 1].content === '' && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">Premyslam...</span>
                </div>
              )}
            </div>

            {/* Context badge */}
            {Object.keys(pageContext).length > 0 && (
              <div className="px-3 pb-1">
                <span className="inline-flex items-center gap-1 text-[10px] text-primary/80 bg-primary/5 px-2 py-0.5 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  Kontext: {String(pageContext.page || 'aktivna stranka')}
                </span>
              </div>
            )}

            {/* Input */}
            <div className="px-3 pb-3 pt-1">
              <div className="flex items-end gap-2 glass-card rounded-xl px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Poloz otazku..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-24"
                  style={{ minHeight: '20px' }}
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim() || isLoading}
                  className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

/** Lightweight inline markdown: **bold**, `code`, ```blocks```, - lists, ### headings */
function renderSimpleMarkdown(md: string) {
  const blocks: React.ReactNode[] = []
  const lines = md.split('\n')
  let i = 0

  while (i < lines.length) {
    // Code block
    if (lines[i].startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      blocks.push(
        <pre key={`cb-${i}`} className="bg-muted/30 rounded-lg p-2.5 overflow-x-auto my-2">
          <code className="text-xs">{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    const line = lines[i]
    i++

    // Empty line
    if (!line.trim()) continue

    // Heading
    const hMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (hMatch) {
      const level = hMatch[1].length
      const cls = level <= 2 ? 'text-sm font-semibold mt-3 mb-1' : 'text-xs font-semibold mt-2 mb-1'
      blocks.push(<div key={`h-${i}`} className={cls}>{inlineFormat(hMatch[2])}</div>)
      continue
    }

    // List item
    if (line.match(/^\s*[-*]\s+/)) {
      const items: string[] = [line.replace(/^\s*[-*]\s+/, '')]
      while (i < lines.length && lines[i].match(/^\s*[-*]\s+/)) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc list-inside mb-2 space-y-0.5">
          {items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}
        </ul>
      )
      continue
    }

    // Numbered list
    if (line.match(/^\s*\d+\.\s+/)) {
      const items: string[] = [line.replace(/^\s*\d+\.\s+/, '')]
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s+/)) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside mb-2 space-y-0.5">
          {items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}
        </ol>
      )
      continue
    }

    // Paragraph
    blocks.push(<p key={`p-${i}`} className="mb-2 last:mb-0">{inlineFormat(line)}</p>)
  }

  return blocks
}

/** Format inline: **bold**, `code` */
function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2]) {
      parts.push(<strong key={match.index} className="text-foreground font-semibold">{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<code key={match.index} className="bg-muted/40 px-1 py-0.5 rounded text-xs">{match[3]}</code>)
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function MessageBubble({ message }: { message: ChatMsg }) {
  const isUser = message.role === 'user'
  const text = message.content

  if (!text) return null

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${isUser
          ? 'bg-primary text-primary-foreground rounded-br-md'
          : 'glass-card text-foreground rounded-bl-md'
          }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          <div className="max-w-none">
            {renderSimpleMarkdown(text)}
          </div>
        )}
      </div>
    </div>
  )
}
