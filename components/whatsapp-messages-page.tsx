'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Mic,
  Paperclip,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type Person = {
  id: string
  full_name: string
  bio: string | null
  avatar_url: string | null
}

type Conversation = {
  id: string
  user_a: string
  user_b: string
  created_at: string
  updated_at: string
  other?: Person
}

type Message = {
  id: string
  conversation_id: string
  swap_id?: string | null
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'document' | 'audio'
  media_path: string | null
  media_name: string | null
  media_size: number | null
  mime_type: string | null
  duration_ms: number | null
  delivered_at: string | null
  read_at: string | null
  deleted_at: string | null
  created_at: string
  media_url?: string
}

const SELECT = 'id, swap_id, conversation_id, sender_id, content, message_type, media_path, media_name, media_size, mime_type, duration_ms, delivered_at, read_at, deleted_at, created_at'

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || 'S'

const time = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const bytes = (value: number | null) => {
  if (!value) return ''
  if (value < 1024) return `${value} B`
  if (value < 1048576) return `${Math.round(value / 1024)} KB`
  return `${(value / 1048576).toFixed(1)} MB`
}

const duration = (value: number | null) => {
  const seconds = Math.max(0, Math.round((value || 0) / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

export function WhatsAppMessagesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [convos, setConvos] = useState<Conversation[]>([])
  const [selected, setSelected] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [menu, setMenu] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingMs, setRecordingMs] = useState(0)
  const [lightbox, setLightbox] = useState('')
  const [mobileList, setMobileList] = useState(true)

  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingStartedRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const active = convos.find((conversation) => conversation.id === selected)
  const other = active?.other

  async function mediaUrl(path: string | null) {
    if (!path) return ''
    const { data } = await supabase.storage.from('message-media').createSignedUrl(path, 3600)
    return data?.signedUrl || ''
  }

  async function hydrate(rows: Message[]) {
    return Promise.all(rows.map(async (message) => ({
      ...message,
      media_url: message.media_path ? await mediaUrl(message.media_path) : '',
    })))
  }

  async function loadConvos() {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      location.assign('/auth/login?next=/messages')
      return
    }

    const id = auth.user.id
    setUserId(id)

    const { data, error: queryError } = await supabase
      .from('conversations')
      .select('id,user_a,user_b,created_at,updated_at')
      .or(`user_a.eq.${id},user_b.eq.${id}`)
      .order('updated_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }

    const rows = (data || []) as Conversation[]
    const ids = [...new Set(rows.map((conversation) => conversation.user_a === id ? conversation.user_b : conversation.user_a))]
    const people: Record<string, Person> = {}

    if (ids.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,full_name,bio,avatar_url')
        .in('id', ids)

      ;(profiles || []).forEach((profile) => {
        people[profile.id] = profile as Person
      })
    }

    const next = rows.map((conversation) => ({
      ...conversation,
      other: people[conversation.user_a === id ? conversation.user_b : conversation.user_a],
    }))

    setConvos(next)
    setLoading(false)
    setSelected((current) => current || next[0]?.id || '')
  }

  async function loadMessages(conversationId: string) {
    const { data, error: queryError } = await supabase
      .from('messages')
      .select(SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (queryError) {
      setError(queryError.message)
      return
    }

    setMessages(await hydrate((data || []) as Message[]))
    await supabase.rpc('mark_conversation_read', { conversation_id: conversationId })
  }

  useEffect(() => {
    void loadConvos()
  }, [supabase])

  useEffect(() => {
    if (!selected) return
    void loadMessages(selected)
    setMobileList(false)
  }, [selected, supabase])

  useEffect(() => {
    if (!selected) return

    const channel = supabase
      .channel(`wa:${selected}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selected}`,
      }, async (payload) => {
        const message = payload.new as Message
        const hydrated = {
          ...message,
          media_url: message.media_path ? await mediaUrl(message.media_path) : '',
        }
        setMessages((previous) => previous.some((item) => item.id === hydrated.id) ? previous : [...previous, hydrated])
        if (hydrated.sender_id !== userId) {
          await supabase.rpc('mark_conversation_read', { conversation_id: selected })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selected}`,
      }, (payload) => {
        setMessages((previous) => previous.map((message) =>
          message.id === payload.new.id ? { ...message, ...(payload.new as Message) } : message,
        ))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selected, userId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selected])

  async function insertMessage(payload: Partial<Message>) {
    const row = {
      conversation_id: selected,
      sender_id: userId,
      content: payload.content || '',
      message_type: payload.message_type || 'text',
      media_path: payload.media_path || null,
      media_name: payload.media_name || null,
      media_size: payload.media_size || null,
      mime_type: payload.mime_type || null,
      duration_ms: payload.duration_ms || null,
      delivered_at: new Date().toISOString(),
    }

    const { data, error: insertError } = await supabase
      .from('messages')
      .insert(row)
      .select(SELECT)
      .single()

    if (insertError) {
      setError(insertError.message)
      return false
    }

    setMessages((previous) => [...previous, ...(await hydrate([data as Message]))])
    return true
  }

  async function send() {
    const body = text.trim()
    if (!body || busy || !selected) return

    setBusy(true)
    setError('')
    const sent = await insertMessage({ content: body, message_type: 'text' })
    if (sent) setText('')
    setBusy(false)
    inputRef.current?.focus()
  }

  async function upload(file: File) {
    if (!file || !selected || busy) return

    setBusy(true)
    setError('')

    try {
      const messageType = file.type.startsWith('image/') ? 'image' : 'document'
      const extension = file.name.split('.').pop() || 'bin'
      const path = `${userId}/${selected}/${crypto.randomUUID()}.${extension}`
      const uploadResult = await supabase.storage
        .from('message-media')
        .upload(path, file, { contentType: file.type || undefined })

      if (uploadResult.error) throw uploadResult.error

      await insertMessage({
        content: '',
        message_type: messageType,
        media_path: path,
        media_name: file.name,
        media_size: file.size,
        mime_type: file.type,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Attachment failed.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice messages are not supported in this browser.')
      return
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      recordingStartedRef.current = Date.now()

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }

      recorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current)
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)

        const elapsed = Date.now() - recordingStartedRef.current
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (!blob.size) return

        setBusy(true)
        try {
          const path = `${userId}/${selected}/${crypto.randomUUID()}.webm`
          const uploadResult = await supabase.storage
            .from('message-media')
            .upload(path, blob, { contentType: blob.type })

          if (uploadResult.error) throw uploadResult.error

          await insertMessage({
            content: '',
            message_type: 'audio',
            media_path: path,
            media_name: 'Voice message',
            media_size: blob.size,
            mime_type: blob.type,
            duration_ms: elapsed,
          })
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Voice message failed.')
        } finally {
          setBusy(false)
          setRecordingMs(0)
        }
      }

      recorderRef.current = recorder
      setRecording(true)
      setRecordingMs(0)
      recorder.start()
      timerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - recordingStartedRef.current)
      }, 250)
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Microphone access was denied.')
    })
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
  }

  async function deleteMessage(message: Message, everyone: boolean) {
    setMenu(null)

    if (everyone) {
      const { error: rpcError } = await supabase.rpc('delete_message_for_everyone', { message_id: message.id })
      if (rpcError) setError(rpcError.message)
      return
    }

    const { error: deleteError } = await supabase
      .from('message_deletions')
      .insert({ message_id: message.id, user_id: userId })

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setMessages((previous) => previous.filter((item) => item.id !== message.id))
  }

  const filtered = convos.filter((conversation) =>
    !search || conversation.other?.full_name?.toLowerCase().includes(search.toLowerCase()),
  )

  const renderBody = (message: Message) => {
    if (message.deleted_at) return <i className="text-slate-400">This message was deleted</i>

    if (message.message_type === 'image') {
      return message.media_url ? (
        <button className="block overflow-hidden rounded-2xl" onClick={() => setLightbox(message.media_url || '')}>
          <img src={message.media_url} alt={message.media_name || 'Photo'} className="max-h-72 w-auto max-w-full object-cover" />
        </button>
      ) : <span>Loading photo…</span>
    }

    if (message.message_type === 'document') {
      return (
        <a className="flex min-w-[210px] items-center gap-3" href={message.media_url || '#'} target="_blank" rel="noreferrer">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-black/5"><FileText size={18} /></span>
          <span className="min-w-0">
            <b className="block truncate">{message.media_name || 'Document'}</b>
            <small className="opacity-60">{bytes(message.media_size)} · Open document</small>
          </span>
        </a>
      )
    }

    if (message.message_type === 'audio') {
      return (
        <div className="min-w-[220px]">
          <audio controls src={message.media_url || ''} className="w-full" />
          {message.duration_ms ? <div className="mt-1 text-[9px] opacity-50">{duration(message.duration_ms)}</div> : null}
        </div>
      )
    }

    return <span className="whitespace-pre-wrap break-words">{message.content}</span>
  }

  return (
    <div className="app-page-shell">
      <AppSidebar />
      <main className="v1-content !p-0 sm:!p-0">
        <section className="mx-auto flex h-[calc(100vh-40px)] min-h-[620px] max-w-[1320px] overflow-hidden rounded-[28px] border border-white/80 bg-white/80 shadow-[0_30px_90px_rgba(38,57,48,.10)] backdrop-blur-xl">
          <aside className={`w-full shrink-0 border-r border-slate-200/70 bg-white/70 md:w-[350px] ${mobileList ? 'block' : 'hidden md:block'}`}>
            <div className="border-b border-slate-200/70 px-5 pb-4 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black tracking-[.2em] text-emerald-700">YOUR CONNECTIONS</p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Chats</h1>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{convos.length}</span>
              </div>
              <label className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-400">
                <Search size={16} />
                <input className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" />
              </label>
            </div>

            <div className="h-[calc(100%-122px)] overflow-y-auto p-2">
              {loading ? (
                <div className="grid place-items-center py-16 text-slate-400"><LoaderCircle className="animate-spin" size={22} /></div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">
                  No conversations yet.
                  <br />
                  <a className="font-bold text-emerald-700" href="/requests">Accept a swap request to start one.</a>
                </div>
              ) : filtered.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => { setSelected(conversation.id); setMobileList(false) }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${selected === conversation.id ? 'bg-emerald-50 shadow-sm' : 'hover:bg-slate-50'}`}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-emerald-100 text-sm font-black text-emerald-800">
                    {conversation.other?.avatar_url ? <img src={conversation.other.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(conversation.other?.full_name || 'S')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm text-slate-900">{conversation.other?.full_name || 'SkillSwap member'}</b>
                    <small className="mt-0.5 block truncate text-xs text-slate-500">Conversation</small>
                  </span>
                  <time className="text-[10px] text-slate-400">{time(conversation.updated_at || conversation.created_at)}</time>
                </button>
              ))}
            </div>
          </aside>

          <section className={`flex min-w-0 flex-1 flex-col ${mobileList ? 'hidden md:flex' : ''}`}>
            {other ? (
              <>
                <header className="flex h-[82px] shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white/75 px-4 sm:px-6">
                  <button className="grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 md:hidden" onClick={() => setMobileList(true)}><ChevronLeft size={20} /></button>
                  <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => location.assign(`/people/${other.id}`)}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-emerald-100 font-black text-emerald-800">
                      {other.avatar_url ? <img src={other.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(other.full_name)}
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-[15px] text-slate-900">{other.full_name}</b>
                      <small className="text-xs text-emerald-700">SkillSwap connection</small>
                    </span>
                  </button>
                  <button className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" onClick={() => location.assign(`/people/${other.id}`)}><UserRound size={17} /></button>
                </header>

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(221,242,231,.55),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(236,229,207,.35),transparent_30%)] px-4 py-5 sm:px-7">
                  <div className="mx-auto mb-6 rounded-full bg-white/75 px-4 py-2 text-[8px] font-bold tracking-[.17em] text-slate-400 shadow-sm">MESSAGES ARE ENCRYPTED BETWEEN YOU</div>

                  {messages.length === 0 ? (
                    <div className="m-auto max-w-sm text-center text-slate-400">
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/80 text-emerald-700 shadow-sm">✦</div>
                      <h2 className="mt-4 text-lg font-black text-slate-800">Start the conversation</h2>
                      <p className="mt-1 text-sm leading-6">Talk about what you want to learn and what you can teach each other.</p>
                    </div>
                  ) : (
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
                      {messages.map((message) => {
                        const mine = message.sender_id === userId
                        return (
                          <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`group relative max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm ${mine ? 'rounded-br-md bg-[#d9fdd3] text-slate-800' : 'rounded-bl-md bg-white text-slate-800'}`}
                              onContextMenu={(event) => { event.preventDefault(); setMenu(message.id) }}
                            >
                              {renderBody(message)}
                              <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-slate-500">
                                <span>{time(message.created_at)}</span>
                                {mine && !message.deleted_at ? (
                                  <span className={message.read_at ? 'text-sky-500' : 'text-slate-400'}>
                                    <Check size={11} className="inline -mr-1" /><Check size={11} className="inline" />
                                  </span>
                                ) : null}
                              </div>

                              {menu === message.id ? (
                                <div className={`absolute z-20 top-full mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl ${mine ? 'right-0' : 'left-0'}`}>
                                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50" onClick={() => void deleteMessage(message, false)}>
                                    <Trash2 size={14} /> Delete for me
                                  </button>
                                  {mine && !message.deleted_at ? (
                                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => void deleteMessage(message, true)}>
                                      <Trash2 size={14} /> Delete for everyone
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                {error ? <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">{error}</div> : null}

                <div className="relative border-t border-slate-200/70 bg-white/85 p-3 sm:p-4">
                  {recording ? (
                    <div className="flex h-[72px] items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                      <span className="flex-1 text-sm font-semibold text-red-700">Recording voice message · {duration(recordingMs)}</span>
                      <button className="grid h-10 w-10 place-items-center rounded-xl bg-red-600 text-white" onClick={stopRecording}><X size={18} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt,.zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
                      <button disabled={busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" onClick={() => fileRef.current?.click()}><Paperclip size={19} /></button>
                      <button disabled={busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" onClick={startRecording}><Mic size={19} /></button>
                      <input ref={inputRef} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" placeholder="Type a message" />
                      <button disabled={busy || !text.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40" onClick={() => void send()}><Send size={18} /></button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="grid h-full place-items-center p-10 text-center">
                <div><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-emerald-700"><ImageIcon size={24} /></div><h2 className="mt-4 text-xl font-black text-slate-900">Your conversations</h2><p className="mt-1 max-w-sm text-sm text-slate-500">Accept a SkillSwap request to start chatting.</p></div>
              </div>
            )}
          </section>
        </section>
      </main>

      {lightbox ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-5" onClick={() => setLightbox('')}>
          <button className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white" onClick={() => setLightbox('')}><X size={20} /></button>
          <img src={lightbox} alt="Full size attachment" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
  )
}
