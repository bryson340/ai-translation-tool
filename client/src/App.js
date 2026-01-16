import React, { useState, useRef } from 'react';
import axios from 'axios';
import './App.css';
import { FaMicrophone, FaFileUpload, FaPlay, FaSignOutAlt, FaUser, FaSpinner } from 'react-icons/fa';
import { motion } from 'framer-motion';

function App() {
  // --- STATE MANAGEMENT ---
  const [token, setToken] = useState(localStorage.getItem('session_token'));
  const [user, setUser] = useState(localStorage.getItem('session_user'));
  
  const [view, setView] = useState('translator'); 
  const [isLogin, setIsLogin] = useState(true);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('fr');
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  
  const fileInputRef = useRef(null);

  // --- NEW: EXTENDED LANGUAGE LIST ---
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'de', name: 'German' },
    { code: 'hi', name: 'Hindi' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'ru', name: 'Russian' },
    { code: 'it', name: 'Italian' },    // NEW
    { code: 'pt', name: 'Portuguese' }, // NEW
    { code: 'ko', name: 'Korean' }      // NEW
  ];

  // --- FORCE LOGOUT ---
  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('session_token');
    localStorage.removeItem('session_user');
    setView('translator');
    setAuthUsername('');
    setAuthPassword('');
  };

  // --- AUTHENTICATION ---
  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? '/login' : '/register';
    try {
      const res = await axios.post(`http://localhost:5000${endpoint}`, {
        username: authUsername,
        password: authPassword
      });
      if (isLogin) {
        const newToken = res.data.token;
        const newUser = res.data.username;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('session_token', newToken);
        localStorage.setItem('session_user', newUser);
      } else {
        alert("Registration successful! Please login.");
        setIsLogin(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Auth failed");
    }
  };

  // --- TRANSLATION LOGIC ---
  const handleTranslate = async () => {
    // 1. Validation: Prevent Same Language Translation
    if (sourceLang === targetLang) {
      alert("Please select different languages for Source and Target.");
      return; 
    }

    if (!inputText) return;
    setIsLoading(true);
    
    const currentToken = localStorage.getItem('session_token');

    if (!currentToken) {
      handleLogout();
      return;
    }

    try {
      const res = await axios.post('http://localhost:5000/translate', 
        {
          text: inputText,
          sourceLang,
          targetLang
        }, 
        { 
          headers: { 
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      setTranslatedText(res.data.translatedText);
      setAudioUrl(res.data.audioUrl);
    } catch (err) {
      console.error("Translation Error:", err);
      if (err.response && (err.response.status === 401 || err.response.status === 422)) {
        alert("Session expired. Please login again.");
        handleLogout();
      } else {
        alert("Translation Failed: " + (err.response?.data?.error || "Server Error"));
      }
    }
    setIsLoading(false);
  };

  // --- HISTORY ---
  const fetchHistory = async () => {
    const currentToken = localStorage.getItem('session_token');
    try {
      const res = await axios.get('http://localhost:5000/history', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setHistory(res.data);
      setView('history');
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 422)) {
        handleLogout();
      }
    }
  };

  // --- AUDIO UPLOAD ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post('http://localhost:5000/upload-audio', formData);
      setInputText(response.data.text);
    } catch (error) { alert("Audio transcription failed."); }
    setIsLoading(false);
  };

  // --- SPEECH RECOGNITION ---
  const startListening = () => {
     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
     if (!SpeechRecognition) { alert("Browser not supported"); return; }
     const recognition = new SpeechRecognition();
     recognition.lang = sourceLang === 'en' ? 'en-US' : sourceLang;
     recognition.start();
     recognition.onresult = (event) => setInputText(event.results[0][0].transcript);
  };

  // --- RENDER LOGIN SCREEN ---
  if (!token) {
    return (
      <div className="app-container auth-container">
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="glass-card auth-card">
          <h1>Lingua<span className="highlight">AI</span></h1>
          <p>{isLogin ? "Welcome Back" : "Create Account"}</p>
          <form onSubmit={handleAuth}>
            <input type="text" placeholder="Username" value={authUsername} onChange={e=>setAuthUsername(e.target.value)} required />
            <input type="password" placeholder="Password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} required />
            <button type="submit" className="translate-main-btn">{isLogin ? "Login" : "Sign Up"}</button>
          </form>
          <button className="link-btn" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Create an account" : "Have an account? Login"}
          </button>
        </motion.div>
      </div>
    );
  }

  // --- RENDER MAIN APP ---
  return (
    <div className="app-container">
      <div className="background-shapes"><div className="shape shape-1"></div><div className="shape shape-2"></div></div>
      
      <motion.div initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} className="glass-card">
        <header className="app-header">
          <div className="user-info"><FaUser /> {user}</div>
          <div className="header-actions">
            <button onClick={() => setView('translator')} className={view==='translator'?'active-nav':''}>Translator</button>
            <button onClick={fetchHistory} className={view==='history'?'active-nav':''}>History</button>
            <button onClick={handleLogout} className="logout-btn"><FaSignOutAlt /></button>
          </div>
        </header>

        {view === 'history' ? (
          <div className="history-list">
            <h2>Your History</h2>
            {history.length === 0 && <p>No history found.</p>}
            {history.map((h, i) => (
              <div key={i} className="history-item">
                <div className="h-meta">{h.date} | {h.src} → {h.tgt}</div>
                <div className="h-original">{h.original}</div>
                <div className="h-translated">{h.translated}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="translation-grid">
             {/* INPUT PANEL */}
             <div className="panel input-panel">
                <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
                   {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
                <textarea value={inputText} onChange={e=>setInputText(e.target.value)} placeholder="Enter text..." />
                <div className="controls">
                   <button className="action-btn" onClick={startListening}><FaMicrophone/></button>
                   <button className="action-btn" onClick={()=>fileInputRef.current.click()}><FaFileUpload/></button>
                   <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} />
                </div>
             </div>

             {/* OUTPUT PANEL */}
             <div className="panel output-panel">
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                   {languages.map(l => (
                      <option 
                        key={l.code} 
                        value={l.code}
                        disabled={l.code === sourceLang} // User cannot select same source/target
                        style={{ color: l.code === sourceLang ? '#999' : 'inherit' }}
                      >
                        {l.name}
                      </option>
                   ))}
                </select>
                <div className="output-area">
                  {isLoading ? <div className="loading-state"><FaSpinner className="spin"/> Translating...</div> : translatedText}
                </div>
                {translatedText && <button className="play-btn" onClick={()=>new Audio(audioUrl).play()}><FaPlay/> Listen</button>}
             </div>
          </div>
        )}

        {view === 'translator' && (
          <button className="translate-main-btn" onClick={handleTranslate} disabled={isLoading}>
            {isLoading ? "Processing..." : "Translate"}
          </button>
        )}
      </motion.div>
    </div>
  );
}

export default App;