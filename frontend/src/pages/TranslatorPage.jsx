import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "./TranslatorPage.css";

// Read API base URL from Vite env (fallback to localhost)
const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000/api";

// Inject Google Fonts
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);


// ─── Utility ───────────────────────────────────────────────────────────────
function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Request Batcher & Throttler ───────────────────────────────────────────
class RequestOptimizer {
  constructor() {
    this.lastRequestTime = {};
    this.requestCache = {};
    this.cacheTTL = 50; // milliseconds
  }

  async throttledFetch(key, fn, delay = 100) {
    const now = Date.now();
    const lastTime = this.lastRequestTime[key] || 0;
    
    if (now - lastTime < delay) return this.requestCache[key];
    
    try {
      const result = await fn();
      this.lastRequestTime[key] = now;
      this.requestCache[key] = result;
      return result;
    } catch (e) {
      throw e;
    }
  }

  clearCache(key) {
    delete this.requestCache[key];
    delete this.lastRequestTime[key];
  }
}

const requestOptimizer = new RequestOptimizer();

// ─── Main Component ─────────────────────────────────────────────────────────
export default function TranslatorPage() {
  // State management - OPTIMIZED: reduced number of state updates
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

  const [connectionStatus, setConnectionStatus] = useState("connecting");
  // Local manual edits (don't sync to backend)
  const [manualEdits, setManualEdits] = useState({
    localWord: "",
    localSentence: "",
  });
  const frameIntervalRef = useRef(null);
  const recIntervalRef = useRef(null);
  const chatEndRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetriesRef = useRef(3);

  // ── Scroll chat to bottom ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [appState.chatMessages]);

  // ── Batch state updates ──
  const updateAppState = useCallback((updates) => {
    setAppState(prev => ({ ...prev, ...updates }));
  }, []);

  // ── Start camera on mount ──
  useEffect(() => {
    startCamera();
    return () => { stopCamera(); };
  }, []);

  // ── Optimized: Combined fetch for state and frame ──
  const fetchRecognitionData = useCallback(async () => {
    if (!appState.cameraActive) return;

    try {
      const response = await fetch(`${API_BASE_URL}/recognition/state`);
      const data = await response.json();
      
      if (data.status === "success") {
        const { current_symbol, word, sentence, suggestions } = data.data;
        
        // Batch update state to reduce renders
        updateAppState({
          currentSymbol: current_symbol || "—",
          currentWord: word || "",
          currentSentence: sentence || "",
          suggestions: suggestions || [],
          error: "",
          cameraFrame: data.frame ? `data:image/jpeg;base64,${data.frame}` : appState.cameraFrame,
        });
        
        retryCountRef.current = 0;
        setConnectionStatus("connected");
      }
    } catch (err) {
      handleError(err);
    }
  }, [appState.cameraActive, appState.cameraFrame, updateAppState]);

  // ── Optimized: Only fetch frame when not in state request ──
  const fetchFrameOnly = useCallback(async () => {
    if (!appState.cameraActive) return;

    try {
      const response = await fetch(`${API_BASE_URL}/camera/frame`);
      const data = await response.json();
      
      if (data.status === "success") {
        updateAppState({
          cameraFrame: `data:image/jpeg;base64,${data.frame}`,
          error: ""
        });
      }
    } catch (e) {
      console.error("Frame fetch error:", e);
    }
  }, [appState.cameraActive, updateAppState]);

  // ── Error handling with retry logic ──
  const handleError = useCallback((err) => {
    retryCountRef.current += 1;
    
    if (retryCountRef.current <= maxRetriesRef.current) {
      setConnectionStatus("reconnecting");
      updateAppState({ error: "Retrying..." });
    } else {
      setConnectionStatus("disconnected");
      updateAppState({ error: "Backend unreachable. Check server." });
    }
  }, [updateAppState]);

  // ── Adaptive polling based on changes ──
  useEffect(() => {
    if (!appState.cameraActive) return;

    // Fetch state + frame combined (main request)
    const stateInterval = setInterval(() => {
      requestOptimizer.throttledFetch("state", fetchRecognitionData, 100);
    }, 100);

    // Secondary frame-only fetch (optional, for better FPS if needed)
    const frameInterval = setInterval(() => {
      requestOptimizer.throttledFetch("frame", fetchFrameOnly, 150);
    }, 150);

    return () => {
      clearInterval(stateInterval);
      clearInterval(frameInterval);
    };
  }, [appState.cameraActive, fetchRecognitionData, fetchFrameOnly]);

  // ── Camera controls ──
  const startCamera = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/camera/start`, { method: "POST" });
      const d = await r.json();
      if (d.status === "success") {
        updateAppState({ cameraActive: true, error: "" });
        setConnectionStatus("connected");
        retryCountRef.current = 0;
      } else {
        updateAppState({ error: d.message });
      }
    } catch (e) {
      updateAppState({ error: "Failed to start camera: " + e.message });
    }
  }, [updateAppState]);

  const stopCamera = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/camera/stop`, { method: "POST" });
    } catch {}
    updateAppState({ cameraActive: false, cameraFrame: null });
  }, [updateAppState]);

  // ── Delete actions (memoized) ──
  const deleteCurrentLetter = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/recognition/delete-letter`, { method: "POST" });
      const d = await res.json();
      if (d.status === "success") {
        updateAppState({
          currentWord: d.data.word ?? "",
          currentSentence: d.data.sentence ?? "",
          currentSymbol: "—",
          suggestions: d.data.suggestions ?? [],
        });
      } else {
        throw new Error(d.message);
      }
    } catch (err) {
      if (appState.currentWord.length > 0) {
        updateAppState({ currentWord: appState.currentWord.slice(0, -1) });
      }
    }
  }, [appState.currentWord, updateAppState]);

  const deleteCurrentWord = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/recognition/clear-word`, { method: "POST" });
      const d = await res.json();
      if (d.status === "success") {
        updateAppState({
          currentWord: d.data.word ?? "",
          currentSentence: d.data.sentence ?? "",
          currentSymbol: "—",
          suggestions: d.data.suggestions ?? [],
        });
      } else {
        throw new Error(d.message);
      }
    } catch (err) {
      updateAppState({
        currentWord: "",
        suggestions: [],
        currentSymbol: "—"
      });
    }
  }, [updateAppState]);

  const deleteLastWordFromSentence = useCallback(async () => {
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
      } else {
        throw new Error(d.message);
      }
    } catch (err) {
      const words = appState.currentSentence.trim().split(" ");
      if (words.length > 0) {
        words.pop();
        updateAppState({ currentSentence: words.join(" ") });
      }
    }
  }, [appState.currentSentence, updateAppState]);

  const clearAll = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/recognition/clear`, { method: "POST" });
    } catch {}
    updateAppState({
      currentWord: "",
      currentSentence: "",
      currentSymbol: "—",
      suggestions: [],
    });
  }, [updateAppState]);

  // ── Accept suggestion (memoized) ──
  const acceptSuggestion = useCallback(async (s) => {
    try {
      const res = await fetch(`${API_BASE_URL}/recognition/accept-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion: s }),
      });
      const d = await res.json();
      if (d.status === "success") {
        updateAppState({
          currentWord: d.data.word ?? "",
          currentSentence: d.data.sentence ?? "",
          currentSymbol: "—",
          suggestions: d.data.suggestions ?? [],
        });
      } else {
        throw new Error("Backend error");
      }
    } catch (err) {
      updateAppState({
        currentWord: "",
        currentSentence: (prev) => (prev ? prev + " " : "") + s,
        currentSymbol: "—",
        suggestions: [],
      });
    }
  }, [updateAppState]);

  // ── Send sentence to chat (memoized) ──
  const sendToChatHandler = useCallback(async () => {
    // Prioritize manual edits, fallback to backend values
    const text = (manualEdits.localSentence.trim() || manualEdits.localWord.trim() || 
                  appState.currentSentence.trim() || appState.currentWord.trim()).trim();
    if (!text) return;

    // Attempt to translate via OpenAI LLM API
    let translated = text;
    const llmBaseUrl = import.meta.env.VITE_LLM_API_URL;
    const llmKey = import.meta.env.VITE_LLM_API_KEY;

    if (llmBaseUrl && llmKey) {
      try {
        const completionUrl = llmBaseUrl.endsWith('/') ? llmBaseUrl + 'chat/completions' : llmBaseUrl + '/chat/completions';
        
        const languageName = appState.targetLanguage === "hindi" ? "Hindi" : 
                           appState.targetLanguage === "bengali" ? "Bengali" : "English";
        
        const resp = await fetch(completionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${llmKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `You are a professional English to ${languageName} translator. Translate the user's text to ${languageName}. Only output the translated text, nothing else.`
              },
              {
                role: "user",
                content: text
              }
            ],
            temperature: 0.3,
          }),
        });
        const jd = await resp.json();
        
        if (jd.choices && jd.choices[0] && jd.choices[0].message) {
          translated = jd.choices[0].message.content.trim();
        } else if (jd.error) {
          console.error("OpenAI API error:", jd.error);
          updateAppState({ error: `Translation error: ${jd.error.message}` });
        }
      } catch (e) {
        console.error("LLM translation error:", e);
        updateAppState({ error: "Translation failed (check API key & internet)" });
      }
    } else {
      updateAppState({ error: "LLM not configured. Set VITE_LLM_API_URL and VITE_LLM_API_KEY in .env" });
    }

    // Add translated message to chat
    updateAppState({
      chatMessages: [...appState.chatMessages, { text: translated, lang: appState.targetLanguage, time: now(), id: Date.now() }],
      currentSentence: "",
      currentWord: "",
      currentSymbol: "—",
      suggestions: [],
    });

    // Clear manual edits after sending
    setManualEdits({ localWord: "", localSentence: "" });

    try {
      await fetch(`${API_BASE_URL}/recognition/send-sentence`, { method: "POST" });
    } catch (err) {
      fetch(`${API_BASE_URL}/recognition/clear`, { method: "POST" }).catch(() => {});
    }
  }, [appState.currentSentence, appState.currentWord, appState.chatMessages, appState.targetLanguage, manualEdits, updateAppState]);

  // ── Play voice (memoized) ──
  const playVoice = useCallback(() => {
    const text = appState.currentSentence || appState.currentWord;
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = appState.voiceSpeed / 50;
    u.volume = appState.volume / 100;
    window.speechSynthesis.speak(u);
  }, [appState.currentSentence, appState.currentWord, appState.voiceSpeed, appState.volume]);

  // ── Memoized computed values ──
  const displaySymbol = useMemo(() => 
    appState.currentSymbol === "blank" ? "␣" : appState.currentSymbol,
    [appState.currentSymbol]
  );

  // Supported regional languages for on-the-fly translation
  const LANGUAGES = [
    { value: "hindi", label: "Hindi" },
    { value: "bengali", label: "Bengali" },
  ];

  const handleVoiceSpeedChange = useCallback((value) => {
    updateAppState({ voiceSpeed: +value });
  }, [updateAppState]);

  const handleVolumeChange = useCallback((value) => {
    updateAppState({ volume: +value });
  }, [updateAppState]);

  return (
    <div className="app-wrap">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">icon</div>
          <div>
            <div className="logo-text">SignBridge</div>
            <div className="logo-sub">Real-time ASL Recognition</div>
          </div>
        </div>
        <div className="header-status">
          <div className={`status-dot ${appState.cameraActive ? "live" : ""}`}
            style={{ background: appState.cameraActive ? "#34d399" : "#4b5563" }} />
          {appState.cameraActive ? "LIVE" : "OFFLINE"}
        </div>
      </header>

      {/* Main Grid */}
      <div className="main-grid">

        {/* ── Column 1: Camera ── */}
        <div className="cam-col">
          <div className="cam-feed-wrap">
            {appState.cameraFrame
              ? <img src={appState.cameraFrame} alt="Camera feed" />
              : (
                <div className="cam-grid-placeholder">
                  <span>📷</span>
                  <p>{appState.cameraActive ? "Connecting to camera…" : "Camera inactive"}</p>
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
            <button className="ctrl-btn" onClick={playVoice}>🔊 Speak</button>
            <button className="ctrl-btn danger" onClick={clearAll}>↺ Reset</button>
            <button
              className={`ctrl-btn ${appState.cameraActive ? "danger" : "primary"}`}
              onClick={appState.cameraActive ? stopCamera : startCamera}
              style={{ marginLeft: "auto" }}
            >
              {appState.cameraActive ? "⏹ Stop" : "▶ Start Camera"}
            </button>
          </div>

          {/* Voice controls */}
          <div style={{ padding: "12px 16px", background: "#0a0e1a", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", gap: "20px" }}>
              <div style={{ flex: 1 }}>
                <div className="sec-label" style={{ marginBottom: 6 }}>Speed</div>
                <input type="range" min="10" max="100" value={appState.voiceSpeed}
                  onChange={e => handleVoiceSpeedChange(+e.target.value)}
                  style={{ width: "100%", accentColor: "#34d399" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="sec-label" style={{ marginBottom: 6 }}>Volume</div>
                <input type="range" min="0" max="100" value={appState.volume}
                  onChange={e => handleVolumeChange(+e.target.value)}
                  style={{ width: "100%", accentColor: "#34d399" }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Recognition ── */}
        <div className="rec-col">

          {/* Error */}
          {appState.error && (
            <div className="error-bar">
              <span>⚠</span>
              <span>{appState.error}</span>
            </div>
          )}

          {/* Current Letter */}
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

          {/* Current Word */}
          <div>
            <div className="sec-label">02 — Current Word {manualEdits.localWord && "(Manual)"}</div>
            <div className="word-card">
              <input
                type="text"
                value={manualEdits.localWord || appState.currentWord}
                onChange={(e) => setManualEdits({...manualEdits, localWord: e.target.value})}
                placeholder="Type word or let camera detect..."
                style={{ width: "100%", background: "#0a0e1a", color: "#34d399", border: "1px solid rgba(52, 211, 153, 0.3)", padding: "8px 10px", borderRadius: "4px", fontSize: "14px" }}
              />
              <div className="word-footer" style={{ marginTop: "8px" }}>
                <span className="word-len">
                  {(manualEdits.localWord || appState.currentWord).length > 0 ? `${(manualEdits.localWord || appState.currentWord).length} letters` : "waiting…"}
                </span>
                <button className="del-btn" style={{ position: "static", width: 28, height: 28 }}
                  title="Clear current word" onClick={() => {
                    setManualEdits({...manualEdits, localWord: ""});
                    deleteCurrentWord();
                  }}>×</button>
              </div>
            </div>
          </div>

          <div className="divider" />

          {/* Suggestions */}
          <div>
            <div className="sec-label">03 — Word Suggestions</div>
            <div className="sugg-wrap">
              {appState.suggestions.length > 0
                ? appState.suggestions.slice(0, 5).map((s, i) => (
                  <button key={i} className="sugg-btn" onClick={() => acceptSuggestion(s)}>
                    {s}
                  </button>
                ))
                : <span className="sugg-no">Type a word to see suggestions</span>
              }
            </div>
          </div>

          <div className="divider" />

          {/* Sentence */}
          <div style={{ flex: 1 }}>
            <div className="sec-label">04 — Current Sentence {manualEdits.localSentence && "(Manual)"}</div>
            <div className="sentence-card">
              <textarea
                value={manualEdits.localSentence || appState.currentSentence}
                onChange={(e) => setManualEdits({...manualEdits, localSentence: e.target.value})}
                placeholder="Type sentence or let camera build it..."
                style={{ width: "100%", background: "#0a0e1a", color: "#34d399", border: "1px solid rgba(52, 211, 153, 0.3)", padding: "8px 10px", borderRadius: "4px", fontSize: "14px", minHeight: "60px", fontFamily: "inherit", resize: "vertical" }}
              />
              <div className="sentence-footer" style={{ marginTop: "8px" }}>
                <button className="del-btn" style={{ position: "static", width: 28, height: 28, flexShrink: 0 }}
                  title="Clear manual sentence edit" onClick={() => setManualEdits({...manualEdits, localSentence: ""})}>✕</button>
                <button
                  className="send-btn"
                  disabled={!manualEdits.localSentence.trim() && !manualEdits.localWord.trim() && !appState.currentSentence.trim() && !appState.currentWord.trim()}
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
              <span className="chat-count">{appState.chatMessages.length} MSG{appState.chatMessages.length !== 1 ? "S" : ""}</span>

              <select
                value={appState.targetLanguage}
                onChange={(e) => updateAppState({ targetLanguage: e.target.value })}
                style={{ background: "#071025", color: "#fff", border: "1px solid rgba(255,255,255,0.06)", padding: "6px 8px", borderRadius: 6 }}
                title="Select target language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>

              {appState.chatMessages.length > 0 &&
                <button className="clear-chat-btn" onClick={() => updateAppState({ chatMessages: [] })}>CLEAR</button>}
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
              <strong>How it works:</strong> Sign letters one by one. Hold a sign for ~1 sec to lock it.
              Show a blank/open hand to commit the word to the sentence. Hit <strong>Send to Chat</strong> when ready.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
