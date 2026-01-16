import os
import time
import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from transformers import MBartForConditionalGeneration, MBart50TokenizerFast
from gtts import gTTS
import speech_recognition as sr
from pydub import AudioSegment
from pydub.utils import make_chunks
import io

app = Flask(__name__)

# --- 1. BULLETPROOF CORS SETUP ---
# Explicitly allow Authorization headers and all origins
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, allow_headers=["Content-Type", "Authorization"])

# --- 2. CONFIGURATION ---
app.config['SECRET_KEY'] = 'super-secret-key-2026' 
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(days=1) # Token lasts 1 day

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# --- DEBUGGING HANDLERS ---
@jwt.invalid_token_loader
def invalid_token_callback(error):
    print(f"DEBUG: Invalid Token Error: {error}")
    return jsonify({'error': 'Invalid Token', 'message': str(error)}), 422

@jwt.unauthorized_loader
def missing_token_callback(error):
    print(f"DEBUG: Missing Token Error: {error}")
    return jsonify({'error': 'Missing Token', 'message': str(error)}), 401

# --- DB MODELS ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

class TranslationHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    original_text = db.Column(db.Text, nullable=False)
    translated_text = db.Column(db.Text, nullable=False)
    src_lang = db.Column(db.String(10), nullable=False)
    tgt_lang = db.Column(db.String(10), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)

with app.app_context():
    db.create_all()

# --- AI SETUP ---
AUDIO_DIR = "audio_files"
if not os.path.exists(AUDIO_DIR): os.makedirs(AUDIO_DIR)

print("Loading mBART model...")
model_name = "facebook/mbart-large-50-many-to-many-mmt"
tokenizer = MBart50TokenizerFast.from_pretrained(model_name)
model = MBartForConditionalGeneration.from_pretrained(model_name)
print("Model Ready!")

# --- UPDATED LANGUAGE MAP ---
LANG_MAP = {
    "en": "en_XX",  # English
    "fr": "fr_XX",  # French
    "es": "es_XX",  # Spanish
    "de": "de_DE",  # German
    "hi": "hi_IN",  # Hindi
    "zh": "zh_CN",  # Chinese
    "ar": "ar_AR",  # Arabic
    "ru": "ru_RU",  # Russian
    "ja": "ja_XX",  # Japanese
    "it": "it_IT",  # Italian (NEW)
    "pt": "pt_XX",  # Portuguese (NEW)
    "ko": "ko_KR"   # Korean (NEW)
}
# --- ROUTES ---

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"error": "Username already exists"}), 400
    hashed_pw = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    new_user = User(username=data['username'], password=hashed_pw)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User created"}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if user and bcrypt.check_password_hash(user.password, data['password']):
        # Create token
        access_token = create_access_token(identity=str(user.id))
        return jsonify({"token": access_token, "username": user.username})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/history', methods=['GET'])
@jwt_required()
def get_history():
    current_user_id = get_jwt_identity()
    history = TranslationHistory.query.filter_by(user_id=current_user_id).order_by(TranslationHistory.timestamp.desc()).all()
    output = []
    for item in history:
        output.append({
            "original": item.original_text,
            "translated": item.translated_text,
            "src": item.src_lang,
            "tgt": item.tgt_lang,
            "date": item.timestamp.strftime("%Y-%m-%d %H:%M")
        })
    return jsonify(output)

@app.route('/translate', methods=['POST'])
@jwt_required()
def translate():
    # DEBUG: Print headers to confirm token arrival
    print(f"DEBUG: Headers received: {request.headers.get('Authorization')}")
    
    try:
        current_user_id = get_jwt_identity()
        data = request.json
        text = data.get('text')
        src_code = data.get('sourceLang')
        tgt_code = data.get('targetLang')

        if not text: return jsonify({"error": "No text"}), 400

        # AI Logic
        tokenizer.src_lang = LANG_MAP.get(src_code, "en_XX")
        encoded = tokenizer(text, return_tensors="pt")
        forced_id = tokenizer.lang_code_to_id[LANG_MAP.get(tgt_code, "en_XX")]
        generated = model.generate(**encoded, forced_bos_token_id=forced_id)
        translated_text = tokenizer.batch_decode(generated, skip_special_tokens=True)[0]

        # Save to DB
        new_entry = TranslationHistory(
            user_id=current_user_id,
            original_text=text,
            translated_text=translated_text,
            src_lang=src_code,
            tgt_lang=tgt_code
        )
        db.session.add(new_entry)
        db.session.commit()

        # TTS
        tts = gTTS(text=translated_text, lang=tgt_code)
        filename = f"out_{int(time.time())}.mp3"
        tts.save(os.path.join(AUDIO_DIR, filename))

        return jsonify({
            "translatedText": translated_text,
            "audioUrl": f"http://localhost:5000/audio/{filename}"
        })

    except Exception as e:
        print(f"SERVER ERROR: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    # Basic audio handling for demo
    if 'file' not in request.files: return jsonify({"error": "No file"}), 400
    file = request.files['file']
    try:
        audio = AudioSegment.from_file(file)
        wav_io = io.BytesIO()
        audio.export(wav_io, format="wav")
        wav_io.seek(0)
        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_io) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": "Audio failed"}), 500

@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory(AUDIO_DIR, filename)

if __name__ == '__main__':
    app.run(port=5000, debug=True)