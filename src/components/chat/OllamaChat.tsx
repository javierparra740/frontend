// OllamaChat.tsx
import React, { useEffect, useRef, useState } from 'react';
import './OllamaChat.css'; // reuse the original CSS (see note below)

type Role = 'user' | 'assistant';
interface Message {
    role: Role;
    content: string;
}

export const OllamaChat: React.FC = () => {
    /* ---------- state ---------- */
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [models, setModels] = useState<string[]>(['llama2']);
    const [selected, setSelected] = useState('llama2');
    const [error, setError] = useState<string | null>(null);

    /* ---------- refs ---------- */
    const abortRef = useRef<AbortController | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);

    /* ---------- helpers ---------- */
    const scrollBottom = () =>
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });

    const ollama = (path: string) => `http://localhost:11434${path}`;

    /* ---------- fetch available models ---------- */
    const fetchModels = async () => {
        try {
            const res = await fetch(ollama('/api/tags'));
            const data = await res.json();
            const names = (data.models ?? []).map((m: any) => m.name as string);
            if (names.length) setModels(names);
            if (!names.includes(selected)) setSelected(names[0] ?? 'llama2');
            setError(null);
        } catch (e: any) {
            setError('No se pudo conectar con Ollama. Asegúrate de que esté ejecutándose en http://localhost:11434');
        }
    };

    useEffect(() => {
        void fetchModels();
    }, []);

    /* ---------- stop streaming ---------- */
    const stopStream = () => {
        abortRef.current?.abort();
        abortRef.current = null;
        setStreaming(false);
        setLoading(false);
    };

    /* ---------- send / stop ---------- */
    const sendMessage = async () => {
        if (streaming) return stopStream();          // button becomes “Detener”
        if (!input.trim() || loading) return;

        const userMsg: Message = { role: 'user', content: input.trim() };
        setMessages((m) => [...m, userMsg]);
        setInput('');
        setLoading(true);
        setStreaming(true);
        setError(null);

        // empty assistant placeholder
        setMessages((m) => [...m, { role: 'assistant', content: '' }]);
        scrollBottom();

        const ctrl = new AbortController();
        abortRef.current = ctrl;

        try {
            const res = await fetch(ollama('/api/chat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: ctrl.signal,
                body: JSON.stringify({
                    model: selected,
                    messages: [...messages, userMsg], // without the empty assistant
                    stream: true,
                }),
            });

            if (!res.ok) throw new Error('Ollama respondió con error: ' + res.status);
            const reader = res.body!.getReader();
            const dec = new TextDecoder();
            let buf = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop()!;

                for (const l of lines) {
                    if (!l.trim()) continue;
                    try {
                        const obj = JSON.parse(l);
                        const token = obj.message?.content ?? obj.response ?? '';
                        setMessages((m) => {
                            const copy = [...m];
                            copy[copy.length - 1].content += token;
                            return copy;
                        });
                    } catch {
                        // non-json line → append as-is
                        setMessages((m) => {
                            const copy = [...m];
                            copy[copy.length - 1].content += l;
                            return copy;
                        });
                    }
                    scrollBottom();
                }
            }

            // tail
            if (buf.trim()) {
                setMessages((m) => {
                    const copy = [...m];
                    copy[copy.length - 1].content += buf;
                    return copy;
                });
            }
        } catch (e: any) {
            if (e.name === 'AbortError') console.log('Stream aborted by user');
            else {
                setError('Error al comunicarse con Ollama: ' + e.message);
                // remove empty assistant on error
                setMessages((m) => (m[m.length - 1].role === 'assistant' && !m[m.length - 1].content ? m.slice(0, -1) : m));
            }
        } finally {
            setLoading(false);
            setStreaming(false);
            abortRef.current = null;
        }
    };

    /* ---------- clear ---------- */
    const clearChat = () => {
        if (window.confirm('¿Estás seguro de que deseas limpiar el chat?')) {
            setMessages([]);
            setError(null);
        }
    };

    /* ---------- render ---------- */
    return (
        <div className="chat-container">
            <header className="chat-header">
                <h1>💬 Chat Ollama</h1>
                <div className="model-selector">
                    <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                        {models.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                    <button className="refresh-btn" onClick={fetchModels} disabled={loading}>
                        🔄 Actualizar
                    </button>
                    <button className="clear-btn" onClick={clearChat}>
                        🗑️ Limpiar
                    </button>
                </div>
            </header>

            {error && <div className="error-message">{error}</div>}

            <main className="messages-container" ref={listRef}>
                {messages.length === 0 && (
                    <div className="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <h2>Comienza una conversación</h2>
                        <p>Escribe un mensaje para comenzar a chatear con Ollama</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.role}`}>
                        <div className="message-content">
                            <div className="message-role">{msg.role === 'user' ? 'Tú' : 'Asistente'}</div>
                            {msg.content}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="message assistant">
                        <div className="message-content">
                            <div className="loading">
                                <span className="loading-dot" />
                                <span className="loading-dot" />
                                <span className="loading-dot" />
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="input-container">
                <div className="input-wrapper">
                    <textarea
                        rows={2}
                        value={input}
                        disabled={loading}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                        placeholder="Escribe tu mensaje aquí... (Enter para enviar)"
                    />
                    <button className="send-btn" onClick={sendMessage} disabled={!input.trim() && !streaming}>
                        {streaming ? 'Detener' : loading ? 'Enviando…' : 'Enviar'}
                    </button>
                </div>
            </footer>
        </div>
    );
}