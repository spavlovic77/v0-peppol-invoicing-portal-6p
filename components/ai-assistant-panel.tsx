'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAiPanel } from '@/lib/ai-context'
import { X, Trash2, Send, Sparkles, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const SUGGESTIONS = [
  'Co je pravidlo BR-AE-10?',
  'Vysvetli reverse charge',
  'Aky je format CustomizationID?',
  'Ako opravit prazdne XML elementy?',
]

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let msgCounter = 0

export function AiAssistantPanel() {
  const { isOpen, closePanel, pageContext } = useAiPanel()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const pageContextRef = useRef(pageContext)
  pageContextRef.current = pageContext

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

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, status])

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
          fixed top-0 right-0 h-full z-50
          lg:relative lg:z-auto
          flex flex-col
          glass-card-heavy
          border-l border-[var(--glass-border)]
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-[340px] sm:w-[380px] translate-x-0' : 'w-0 translate-x-full lg:translate-x-0'}
        `}
        style={{ overflow: isOpen ? undefined : 'hidden' }}
      >
        {isOpen && (
          <div className="flex flex-col h-full min-w-[340px] sm:min-w-[380px]">
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
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">Ahoj! Som tvoj e-fakturacny asistent.</h4>
                  <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                    Spytaj sa ma na pravidla UBL 2.1, EN16931, Peppol BIS 3.0 alebo slovensku DPH legislativu.
                  </p>
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

function MessageBubble({ message }: { message: ChatMsg }) {
  const isUser = message.role === 'user'
  const text = message.content

  if (!text) return null

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'glass-card text-foreground rounded-bl-md'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          <div className="prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_code]:bg-muted/40 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted/30 [&_pre]:rounded-lg [&_pre]:p-2.5 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1 [&_strong]:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
