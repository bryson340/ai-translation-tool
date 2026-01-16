# 🌍 AI Translation Tool

A full-stack multilingual translation application capable of handling text, real-time speech, and audio file uploads. Built to demonstrate the integration of heavy NLP models (Facebook mBART-50) with a modern React frontend and secure Python backend.

![Project Screenshot](https://via.placeholder.com/1000x500?text=Upload+Your+Screenshot+Here)
*(Replace the link above with your actual screenshot link later)*

## 🚀 Features

- **🧠 Advanced AI Translation:** Utilizes **Facebook's mBART-50** Large Neural Machine Translation model to translate between 12+ languages with high accuracy.
- **🎙️ Full Audio Pipeline:**
  - **Speech-to-Text (STT):** Supports live microphone input and audio file uploads (mp3/wav).
  - **Text-to-Speech (TTS):** Generates natural-sounding audio for all translated outputs.
  - **Smart Chunking:** Implements server-side logic to slice and process long audio files (2+ minutes) without hitting API timeouts.
- **🔐 Secure Authentication:**
  - User registration and login system using **JWT (JSON Web Tokens)**.
  - Session management with auto-logout on expiry.
- **📜 Smart History:** automatically saves all user translations to a persistent **SQLite** database for future reference.
- **🎨 Modern UI/UX:** "Glassmorphism" design using **React Framer Motion** for smooth animations and a responsive experience.

## 🛠️ Tech Stack

### **Frontend**
- **Framework:** React.js
- **Styling:** CSS3 (Glassmorphism), Framer Motion
- **HTTP Client:** Axios
- **State Management:** React Hooks

### **Backend**
- **Framework:** Flask (Python)
- **AI Model:** Hugging Face Transformers (mBART-50)
- **Audio Processing:** FFmpeg, PyDub, SpeechRecognition, gTTS
- **Database:** SQLite (via SQLAlchemy)
- **Security:** Flask-Bcrypt, Flask-JWT-Extended

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js & npm
- FFmpeg (installed and added to system PATH)

### 1. Clone the Repository
```bash
git clone [https://github.com/bryson340/ai-translation-tool.git](https://github.com/bryson340/ai-translation-tool.git)
cd ai-translation-tool