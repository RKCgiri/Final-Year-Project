import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "./TranslatorPage.css";

const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

// Inject global style to prevent browser white autofill/focus backgrounds
const globalStyle = document.createElement("style");
globalStyle.textContent = `
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  textarea:-webkit-autofill,
  textarea:-webkit-autofill:hover,
  textarea:-webkit-autofill:focus {
    -webkit-text-fill-color: #34d399 !important;
    -webkit-box-shadow: 0 0 0px 1000px #0a0e1a inset !important;
    background-color: #0a0e1a !important;
    caret-color: #34d399;
    transition: background-color 5000s ease-in-out 0s;
  }
  input:focus, textarea:focus {
    outline: none !important;
    box-shadow: none !important;
    background-color: #0a0e1a !important;
  }
`;
document.head.appendChild(globalStyle);

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

const LANGUAGES = [
  { value: "english", label: "English (no translation)" },
  { value: "hindi",   label: "Hindi" },
  { value: "bengali", label: "Bengali" },
  { value: "tamil",   label: "Tamil" },
  { value: "telugu",  label: "Telugu" },
  { value: "marathi", label: "Marathi" },
  { value: "gujarati",label: "Gujarati" },
  { value: "punjabi", label: "Punjabi" },
  { value: "french",  label: "French" },
  { value: "spanish", label: "Spanish" },
  { value: "arabic",  label: "Arabic" },
];

export default function TranslatorPage() {
  const [appState, setAppState] = useState({
    cameraActive: false,
    cameraFrame: null,
    currentSymbol: "—",
    currentWord: "",
    currentSentence: "",
    targetLanguage: "hindi",
    suggestions: [],
    error: "",
    voiceSpeed: 50,
    volume: 70,
    chatMessages: [],
  });

  // FIX: separate loading state so button shows spinner while starting
  const [cameraLoading, setCameraLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [backendReady, setBackendReady] = useState(false); // FIX: track backend readiness

  const [manualEdits, setManualEdits] = useState({
    localWord: "",
    localSentence: "",
  });

  const frameIntervalRef = useRef(null);
  const recIntervalRef = useRef(null);
  const chatEndRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetriesRef = useRef(5); // FIX: increased retries
  const healthCheckRef = useRef(null); // FIX: health check interval ref

  const activeWord = manualEdits.localWord !== "" ? manualEdits.localWord : appState.currentWord;
  const debouncedActiveWord = useDebounce(activeWord, 250);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [appState.chatMessages]);

  const updateAppState = useCallback((updates) => {
    setAppState(prev => ({ ...prev, ...updates }));
  }, []);

  // ── FIX: Health check FIRST before auto-starting camera ──
  // Poll /health until backend says models_loaded=true, THEN start camera
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20; // 20 x 500ms = 10 seconds max wait

    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        const data = await res.json();

        if (cancelled) return;

        if (data.status === "ok" && data.models_loaded) {
          setBackendReady(true);
          setConnectionStatus("connected");
          clearInterval(healthCheckRef.current);
          // Auto-start camera only after backend confirmed ready
          startCamera();
        } else {
          attempts++;
          if (attempts >= MAX_ATTEMPTS) {
            clearInterval(healthCheckRef.current);
            updateAppState({ error: "Backend took too long to load models. Refresh the page." });
            setConnectionStatus("disconnected");
          }
        }
      } catch (e) {
        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(healthCheckRef.current);
          updateAppState({ error: "Cannot reach backend. Is the server running?" });
          setConnectionStatus("disconnected");
        }
      }
    };

    // Check immediately, then every 500ms
    checkHealth();
    healthCheckRef.current = setInterval(checkHealth, 500);

    return () => {
      cancelled = true;
      clearInterval(healthCheckRef.current);
      stopCamera();
    };
  }, []); // runs once on mount

  // ── Suggestions ──
  useEffect(() => {
    const word = debouncedActiveWord?.trim();
    if (!word) {
      updateAppState({ suggestions: [] });
      return;
    }
    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/recognition/suggestions?word=${encodeURIComponent(word)}`);
        const data = await res.json();
        if (data.status === "success") {
          updateAppState({ suggestions: data.suggestions || [] });
        }
      } catch (e) {
        console.error("Suggestion fetch error:", e);
      }
    };
    fetchSuggestions();
  }, [debouncedActiveWord, updateAppState]);

  // ── Fetch recognition state ──
  const fetchRecognitionData = useCallback(async () => {
    if (!appState.cameraActive) return;
    try {
      const response = await fetch(`${API_BASE_URL}/recognition/state`);
      const data = await response.json();
      if (data.status === "success") {
        const { current_symbol, word, sentence } = data.data;
        updateAppState({
          currentSymbol: current_symbol || "—",
          currentWord: word || "",
          currentSentence: sentence || "",
          error: "",
          cameraFrame: data.frame
            ? `data:image/jpeg;base64,${data.frame}`
            : appState.cameraFrame,
        });
        retryCountRef.current = 0;
        setConnectionStatus("connected");
      }
    } catch (err) {
      handleError(err);
    }
  }, [appState.cameraActive, appState.cameraFrame, updateAppState]);

  const fetchFrameOnly = useCallback(async () => {
    if (!appState.cameraActive) return;
    try {
      const response = await fetch(`${API_BASE_URL}/camera/frame`);
      const data = await response.json();
      if (data.status === "success") {
        updateAppState({ cameraFrame: `data:image/jpeg;base64,${data.frame}`, error: "" });
      }
    } catch (e) {
      console.error("Frame fetch error:", e);
    }
  }, [appState.cameraActive, updateAppState]);

  const handleError = useCallback((err) => {
    retryCountRef.current += 1;
    if (retryCountRef.current <= maxRetriesRef.current) {
      setConnectionStatus("reconnecting");
      updateAppState({ error: `Retrying... (${retryCountRef.current}/${maxRetriesRef.current})` });
    } else {
      setConnectionStatus("disconnected");
      updateAppState({ error: "Backend unreachable. Check server." });
    }
  }, [updateAppState]);

  // ── Polling ──
  useEffect(() => {
    if (!appState.cameraActive) return;
    const stateInterval = setInterval(fetchRecognitionData, 150);
    const frameInterval = setInterval(fetchFrameOnly, 200);
    return () => {
      clearInterval(stateInterval);
      clearInterval(frameInterval);
    };
  }, [appState.cameraActive, fetchRecognitionData, fetchFrameOnly]);

  // ── Camera controls ──
  // FIX: startCamera now has retry logic with exponential backoff
  const startCamera = useCallback(async (retryCount = 0) => {
    const MAX_RETRIES = 3;

    // FIX: prevent double-click spam
    if (cameraLoading) return;
    setCameraLoading(true);

    try {
      const r = await fetch(`${API_BASE_URL}/camera/start`, { method: "POST" });
      const d = await r.json();

      if (d.status === "success") {
        updateAppState({ cameraActive: true, error: "" });
        setConnectionStatus("connected");
        retryCountRef.current = 0;
        setCameraLoading(false);

      } else if (d.status === "warning") {
        // Already running — just mark as active
        updateAppState({ cameraActive: true, error: "" });
        setCameraLoading(false);

      } else {
        // Error — retry with backoff
        if (retryCount < MAX_RETRIES) {
          const delay = 1000 * (retryCount + 1); // 1s, 2s, 3s
          updateAppState({ error: `Camera failed, retrying in ${delay / 1000}s...` });
          setCameraLoading(false);
          setTimeout(() => startCamera(retryCount + 1), delay);
        } else {
          updateAppState({ error: `Camera failed: ${d.message}` });
          setCameraLoading(false);
        }
      }
    } catch (e) {
      if (retryCount < MAX_RETRIES) {
        const delay = 1000 * (retryCount + 1);
        updateAppState({ error: `Cannot reach backend, retrying in ${delay / 1000}s...` });
        setCameraLoading(false);
        setTimeout(() => startCamera(retryCount + 1), delay);
      } else {
        updateAppState({ error: "Failed to start camera: " + e.message });
        setCameraLoading(false);
      }
    }
  }, [cameraLoading, updateAppState]);

  const stopCamera = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/camera/stop`, { method: "POST" });
    } catch {}
    updateAppState({ cameraActive: false, cameraFrame: null });
    setCameraLoading(false);
  }, [updateAppState]);

  // ── Delete actions ──
  const deleteCurrentLetter = useCallback(async () => {
    if (manualEdits.localWord.length > 0) {
      setManualEdits(prev => ({ ...prev, localWord: prev.localWord.slice(0, -1) }));
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/recognition/delete-letter`, { method: "POST" });
      const d = await res.json();
      if (d.status === "success") {
        updateAppState({
          currentWord: d.data.word ?? "",
          currentSentence: d.data.sentence ?? "",
          currentSymbol: "—",
        });
      }
    } catch {
      if (appState.currentWord.length > 0) {
        updateAppState({ currentWord: appState.currentWord.slice(0, -1) });
      }
    }
  }, [manualEdits.localWord, appState.currentWord, updateAppState]);

  const deleteCurrentWord = useCallback(async () => {
    setManualEdits(prev => ({ ...prev, localWord: "" }));
    try {
      const res = await fetch(`${API_BASE_URL}/recognition/clear-word`, { method: "POST" });
      const d = await res.json();
      if (d.status === "success") {
        updateAppState({
          currentWord: d.data.word ?? "",
          currentSentence: d.data.sentence ?? "",
          currentSymbol: "—",
          suggestions: [],
        });
      }
    } catch {
      updateAppState({ currentWord: "", suggestions: [], currentSymbol: "—" });
    }
  }, [updateAppState]);

  const deleteLastWordFromSentence = useCallback(async () => {
    if (manualEdits.localSentence.trim()) {
      const words = manualEdits.localSentence.trim().split(" ");
      words.pop();
      setManualEdits(prev => ({ ...prev, localSentence: words.join(" ") }));
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/recognition/clear-sentence-word`, { method: "POST" });
      const d = await res.json();
      if (d.status === "success") {
        updateAppState({
          currentSentence: d.data.sentence ?? "",
          currentWord: d.data.word ?? "",
          currentSymbol: "—",
          suggestions: d.data.suggestions ?? [],
        });
      }
    } catch {
      const words = appState.currentSentence.trim().split(" ");
      if (words.length > 0) {
        words.pop();
        updateAppState({ currentSentence: words.join(" ") });
      }
    }
  }, [manualEdits.localSentence, appState.currentSentence, updateAppState]);

  const clearAll = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/recognition/clear`, { method: "POST" });
    } catch {}
    setManualEdits({ localWord: "", localSentence: "" });
    updateAppState({
      currentWord: "",
      currentSentence: "",
      currentSymbol: "—",
      suggestions: [],
    });
  }, [updateAppState]);

  const acceptSuggestion = useCallback(async (s) => {
    const hasManuSentence = manualEdits.localSentence.trim().length > 0;
    if (hasManuSentence) {
      setManualEdits(prev => ({
        localWord: "",
        localSentence: (prev.localSentence.trim() ? prev.localSentence.trim() + " " : "") + s,
      }));
      updateAppState({ suggestions: [], currentSymbol: "—" });
      try { await fetch(`${API_BASE_URL}/recognition/clear-word`, { method: "POST" }); } catch {}
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/recognition/accept-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion: s }),
      });
      const d = await res.json();
      if (d.status === "success") {
        setManualEdits(prev => ({ ...prev, localWord: "" }));
        updateAppState({
          currentWord: d.data.word ?? "",
          currentSentence: d.data.sentence ?? "",
          currentSymbol: "—",
          suggestions: d.data.suggestions ?? [],
        });
      }
    } catch {
      setManualEdits(prev => ({ ...prev, localWord: "" }));
      updateAppState({
        currentWord: "",
        currentSentence: (appState.currentSentence ? appState.currentSentence + " " : "") + s,
        currentSymbol: "—",
        suggestions: [],
      });
    }
  }, [manualEdits.localSentence, appState.currentSentence, updateAppState]);

  const commitWordToSentence = useCallback(async () => {
    const wordToCommit = (manualEdits.localWord || appState.currentWord).trim();
    if (!wordToCommit) return;
    const newSentence = (manualEdits.localSentence.trim()
      ? manualEdits.localSentence.trim() + " "
      : "") + wordToCommit;
    setManualEdits({ localWord: "", localSentence: newSentence });
    updateAppState({ currentSymbol: "—", suggestions: [] });
    try { await fetch(`${API_BASE_URL}/recognition/clear-word`, { method: "POST" }); } catch {}
  }, [manualEdits.localWord, manualEdits.localSentence, appState.currentWord, updateAppState]);

  const sendToChatHandler = useCallback(async () => {
    const text = (
      manualEdits.localSentence.trim() ||
      manualEdits.localWord.trim() ||
      appState.currentSentence.trim() ||
      appState.currentWord.trim()
    ).trim();
    if (!text) return;

    let translated = text;
    const lang = appState.targetLanguage;

    if (lang !== "english") {
      const llmBaseUrl = import.meta.env.VITE_LLM_API_URL;
      const llmKey = import.meta.env.VITE_LLM_API_KEY;
      if (llmBaseUrl && llmKey) {
        try {
          const completionUrl = llmBaseUrl.endsWith("/")
            ? llmBaseUrl + "chat/completions"
            : llmBaseUrl + "/chat/completions";
          const langLabel = LANGUAGES.find(l => l.value === lang)?.label || lang;
          const resp = await fetch(completionUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${llmKey}` },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content: `You are a professional English to ${langLabel} translator. Only output the translated text.`,
                },
                { role: "user", content: text },
              ],
              temperature: 0.3,
            }),
          });
          const jd = await resp.json();
          if (jd.choices?.[0]?.message) {
            translated = jd.choices[0].message.content.trim();
          }
        } catch (e) {
          console.error("LLM translation error:", e);
        }
      }
    }

    const langLabel = lang === "english" ? "" : ` [${LANGUAGES.find(l => l.value === lang)?.label}]`;
    updateAppState({
      chatMessages: [
        ...appState.chatMessages,
        { original: text, text: translated + langLabel, lang, time: now(), id: Date.now() },
      ],
      currentSentence: "",
      currentWord: "",
      currentSymbol: "—",
      suggestions: [],
    });
    setManualEdits({ localWord: "", localSentence: "" });
    try {
      await fetch(`${API_BASE_URL}/recognition/send-sentence`, { method: "POST" });
    } catch {
      fetch(`${API_BASE_URL}/recognition/clear`, { method: "POST" }).catch(() => {});
    }
  }, [appState, manualEdits, updateAppState]);

  const playVoice = useCallback(() => {
    const text = manualEdits.localSentence || appState.currentSentence || manualEdits.localWord || appState.currentWord;
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = appState.voiceSpeed / 50;
    u.volume = appState.volume / 100;
    const langMap = {
      hindi: "hi-IN", bengali: "bn-IN", tamil: "ta-IN", telugu: "te-IN",
      marathi: "mr-IN", gujarati: "gu-IN", punjabi: "pa-IN",
      french: "fr-FR", spanish: "es-ES", arabic: "ar",
    };
    if (langMap[appState.targetLanguage]) u.lang = langMap[appState.targetLanguage];
    window.speechSynthesis.speak(u);
  }, [manualEdits, appState]);

  const displaySymbol = useMemo(() =>
    appState.currentSymbol === "blank" ? "␣" : appState.currentSymbol,
    [appState.currentSymbol]
  );

  const displayWord = manualEdits.localWord !== "" ? manualEdits.localWord : appState.currentWord;
  const displaySentence = manualEdits.localSentence !== "" ? manualEdits.localSentence : appState.currentSentence;
  const canCommitWord = (manualEdits.localWord || appState.currentWord).trim().length > 0;

  // FIX: camera button label reflects exact state
  const cameraButtonLabel = () => {
    if (cameraLoading) return "⏳ Starting...";
    if (appState.cameraActive) return "⏹ Stop";
    if (!backendReady) return "⏳ Loading...";
    return "▶ Start Camera";
  };

  return (
    <div className="app-wrap">
      <div className="main-grid">

        {/* ── Column 1: Camera ── */}
        <div className="cam-col">
          <div className="cam-feed-wrap">
            {appState.cameraFrame
              ? <img src={appState.cameraFrame} alt="Camera feed" />
              : (
                <div className="cam-grid-placeholder">
                  <span>📷</span>
                  <p>
                    {cameraLoading
                      ? "Starting camera…"
                      : !backendReady
                      ? "Loading models, please wait…"
                      : appState.cameraActive
                      ? "Connecting to camera…"
                      : "Camera inactive"}
                  </p>
                </div>
              )}

            {appState.cameraActive && (
              <>
                <div className="scanline-overlay" />
                <div className="cam-overlay-tl" />
                <div className="cam-overlay-tr" />
                <div className="cam-overlay-br" />
                <div className="cam-overlay-bl" />
                <div className="cam-badge">
                  Detection zone active &nbsp;·&nbsp; <strong>ROI</strong> right half
                </div>
              </>
            )}
          </div>

          <div className="cam-controls">
            <button className="ctrl-btn danger" onClick={clearAll}>↺ Reset</button>
            <button
              className={`ctrl-btn ${appState.cameraActive ? "danger" : "primary"}`}
              onClick={appState.cameraActive ? stopCamera : () => startCamera(0)}
              style={{ marginLeft: "auto" }}
              // FIX: disable button while loading or backend not ready
              disabled={cameraLoading || !backendReady}
            >
              {cameraButtonLabel()}
            </button>
          </div>
        </div>

        {/* ── Column 2: Recognition ── */}
        <div className="rec-col">
          {appState.error && (
            <div className="error-bar">
              <span>⚠</span>
              <span>{appState.error}</span>
            </div>
          )}

          <div>
            <div className="sec-label">01 — Current Letter</div>
            <div className="letter-card">
              <div>
                <div className="letter-display">{displaySymbol}</div>
              </div>
              <div className="letter-meta">
                <div className="tag">Detected</div>
                <div className="sub">Hold still to confirm</div>
              </div>
              <button className="del-btn" title="Delete last letter" onClick={deleteCurrentLetter}>×</button>
            </div>
          </div>

          <div className="divider" />

          <div>
            <div className="sec-label">
              02 — Current Word
            </div>
            <div className="word-card">
              <input
                type="text"
                value={displayWord}
                onChange={(e) => setManualEdits(prev => ({ ...prev, localWord: e.target.value }))}
                placeholder="Detected word appears here..."
                style={{
                  width: "100%", background: "#0a0e1a", color: "#34d399",
                  border: "1px solid rgba(52, 211, 153, 0.3)", padding: "8px 10px",
                  borderRadius: "4px", fontSize: "14px",
                  outline: "none", caretColor: "#34d399",
                }}
              />
              <div className="word-footer" style={{ marginTop: "8px", display: "flex", gap: 8, alignItems: "center" }}>
                <span className="word-len">
                  {displayWord.length > 0 ? `${displayWord.length} letters` : "waiting…"}
                </span>
                <button
                  className="ctrl-btn"
                  style={{
                    padding: "4px 10px", fontSize: "11px", marginLeft: "auto",
                    opacity: canCommitWord ? 1 : 0.4,
                    cursor: canCommitWord ? "pointer" : "default",
                  }}
                  disabled={!canCommitWord}
                  onClick={commitWordToSentence}
                >
                  Add Word ↓
                </button>
                <button
                  className="del-btn"
                  style={{ position: "static", width: 28, height: 28 }}
                  onClick={deleteCurrentWord}
                >×</button>
              </div>
            </div>
          </div>

          <div className="divider" />

          <div>
            <div className="sec-label">
              03 — Word Suggestions
              {activeWord && <span style={{ color: "#60a5fa", marginLeft: 6, fontSize: 10 }}>
                for "{activeWord.toLowerCase()}"
              </span>}
            </div>
            <div className="sugg-wrap">
              {appState.suggestions.length > 0
                ? appState.suggestions.slice(0, 6).map((s, i) => (
                  <button key={i} className="sugg-btn" onClick={() => acceptSuggestion(s)}>{s}</button>
                ))
                : <span className="sugg-no">
                  {activeWord ? "No completions found" : "Sign or type a word to see suggestions"}
                </span>
              }
            </div>
          </div>

          <div className="divider" />

          <div style={{ flex: 1 }}>
            <div className="sec-label">
              04 — Current Sentence
            </div>
            <div className="sentence-card">
              <textarea
                value={displaySentence}
                onChange={(e) => setManualEdits(prev => ({ ...prev, localSentence: e.target.value }))}
                placeholder="Detected sentence appears here..."
                style={{
                  width: "100%", background: "#0a0e1a", color: "#34d399",
                  border: "1px solid rgba(52, 211, 153, 0.3)", padding: "8px 10px",
                  borderRadius: "4px", fontSize: "14px", minHeight: "60px",
                  fontFamily: "inherit", resize: "vertical",
                  outline: "none", caretColor: "#34d399",
                }}
              />
              <div className="sentence-footer" style={{ marginTop: "8px" }}>
                <button
                  className="del-btn"
                  style={{ position: "static", width: 28, height: 28, flexShrink: 0 }}
                  onClick={() => setManualEdits(prev => ({ ...prev, localSentence: "" }))}
                >✕</button>
                <button
                  className="send-btn"
                  disabled={
                    !manualEdits.localSentence.trim() &&
                    !manualEdits.localWord.trim() &&
                    !appState.currentSentence.trim() &&
                    !appState.currentWord.trim()
                  }
                  onClick={sendToChatHandler}
                >
                  Send to Chat →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 3: Chat ── */}
        <div className="chat-col">
          <div className="chat-header">
            <div className="chat-header-title">
              <span className="dot" />
              Conversation Log
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="chat-count">
                {appState.chatMessages.length} MSG{appState.chatMessages.length !== 1 ? "S" : ""}
              </span>
              <select
                value={appState.targetLanguage}
                onChange={(e) => updateAppState({ targetLanguage: e.target.value })}
                style={{
                  background: "#071025", color: "#fff",
                  border: "1px solid rgba(255,255,255,0.06)",
                  padding: "6px 8px", borderRadius: 6,
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              {appState.chatMessages.length > 0 && (
                <button className="clear-chat-btn" onClick={() => updateAppState({ chatMessages: [] })}>
                  CLEAR
                </button>
              )}
            </div>
          </div>

          {appState.chatMessages.length === 0
            ? (
              <div className="chat-empty">
                <div className="icon">💬</div>
                <p>Recognized sentences<br />will appear here.</p>
                <span>Press "Send to Chat →" to add a message</span>
              </div>
            )
            : (
              <div className="chat-messages">
                {appState.chatMessages.map((msg) => (
                  <div key={msg.id} className="chat-bubble">
                    {msg.original && msg.lang !== "english" && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
                        {msg.original}
                      </div>
                    )}
                    <div className="chat-bubble-inner">{msg.text}</div>
                    <div className="chat-meta">
                      <span className="chat-time">{msg.time}</span>
                      <span className="chat-tick">✓✓</span>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )
          }

          <div className="chat-footer">
            <div className="chat-hint">
              <strong>How it works:</strong> Sign letters one by one. Hold a sign for ~3 sec to lock it.
              Show a blank/open hand to commit the word. Use <strong>Add Word ↓</strong> to build the sentence.
              Pick a language, then hit <strong>Send to Chat</strong>.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}