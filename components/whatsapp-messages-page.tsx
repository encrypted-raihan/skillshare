'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, FileText, Image as ImageIcon, LoaderCircle, Mic, Paperclip, Search, Send, Trash2, UserRound, X } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { createClient } from '@/lib/supabase/client'

type Person = { id: string; full_name: string; bio: string | null; avatar_url: string | null }
type Conversation = { id: string; user_a: string; user_b: string; created_at: string; updated_at: string; other?: Person }
type Message = {
  id: string; conversation_id: string; swap_id?: string | null; sender_id: string; content: string
  message_type: 'text' | 'image' | 'document' | 'audio'; media_path: string | null; media_name: string | null
  media_size: number | null; mime_type: string | null; duration_ms: number | null; delivered_at: string | null
  read_at: string | null; deleted_at: string | null; created_at: string; media_url?: string
}

const SELECT = 'id, swap_id, conversation_id, sender_id, content, message_type, media_path, media_name, media_size, mime_type, duration_ms, delivered_at, read_at, deleted_at, created_at'
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') || 'S'
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const bytes = (value: number | null) => !value ? '' : value < 1024 ? `${value} B` : value < 1048576 ? `${Math.round(value / 1024)} KB` : `${(value / 1048576).toFixed(1)} MB`
const duration = (value: number | null) => { const seconds = Math.max(0, Math.round((value || 0) / 1000)); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` }

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingStartedRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const active = convos.find(c => c.id === selected)
  const other = active?.other

  async function mediaUrl(path: string | null) {
    if (!path) return ''
    const { data } = await supabase.storage.from('message-media').createSignedUrl(path, 3600)
    return data?.signedUrl || ''
  }

  async function hydrate(rows: Message[]) {
    return Promise.all(rows.map(async message => ({ ...message, media_url: message.media_path ? await mediaUrl(message.media_path) : '' })))
  }

  async function loadConvos() {
    setError('')
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { location.assign('/auth/login?next=/messages'); return }
    const id = auth.user.id
    setUserId(id)
    const { data, error: queryError } = await supabase.from('conversations').select('id,user_a,user_b,created_at,updated_at').or(`user_a.eq.${id},user_b.eq.${id}`).order('updated_at', { ascending: false })
    if (queryError) { setError(queryError.message); setLoading(false); return }
    const rows = (data || []) as Conversation[]
    const ids = [...new Set(rows.map(c => c.user_a === id ? c.user_b : c.user_a))]
    const people: Record<string, Person> = {}
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,full_name,bio,avatar_url').in('id', ids)
      ;(profiles || []).forEach(profile => { people[profile.id] = profile as Person })
    }
    setConvos(rows.map(c => ({ ...c, other: people[c.user_a === id ? c.user_b : c.user_a] })))
    setLoading(false)
    setSelected(current => current || rows[0]?.id || '')
  }

  async function loadMessages(conversationId: string) {
    const { data, error: queryError } = await supabase.from('messages').select(SELECT).eq('conversation_id', conversationId).order('created_at', { ascending: true })
    if (queryError) { setError(queryError.message); return }
    setMessages(await hydrate((data || []) as Message[]))
    const { error: readError } = await supabase.rpc('mark_conversation_read', { conversation_id: conversationId })
    if (readError && !readError.message.toLowerCase().includes('function')) setError(readError.message)
  }

  useEffect(() => { void loadConvos() }, [supabase])
  useEffect(() => { if (!selected) return; void loadMessages(selected); setMobileList(false) }, [selected, supabase])

  useEffect(() => {
    if (!selected) return
    const channel = supabase.channel(`wa:${selected}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selected}` }, async payload => {
        const message = payload.new as Message
        const hydrated = { ...message, media_url: message.media_path ? await mediaUrl(message.media_path) : '' }
        setMessages(previous => previous.some(item => item.id === hydrated.id) ? previous : [...previous, hydrated])
        if (hydrated.sender_id !== userId) await supabase.rpc('mark_conversation_read', { conversation_id: selected })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selected}` }, payload => {
        setMessages(previous => previous.map(message => message.id === payload.new.id ? { ...message, ...(payload.new as Message) } : message))
      }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [selected, userId, supabase])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length, selected])

  async function insertMessage(payload: Partial<Message>) {
    const row = {
      conversation_id: selected, sender_id: userId, content: payload.content || '', message_type: payload.message_type || 'text',
      media_path: payload.media_path || null, media_name: payload.media_name || null, media_size: payload.media_size || null,
      mime_type: payload.mime_type || null, duration_ms: payload.duration_ms || null, delivered_at: new Date().toISOString(),
    }
    const { data, error: insertError } = await supabase.from('messages').insert(row).select(SELECT).single()
    if (insertError) { setError(insertError.message); return false }
    const hydrated = await hydrate([data as Message])
    setMessages(previous => [...previous, ...hydrated])
    return true
  }

  async function send() {
    const body = text.trim(); if (!body || busy || !selected) return
    setBusy(true); setError('')
    const sent = await insertMessage({ content: body, message_type: 'text' })
    if (sent) setText('')
    setBusy(false); inputRef.current?.focus()
  }

  async function upload(file: File) {
    if (!file || !selected || busy) return
    setBusy(true); setError('')
    try {
      const messageType = file.type.startsWith('image/') ? 'image' : 'document'
      const extension = file.name.split('.').pop() || 'bin'
      const path = `${userId}/${selected}/${crypto.randomUUID()}.${extension}`
      const uploadResult = await supabase.storage.from('message-media').upload(path, file, { contentType: file.type || undefined })
      if (uploadResult.error) throw uploadResult.error
      const sent = await insertMessage({ content: '', message_type: messageType, media_path: path, media_name: file.name, media_size: file.size, mime_type: file.type })
      if (!sent) await supabase.storage.from('message-media').remove([path])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Attachment failed.') }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Voice messages are not supported in this browser.'); return }
    void navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const recorder = new MediaRecorder(stream); const chunks: BlobPart[] = []; recordingStartedRef.current = Date.now()
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current); stream.getTracks().forEach(track => track.stop()); setRecording(false)
        const elapsed = Date.now() - recordingStartedRef.current; const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); if (!blob.size) return
        setBusy(true)
        try {
          const path = `${userId}/${selected}/${crypto.randomUUID()}.webm`
          const result = await supabase.storage.from('message-media').upload(path, blob, { contentType: blob.type })
          if (result.error) throw result.error
          const sent = await insertMessage({ content: '', message_type: 'audio', media_path: path, media_name: 'Voice message', media_size: blob.size, mime_type: blob.type, duration_ms: elapsed })
          if (!sent) await supabase.storage.from('message-media').remove([path])
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Voice message failed.') }
        finally { setBusy(false); setRecordingMs(0) }
      }
      recorderRef.current = recorder; setRecording(true); setRecordingMs(0); recorder.start()
      timerRef.current = setInterval(() => setRecordingMs(Date.now() - recordingStartedRef.current), 250)
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Microphone access was denied.'))
  }

  function stopRecording() { if (timerRef.current) clearInterval(timerRef.current); recorderRef.current?.stop(); recorderRef.current = null }

  async function deleteMessage(message: Message, everyone: boolean) {
    setMenu(null)
    if (everyone) { const { error: rpcError } = await supabase.rpc('delete_message_for_everyone', { message_id: message.id }); if (rpcError) setError(rpcError.message); return }
    const { error: deleteError } = await supabase.from('message_deletions').insert({ message_id: message.id, user_id: userId })
    if (deleteError) { setError(deleteError.message); return }
    setMessages(previous => previous.filter(item => item.id !== message.id))
  }

  const filtered = convos.filter(c => !search || c.other?.full_name?.toLowerCase().includes(search.toLowerCase()))

  const renderBody = (message: Message) => {
    if (message.deleted_at) return <i className="wa-deleted">This message was deleted</i>
    if (message.message_type === 'image') return message.media_url ? <button className="wa-image-button" onClick={() => setLightbox(message.media_url || '')}><img src={message.media_url} alt={message.media_name || 'Photo'} /></button> : <span>Loading photo…</span>
    if (message.message_type === 'document') return <a className="wa-document" href={message.media_url || '#'} target="_blank" rel="noreferrer"><span className="wa-document-icon"><FileText size={18} /></span><span><b>{message.media_name || 'Document'}</b><small>{bytes(message.media_size)} · Open document</small></span></a>
    if (message.message_type === 'audio') return <div className="wa-audio"><audio controls src={message.media_url || ''} />{message.duration_ms ? <small>{duration(message.duration_ms)}</small> : null}</div>
    return <span className="wa-text">{message.content}</span>
  }

  return (
    <div className="wa-page">
      <AppSidebar />
      <main className="wa-main">
        <div className="wa-heading"><p>YOUR CONNECTIONS</p><h1>Chats</h1><span>Chat with people whose swap requests you accepted.</span></div>
        <section className="wa-card">
          <aside className={`wa-list ${mobileList ? '' : 'wa-list-mobile-hidden'}`}>
            <div className="wa-list-head"><div className="wa-list-title"><div><p>YOUR CONNECTIONS</p><h2>Chats</h2></div><b>{convos.length}</b></div><label><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats" /></label></div>
            <div className="wa-list-body">
              {loading ? <div className="wa-empty"><LoaderCircle className="wa-spin" size={24} /><span>Loading conversations…</span></div> : filtered.length === 0 ? <div className="wa-empty"><UserRound size={34} /><strong>No conversations yet.</strong><a href="/requests">Accept a swap request to start one.</a></div> : filtered.map(c => <button key={c.id} className={`wa-convo ${selected === c.id ? 'active' : ''}`} onClick={() => { setSelected(c.id); setMobileList(false) }}><span className="wa-avatar">{c.other?.avatar_url ? <img src={c.other.avatar_url} alt="" /> : initials(c.other?.full_name || 'SkillSwap member')}</span><span className="wa-convo-copy"><b>{c.other?.full_name || 'SkillSwap member'}</b><small>SkillSwap connection</small></span><time>{time(c.updated_at || c.created_at)}</time></button>)}
            </div>
          </aside>

          <section className={`wa-chat ${mobileList ? 'wa-chat-mobile-hidden' : ''}`}>
            {other ? <>
              <header className="wa-chat-head"><button className="wa-back" onClick={() => setMobileList(true)}><ChevronLeft size={20} /></button><button className="wa-person" onClick={() => location.assign(`/people/${other.id}`)}><span className="wa-avatar">{other.avatar_url ? <img src={other.avatar_url} alt="" /> : initials(other.full_name)}</span><span><b>{other.full_name}</b><small>SkillSwap connection</small></span></button><button className="wa-profile" onClick={() => location.assign(`/people/${other.id}`)}><UserRound size={18} /></button></header>
              <div className="wa-messages"><div className="wa-encrypted">MESSAGES ARE ENCRYPTED BETWEEN YOU</div>{messages.length === 0 ? <div className="wa-start"><div>✦</div><h2>Start the conversation</h2><p>Talk about what you want to learn and what you can teach each other.</p></div> : <div className="wa-message-stack">{messages.map(message => { const mine = message.sender_id === userId; return <div key={message.id} className={`wa-row ${mine ? 'mine' : ''}`}><div className={`wa-bubble ${mine ? 'mine' : ''}`} onContextMenu={event => { event.preventDefault(); setMenu(message.id) }}>{renderBody(message)}<footer><span>{time(message.created_at)}</span>{mine ? <span className={message.read_at ? 'wa-read' : ''}><Check size={11} /><Check size={11} /></span> : null}</footer>{menu === message.id ? <div className={`wa-menu ${mine ? 'right' : 'left'}`}><button onClick={() => void deleteMessage(message, false)}><Trash2 size={13} />Delete for me</button>{mine ? <button className="danger" onClick={() => void deleteMessage(message, true)}><Trash2 size={13} />Delete for everyone</button> : null}</div> : null}</div></div> })}<div ref={bottomRef} /></div>}</div>
              {error ? <div className="wa-error">{error}</div> : null}
              <div className="wa-composer">{recording ? <div className="wa-recording"><span></span><b>Recording {duration(recordingMs)}</b><button onClick={stopRecording}>Stop & send</button></div> : <div className="wa-input"><button disabled={busy} onClick={() => fileRef.current?.click()}><Paperclip size={19} /></button><input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt,.zip,.ppt,.pptx,.xls,.xlsx" className="wa-hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file) }} /><input ref={inputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} placeholder="Write a message..." disabled={busy} />{text.trim() ? <button className="wa-send" disabled={busy} onClick={() => void send()}><Send size={17} /></button> : <button disabled={busy} onClick={startRecording}><Mic size={19} /></button>}</div>}</div>
            </> : <div className="wa-no-selection"><div><ImageIcon size={30} /><p>Select a conversation to start chatting.</p></div></div>}
          </section>
        </section>
        {lightbox ? <div className="wa-lightbox" onClick={() => setLightbox('')}><button onClick={() => setLightbox('')}><X size={20} /></button><img src={lightbox} alt="Preview" onClick={e => e.stopPropagation()} /></div> : null}
      </main>
      <style jsx>{`
        .wa-page{min-height:100vh;display:flex;background:radial-gradient(circle at 18% 5%,#e4f1e9 0,transparent 28%),radial-gradient(circle at 88% 88%,#e9f0ea 0,transparent 28%),#f5f8f6;color:#10211a}
        .wa-main{flex:1;min-width:0;padding:30px 32px 32px}
        .wa-heading{max-width:1240px;margin:0 auto 18px}.wa-heading p,.wa-list-title p{margin:0;color:#5f7b6c;font-size:10px;font-weight:900;letter-spacing:.2em}.wa-heading h1{margin:4px 0 7px;font-size:52px;line-height:1;letter-spacing:-.055em}.wa-heading>span{color:#718077;font-size:14px}
        .wa-card{height:calc(100vh - 155px);min-height:620px;max-width:1240px;margin:auto;display:flex;overflow:hidden;border:1px solid rgba(31,65,50,.09);border-radius:28px;background:rgba(255,255,255,.82);box-shadow:0 28px 80px rgba(38,57,48,.10);backdrop-filter:blur(20px)}
        .wa-list{width:350px;flex:none;border-right:1px solid #e5ebe7;background:rgba(255,255,255,.72);display:flex;flex-direction:column}.wa-list-head{padding:22px 18px 16px;border-bottom:1px solid #e7ece9}.wa-list-title{display:flex;align-items:center;justify-content:space-between}.wa-list-title h2{margin:3px 0 0;font-size:25px;letter-spacing:-.04em}.wa-list-title>b{min-width:27px;padding:5px 8px;border-radius:99px;background:#e5f4eb;color:#176345;text-align:center;font-size:11px}.wa-list-head label{height:42px;margin-top:15px;display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid #e0e7e3;border-radius:13px;background:#f7f9f8;color:#89958e}.wa-list-head input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#10211a;font-size:13px}.wa-list-body{flex:1;overflow:auto;padding:8px}.wa-empty{height:100%;min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;color:#7a8981;padding:28px}.wa-empty strong{font-size:14px;color:#52635a}.wa-empty a{color:#176345;font-size:12px;font-weight:800}.wa-spin{animation:wa-spin 1s linear infinite}@keyframes wa-spin{to{transform:rotate(360deg)}}
        .wa-convo{width:100%;display:flex;align-items:center;gap:11px;padding:11px 9px;border:0;border-radius:15px;background:transparent;text-align:left;color:inherit}.wa-convo:hover,.wa-convo.active{background:#edf7f1}.wa-convo time{margin-left:auto;align-self:flex-start;padding-top:3px;color:#94a099;font-size:10px}.wa-avatar{width:44px;height:44px;flex:none;display:grid;place-items:center;overflow:hidden;border-radius:14px;background:#dff0e6;color:#176345;font-size:12px;font-weight:900}.wa-avatar img{width:100%;height:100%;object-fit:cover}.wa-convo-copy{min-width:0;display:flex;flex-direction:column;gap:3px}.wa-convo-copy b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.wa-convo-copy small{color:#819087;font-size:10px}
        .wa-chat{min-width:0;flex:1;display:flex;flex-direction:column}.wa-chat-head{height:76px;flex:none;display:flex;align-items:center;gap:11px;padding:0 20px;border-bottom:1px solid #e5ebe7;background:rgba(255,255,255,.76)}.wa-person{display:flex;align-items:center;gap:11px;border:0;background:none;padding:0;text-align:left}.wa-person span:last-child{display:flex;flex-direction:column;gap:3px}.wa-person b{font-size:14px}.wa-person small{color:#287354;font-size:10px}.wa-profile,.wa-back{width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:11px;background:transparent;color:#64746b}.wa-profile{margin-left:auto}.wa-profile:hover,.wa-back:hover{background:#f0f4f2}.wa-back{display:none}
        .wa-messages{min-height:0;flex:1;overflow:auto;padding:22px 24px;background:radial-gradient(circle at top left,rgba(221,242,231,.58),transparent 34%),radial-gradient(circle at bottom right,rgba(236,229,207,.34),transparent 30%)}.wa-encrypted{width:max-content;max-width:100%;margin:0 auto 22px;padding:7px 12px;border-radius:99px;background:rgba(255,255,255,.76);color:#99a49e;font-size:8px;font-weight:800;letter-spacing:.15em}.wa-message-stack{max-width:760px;margin:auto;display:flex;flex-direction:column;gap:5px}.wa-row{display:flex;justify-content:flex-start}.wa-row.mine{justify-content:flex-end}.wa-bubble{position:relative;max-width:78%;padding:10px 12px 7px;border-radius:17px;background:#fff;color:#27372f;box-shadow:0 4px 14px rgba(40,60,50,.06);font-size:13px}.wa-bubble.mine{border-bottom-right-radius:5px;background:#d9fdd3}.wa-bubble:not(.mine){border-bottom-left-radius:5px}.wa-bubble footer{display:flex;justify-content:flex-end;align-items:center;gap:4px;margin-top:4px;color:#7d8b84;font-size:9px}.wa-bubble footer span:last-child{display:flex}.wa-read{color:#1685d0}.wa-deleted{color:#89968f}.wa-image-button{display:block;max-width:360px;padding:0;overflow:hidden;border:0;border-radius:12px;background:none}.wa-image-button img{display:block;max-height:300px;width:auto;max-width:100%;object-fit:cover}.wa-document{min-width:220px;display:flex;align-items:center;gap:10px;color:inherit}.wa-document-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:11px;background:rgba(0,0,0,.05)}.wa-document span:last-child{display:flex;min-width:0;flex-direction:column;gap:3px}.wa-document b{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.wa-document small{color:#7d8b84;font-size:9px}.wa-audio{min-width:230px}.wa-audio audio{width:100%;height:36px}.wa-audio small{display:block;margin-top:2px;color:#829089;font-size:9px}.wa-text{white-space:pre-wrap;word-break:break-word}.wa-menu{position:absolute;z-index:5;top:calc(100% + 5px);width:170px;overflow:hidden;border:1px solid #dfe6e2;border-radius:12px;background:#fff;box-shadow:0 12px 30px rgba(20,40,30,.15)}.wa-menu.right{right:0}.wa-menu.left{left:0}.wa-menu button{width:100%;display:flex;align-items:center;gap:8px;padding:9px 11px;border:0;background:#fff;text-align:left;font-size:11px;color:#425149}.wa-menu button:hover{background:#f4f7f5}.wa-menu .danger{color:#b13d34}
        .wa-error{margin:0 20px 8px;padding:9px 11px;border:1px solid #f0c9c4;border-radius:11px;background:#fff0ed;color:#a34238;font-size:11px}.wa-composer{padding:12px 16px;border-top:1px solid #e5ebe7;background:rgba(255,255,255,.84)}.wa-input{display:flex;align-items:center;gap:6px;padding:5px 6px;border:1px solid #dde5e0;border-radius:16px;background:#f7f9f8}.wa-input button{width:38px;height:38px;display:grid;place-items:center;flex:none;border:0;border-radius:11px;background:transparent;color:#68776e}.wa-input button:hover{background:#fff}.wa-input button:disabled{opacity:.5}.wa-input input{min-width:0;flex:1;border:0;outline:0;background:transparent;padding:0 8px;color:#10211a;font-size:13px}.wa-input .wa-send{background:#176345;color:#fff}.wa-input .wa-send:hover{background:#123f30}.wa-hidden{display:none}.wa-recording{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #efc7c3;border-radius:15px;background:#fff2f0;color:#a13e36}.wa-recording>span{width:9px;height:9px;border-radius:50%;background:#dc4a40;animation:wa-pulse 1s infinite}@keyframes wa-pulse{50%{opacity:.35}}.wa-recording b{font-size:12px}.wa-recording button{margin-left:auto;border:0;border-radius:10px;padding:8px 12px;background:#c93e36;color:#fff;font-size:11px;font-weight:800}.wa-start,.wa-no-selection{height:100%;display:grid;place-items:center;text-align:center;color:#8a968f}.wa-start>div,.wa-no-selection>div>svg{margin:auto;display:grid;place-items:center;width:62px;height:62px;border-radius:20px;background:rgba(255,255,255,.8);color:#176345;box-shadow:0 8px 20px rgba(30,60,45,.06)}.wa-start h2{margin:15px 0 5px;color:#31443a;font-size:18px}.wa-start p,.wa-no-selection p{margin:0;max-width:340px;font-size:12px;line-height:1.6}.wa-no-selection>div{display:flex;flex-direction:column;align-items:center;gap:10px}.wa-lightbox{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:24px;background:rgba(10,20,16,.82)}.wa-lightbox>button{position:absolute;top:18px;right:18px;width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff}.wa-lightbox img{max-width:92vw;max-height:90vh;border-radius:18px;object-fit:contain}.wa-chat-mobile-hidden,.wa-list-mobile-hidden{display:none}
        @media(min-width:768px){.wa-chat-mobile-hidden{display:flex}.wa-list-mobile-hidden{display:flex}}
        @media(max-width:767px){.wa-main{padding:18px 12px}.wa-heading h1{font-size:40px}.wa-card{height:calc(100vh - 130px);min-height:560px;border-radius:22px}.wa-list{width:100%;border-right:0}.wa-chat{width:100%}.wa-back{display:grid}.wa-list-mobile-hidden{display:none}.wa-chat-mobile-hidden{display:none}.wa-bubble{max-width:88%}.wa-messages{padding:16px 12px}.wa-heading>span{font-size:12px}.wa-list-head{padding:17px 14px 13px}}
      `}</style>
    </div>
  )
}
