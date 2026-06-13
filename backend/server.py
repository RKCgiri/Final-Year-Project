"""
Flask API Server for Sign Language Recognition - OPTIMIZED
Connects the gesture recognition model with the frontend React app
Performance improvements: threading, caching, request throttling
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv
import cv2
import numpy as np
import threading
import json
from string import ascii_uppercase
import operator
from keras.models import model_from_json
from spellchecker import SpellChecker
import base64
from io import BytesIO
from PIL import Image
import time
from collections import deque

app = Flask(__name__)
CORS(app)

load_dotenv()

BACKEND_HOST = os.getenv('BACKEND_HOST', '0.0.0.0')
BACKEND_PORT = int(os.getenv('BACKEND_PORT', 5000))
DEBUG = os.getenv('DEBUG', 'False').lower() in ('1', 'true', 'yes')


# ── Word frequency list for prefix-based suggestions ──────────────────────────
# A curated set of common English words sorted by approximate frequency.
# This drives instant prefix completions (e.g. "WAN" → WANT, WANDER, WANT…)
# without needing an internet call. Add more words here to expand coverage.
COMMON_WORDS = [
    # Top 500-ish most common English words, roughly frequency-ordered
    "the","be","to","of","and","a","in","that","have","it","for","not","on",
    "with","he","as","you","do","at","this","but","his","by","from","they",
    "we","say","her","she","or","an","will","my","one","all","would","there",
    "their","what","so","up","out","if","about","who","get","which","go","me",
    "when","make","can","like","time","no","just","him","know","take","people",
    "into","year","your","good","some","could","them","see","other","than","then",
    "now","look","only","come","its","over","think","also","back","after","use",
    "two","how","our","work","first","well","way","even","new","want","because",
    "any","these","give","day","most","us","great","between","need","large","often",
    "hand","high","place","hold","point","world","still","own","life","few","north",
    "open","seem","together","next","white","children","begin","got","walk","example",
    "ease","paper","group","always","music","those","both","mark","book","letter",
    "until","mile","river","car","feet","care","second","enough","plain","girl","usual",
    "young","ready","above","ever","red","list","though","feel","talk","bird","soon",
    "body","dog","family","direct","pose","leave","song","measure","door","product",
    "black","short","numeral","class","wind","question","happen","complete","ship",
    "area","half","rock","order","fire","south","problem","piece","told","knew",
    "pass","since","top","whole","king","space","heard","best","hour","better",
    "true","during","hundred","five","remember","step","early","hold","west","ground",
    "interest","reach","fast","verb","sing","listen","six","table","travel","less",
    "morning","ten","simple","several","vowel","toward","war","lay","against","pattern",
    "slow","center","love","person","money","serve","appear","road","map","rain","rule",
    "govern","pull","cold","notice","voice","unit","power","town","fine","drive","plan",
    "expect","heavy","dance","sing","surprise","behind","along","chance","born","level",
    "triangle","molecule","select","wrong","gray","repeat","require","broad","prepare",
    "salt","nose","plural","anger","claim","special","wide","decide","contain","course",
    # Common W words to test the WAN example
    "want","wanted","wants","wanting","wander","wanders","wandered","wandering","wane",
    "waned","wanes","waning","war","ward","warm","warmed","warming","warms","warn",
    "warned","warning","warns","was","wash","washed","washing","watch","watched",
    "watching","water","way","we","weak","wealth","wear","weather","week","well",
    "went","were","what","when","where","which","while","white","who","why","wide",
    "will","win","wind","wish","with","without","woman","women","wonder","wood",
    "word","work","world","worry","write","wrote","wrong",
]

# Build a sorted list of unique lowercase words for binary-search prefix matching
_WORD_LIST = sorted(set(w.lower() for w in COMMON_WORDS))

def prefix_completions(prefix, limit=6):
    """
    Return up to `limit` words from _WORD_LIST that START WITH `prefix`.
    Uses a simple linear scan (fast enough for a few-hundred-word list).
    Shorter words come first so the most "basic" completions surface first.
    """
    prefix = prefix.lower()
    matches = [w for w in _WORD_LIST if w.startswith(prefix) and w != prefix]
    matches.sort(key=lambda w: (len(w), w))
    return matches[:limit]


class GestureRecognitionService:
    def __init__(self):
        self.vs = None
        self.current_frame = None
        self.processed_frame = None
        self.current_symbol = "—"
        self.word = ""
        self.sentence = ""
        self.is_running = False
        self.ct = {}
        self.blank_flag = 0
        self.hs = SpellChecker()

        # Performance optimizations
        self.frame_lock = threading.Lock()
        self.processing_thread = None
        self.frame_queue = deque(maxlen=2)
        self.last_prediction_time = 0
        self.prediction_interval = 0.1  # Predict every 100ms
        self.cache = {}

        self.load_models()
        self.initialize_counters()

    def initialize_counters(self):
        """Initialize character counters"""
        self.ct = {'blank': 0}
        for i in ascii_uppercase:
            self.ct[i] = 0

    def load_models(self):
        """Load Keras models"""
        try:
            print("🔄 Loading gesture recognition models...")
            start_time = time.time()

            with open("Models/model_new.json", "r") as f:
                self.model_json = f.read()
            self.loaded_model = model_from_json(self.model_json)
            self.loaded_model.load_weights("Models/model_new.h5")
            self.loaded_model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])

            models_config = [
                ("Models/model-bw_dru.json",  "Models/model-bw_dru.h5",  "dru"),
                ("Models/model-bw_tkdi.json", "Models/model-bw_tkdi.h5", "tkdi"),
                ("Models/model-bw_smn.json",  "Models/model-bw_smn.h5",  "smn"),
            ]

            self.specialized_models = {}
            for json_path, weights_path, key in models_config:
                with open(json_path, "r") as f:
                    model_json = f.read()
                model = model_from_json(model_json)
                model.load_weights(weights_path)
                model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
                self.specialized_models[key] = model

            elapsed = time.time() - start_time
            print(f"✓ All models loaded in {elapsed:.2f}s")
        except Exception as e:
            print(f"✗ Error loading models: {e}")
            raise

    def start_camera(self):
        if self.is_running:
            return {"status": "warning", "message": "Camera already running"}
        try:
            self.vs = cv2.VideoCapture(0)
            if not self.vs.isOpened():
                return {"status": "error", "message": "Could not open camera"}

            self.vs.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.vs.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.vs.set(cv2.CAP_PROP_FPS, 30)
            self.vs.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            self.is_running = True
            self.processing_thread = threading.Thread(
                target=self._continuous_frame_capture, daemon=True
            )
            self.processing_thread.start()
            return {"status": "success", "message": "Camera started"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def _continuous_frame_capture(self):
        """Background thread — captures frames continuously"""
        while self.is_running:
            try:
                ok, frame = self.vs.read()
                if not ok:
                    continue

                frame = cv2.flip(frame, 1)

                x1 = int(0.5 * frame.shape[1])
                y1 = 10
                x2 = frame.shape[1] - 10
                y2 = int(0.5 * frame.shape[0])

                cv2.rectangle(frame, (x1 - 1, y1 - 1), (x2 + 1, y2 + 1), (255, 0, 0), 1)

                roi = frame[y1:y2, x1:x2]
                gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                blur = cv2.GaussianBlur(gray, (5, 5), 2)
                th3 = cv2.adaptiveThreshold(
                    blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                    cv2.THRESH_BINARY_INV, 11, 2
                )
                ret, processed = cv2.threshold(
                    th3, 70, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
                )

                with self.frame_lock:
                    self.current_frame = frame
                    self.processed_frame = processed

                time.sleep(0.01)  # ~100 FPS capture
            except Exception as e:
                print(f"Error in frame capture thread: {e}")
                continue

    def stop_camera(self):
        if not self.is_running:
            return {"status": "warning", "message": "Camera not running"}
        try:
            self.is_running = False
            if self.processing_thread:
                self.processing_thread.join(timeout=2)
            if self.vs:
                self.vs.release()
            return {"status": "success", "message": "Camera stopped"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_frame(self):
        if not self.is_running or self.current_frame is None:
            return None, None
        with self.frame_lock:
            return (
                self.current_frame.copy(),
                self.processed_frame.copy() if self.processed_frame is not None else None,
            )

    def predict(self, test_image):
        """
        Predict gesture from image.
        Confirmation threshold: 30 frames (~3s hold at 100ms poll).
        Fluctuation guard: 15 frames — minor noise doesn't reset a confirmed letter.
        """
        if test_image is None:
            return

        current_time = time.time()
        if current_time - self.last_prediction_time < self.prediction_interval:
            return
        self.last_prediction_time = current_time

        try:
            test_image = cv2.resize(test_image, (128, 128))
            test_image_input = test_image.reshape(1, 128, 128, 1).astype('float32') / 255.0

            result = self.loaded_model.predict(test_image_input, verbose=0)

            prediction = {'blank': result[0][0]}
            idx = 1
            for i in ascii_uppercase:
                prediction[i] = result[0][idx]
                idx += 1

            prediction = sorted(prediction.items(), key=operator.itemgetter(1), reverse=True)
            current_symbol = prediction[0][0]
            confidence = prediction[0][1]

            # Specialized disambiguation models
            if current_symbol in ['D', 'R', 'U'] and confidence > 0.5:
                result_dru = self.specialized_models['dru'].predict(test_image_input, verbose=0)
                dru_pred = {'D': result_dru[0][0], 'R': result_dru[0][1], 'U': result_dru[0][2]}
                dru_pred = sorted(dru_pred.items(), key=operator.itemgetter(1), reverse=True)
                current_symbol = dru_pred[0][0]

            elif current_symbol in ['T', 'D', 'I', 'K'] and confidence > 0.5:
                result_tkdi = self.specialized_models['tkdi'].predict(test_image_input, verbose=0)
                tkdi_pred = {'D': result_tkdi[0][0], 'I': result_tkdi[0][1],
                             'K': result_tkdi[0][2], 'T': result_tkdi[0][3]}
                tkdi_pred = sorted(tkdi_pred.items(), key=operator.itemgetter(1), reverse=True)
                current_symbol = tkdi_pred[0][0]

            elif current_symbol in ['M', 'N', 'S'] and confidence > 0.5:
                result_smn = self.specialized_models['smn'].predict(test_image_input, verbose=0)
                smn_pred = {'M': result_smn[0][0], 'N': result_smn[0][1], 'S': result_smn[0][2]}
                smn_pred = sorted(smn_pred.items(), key=operator.itemgetter(1), reverse=True)
                if smn_pred[0][0] == 'S':
                    current_symbol = smn_pred[0][0]

            self.current_symbol = current_symbol

            if current_symbol == 'blank':
                self.initialize_counters()
            else:
                self.ct[current_symbol] += 1

            CONFIRM_THRESHOLD = 30
            FLUCTUATION_TOLERANCE = 15

            if self.ct[current_symbol] > CONFIRM_THRESHOLD:
                for i in ascii_uppercase:
                    if i == current_symbol:
                        continue
                    tmp = abs(self.ct[current_symbol] - self.ct[i])
                    if tmp <= FLUCTUATION_TOLERANCE:
                        self.initialize_counters()
                        return

                self.initialize_counters()

                if current_symbol == 'blank':
                    if self.blank_flag == 0:
                        self.blank_flag = 1
                        if len(self.sentence) > 0:
                            self.sentence += " "
                        self.sentence += self.word
                        self.word = ""
                else:
                    # FIX: was capping sentence at 16 chars — raised to 500
                    if len(self.sentence) > 500:
                        self.sentence = ""
                    self.blank_flag = 0
                    self.word += current_symbol

        except Exception as e:
            print(f"Prediction error: {e}")

    def get_suggestions(self, word):
        """
        Hybrid suggestion engine:
          1. PREFIX completions  — words that START WITH the typed prefix.
             This is what drives "WAN → WANT, WANDER, WANE…" even before
             the word is finished.  Uses the built-in COMMON_WORDS list.
          2. SPELL-CHECK candidates — corrections from pyspellchecker for
             words that don't match any known prefix (typo recovery).
        Results are deduplicated, capped at 6, and cached per word.
        """
        if not word:
            return []

        word_lower = word.lower()

        if word_lower in self.cache:
            return self.cache[word_lower]

        # Step 1: prefix completions (most useful during live gesture input)
        prefix_hits = prefix_completions(word_lower, limit=6)

        # Step 2: spell-check candidates (useful for completed but misspelled words)
        spell_hits = sorted(self.hs.candidates(word_lower) or [])

        # Merge: prefix hits first, then spell hits not already included
        seen = set(prefix_hits)
        merged = list(prefix_hits)
        for w in spell_hits:
            if w not in seen and w != word_lower:
                merged.append(w)
                seen.add(w)
            if len(merged) >= 6:
                break

        # Cache and return
        if len(self.cache) > 500:
            # Evict oldest 50 entries
            for k in list(self.cache.keys())[:50]:
                del self.cache[k]
        self.cache[word_lower] = merged

        return merged

    def accept_suggestion(self, suggestion):
        self.word = ""
        self.initialize_counters()
        self.blank_flag = 0
        if len(self.sentence) > 0:
            self.sentence += " "
        self.sentence += suggestion

    def clear_all(self):
        self.word = ""
        self.sentence = ""
        self.initialize_counters()

    def get_state(self):
        return {
            "current_symbol": self.current_symbol,
            "word": self.word,
            "sentence": self.sentence,
            "is_running": self.is_running,
            "suggestions": self.get_suggestions(self.word),
        }


# Initialize service
service = GestureRecognitionService()


# ==================== API ENDPOINTS ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "service": "Sign Language Recognition API",
        "camera_active": service.is_running,
    })


@app.route('/api/camera/start', methods=['POST'])
def start_camera():
    result = service.start_camera()
    return jsonify(result)


@app.route('/api/camera/stop', methods=['POST'])
def stop_camera():
    result = service.stop_camera()
    return jsonify(result)


@app.route('/api/camera/frame', methods=['GET'])
def get_frame():
    frame, processed = service.get_frame()
    if frame is None:
        return jsonify({"status": "error", "message": "Could not capture frame"}), 400
    try:
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
        _, buffer = cv2.imencode('.jpg', frame, encode_param)
        frame_b64 = base64.b64encode(buffer).decode('utf-8')

        _, processed_buffer = cv2.imencode('.jpg', processed, encode_param)
        processed_b64 = base64.b64encode(processed_buffer).decode('utf-8')

        response = jsonify({
            "status": "success",
            "frame": frame_b64,
            "processed": processed_b64,
        })
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/recognition/state', methods=['GET'])
def get_recognition_state():
    frame, processed = service.get_frame()
    if processed is not None:
        service.predict(processed)

    state = service.get_state()

    frame_data = None
    if frame is not None:
        try:
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
            _, buffer = cv2.imencode('.jpg', frame, encode_param)
            frame_data = base64.b64encode(buffer).decode('utf-8')
        except Exception:
            pass

    response_data = {"status": "success", "data": state}
    if frame_data:
        response_data["frame"] = frame_data

    return jsonify(response_data)


@app.route('/api/recognition/suggestions', methods=['GET'])
def get_suggestions():
    """
    Accepts any ?word= query — called by the frontend whenever the active
    word changes (gesture-built OR manually typed), giving live prefix
    completions immediately as letters accumulate.
    """
    word = request.args.get('word', '').strip()
    if not word:
        return jsonify({"status": "success", "word": word, "suggestions": []})

    suggestions = service.get_suggestions(word)
    return jsonify({
        "status": "success",
        "word": word,
        "suggestions": suggestions,
    })


@app.route('/api/recognition/accept-suggestion', methods=['POST'])
def accept_suggestion():
    data = request.json
    suggestion = data.get('suggestion', '')
    if suggestion:
        service.accept_suggestion(suggestion)
        return jsonify({"status": "success", "data": service.get_state()})
    return jsonify({"status": "error", "message": "No suggestion provided"}), 400


@app.route('/api/recognition/clear', methods=['POST'])
def clear_recognition():
    service.clear_all()
    return jsonify({
        "status": "success",
        "message": "All text cleared",
        "data": service.get_state(),
    })


@app.route('/api/recognition/reset', methods=['POST'])
def reset():
    service.clear_all()
    if service.is_running:
        service.stop_camera()
    return jsonify({"status": "success", "message": "Service reset"})


@app.route('/api/recognition/delete-letter', methods=['POST'])
def delete_letter():
    if len(service.word) > 0:
        service.word = service.word[:-1]
    return jsonify({
        "status": "success",
        "message": "Last letter deleted",
        "data": service.get_state(),
    })


@app.route('/api/recognition/clear-word', methods=['POST'])
def clear_word():
    service.word = ""
    service.initialize_counters()
    service.blank_flag = 0
    return jsonify({
        "status": "success",
        "message": "Current word cleared",
        "data": service.get_state(),
    })


@app.route('/api/recognition/clear-sentence-word', methods=['POST'])
def clear_sentence_word():
    words = service.sentence.strip().split()
    if words:
        words.pop()
    service.sentence = " ".join(words)
    service.blank_flag = 0
    return jsonify({
        "status": "success",
        "message": "Last sentence word removed",
        "data": service.get_state(),
    })


@app.route('/api/recognition/send-sentence', methods=['POST'])
def send_sentence():
    result = {
        "status": "success",
        "message": "Sentence sent and cleared",
        "sentence": service.sentence,
        "data": {
            "current_symbol": "—",
            "word": "",
            "sentence": "",
            "suggestions": [],
        },
    }
    service.word = ""
    service.sentence = ""
    service.initialize_counters()
    service.blank_flag = 0
    return jsonify(result)


@app.route('/api/recognition/clear-current-sentence', methods=['POST'])
def clear_current_sentence():
    service.sentence = ""
    service.blank_flag = 0
    return jsonify({
        "status": "success",
        "message": "Sentence cleared",
        "data": service.get_state(),
    })


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print(" Sign Language Recognition API Server (OPTIMIZED)")
    print("=" * 60)
    print("✓ Threading enabled for continuous frame capture")
    print("✓ Letter confirmation threshold: 30 frames (~3s hold)")
    print("✓ Hybrid suggestion engine: prefix + spell-check")
    print("✓ Sentence length cap raised to 500 characters")
    print("✓ Frame compression enabled (JPEG quality 70)")
    print("✓ Suggestion caching (up to 500 entries)")
    print(f"✓ Server running at http://{BACKEND_HOST}:{BACKEND_PORT}")
    print("=" * 60 + "\n")

    app.run(
        debug=DEBUG,
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        threaded=True,
        use_reloader=False,
    )