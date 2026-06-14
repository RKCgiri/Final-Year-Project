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
from tensorflow.keras.models import model_from_json  # FIX: use tensorflow.keras
from spellchecker import SpellChecker
import base64
from io import BytesIO
from PIL import Image
import time
from collections import deque
from wordfreq import top_n_list

app = Flask(__name__)
CORS(app)

load_dotenv()

BACKEND_HOST = os.getenv('BACKEND_HOST', '0.0.0.0')
BACKEND_PORT = int(os.getenv('BACKEND_PORT', 5000))
DEBUG = os.getenv('DEBUG', 'False').lower() in ('1', 'true', 'yes')

# ── Word frequency list ────────────────────────────────────────────────────────
COMMON_WORDS = top_n_list("en", 50000)
_WORD_LIST = sorted(set(w.lower() for w in COMMON_WORDS))

def prefix_completions(prefix, limit=6):
    prefix = prefix.lower()
    matches = [w for w in _WORD_LIST if w.startswith(prefix)]
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

        self.frame_lock = threading.Lock()
        self.processing_thread = None
        self.frame_queue = deque(maxlen=2)
        self.last_prediction_time = 0
        self.prediction_interval = 0.1
        self.cache = {}

        # FIX: track camera state separately so we know if it's initializing
        self.camera_initializing = False

        self.load_models()
        self.initialize_counters()

    def initialize_counters(self):
        self.ct = {'blank': 0}
        for i in ascii_uppercase:
            self.ct[i] = 0

    def load_models(self):
        try:
            print("Loading gesture recognition models...")
            start_time = time.time()

            with open("Models/model_new.json", "r") as f:
                self.model_json = f.read()
            self.loaded_model = model_from_json(self.model_json)
            self.loaded_model.load_weights("Models/model_new.h5")
            self.loaded_model.compile(
                optimizer='adam',
                loss='categorical_crossentropy',
                metrics=['accuracy']
            )

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
                model.compile(
                    optimizer='adam',
                    loss='categorical_crossentropy',
                    metrics=['accuracy']
                )
                self.specialized_models[key] = model

            elapsed = time.time() - start_time
            print(f"✓ All models loaded in {elapsed:.2f}s")

        except Exception as e:
            print(f"✗ Error loading models: {e}")
            raise

    def start_camera(self):
        if self.is_running:
            return {"status": "warning", "message": "Camera already running"}

        # FIX: prevent double-start while initializing
        if self.camera_initializing:
            return {"status": "warning", "message": "Camera is initializing, please wait..."}

        try:
            self.camera_initializing = True

            self.vs = cv2.VideoCapture(0)
            if not self.vs.isOpened():
                self.camera_initializing = False
                return {"status": "error", "message": "Could not open camera"}

            self.vs.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.vs.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.vs.set(cv2.CAP_PROP_FPS, 30)
            self.vs.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            # FIX: warm-up — read and discard a few frames so camera stabilizes
            print("Warming up camera...")
            for _ in range(5):
                self.vs.read()
                time.sleep(0.05)

            self.is_running = True
            self.camera_initializing = False

            self.processing_thread = threading.Thread(
                target=self._continuous_frame_capture, daemon=True
            )
            self.processing_thread.start()

            print("✓ Camera started successfully")
            return {"status": "success", "message": "Camera started"}

        except Exception as e:
            self.camera_initializing = False
            return {"status": "error", "message": str(e)}

    def _continuous_frame_capture(self):
        """Background thread — captures frames continuously"""
        while self.is_running:
            try:
                ok, frame = self.vs.read()
                if not ok:
                    # FIX: if frame read fails, wait briefly before retrying
                    time.sleep(0.05)
                    continue

                frame = cv2.flip(frame, 1)

                x1 = int(0.5 * frame.shape[1])
                y1 = 10
                x2 = frame.shape[1] - 10
                y2 = int(0.5 * frame.shape[0])

                cv2.rectangle(frame, (x1 - 1, y1 - 1), (x2 + 1, y2 + 1), (255, 0, 0), 1)

                roi = frame[y1:y2, x1:x2]

                # Skin detection
                ycrcb = cv2.cvtColor(roi, cv2.COLOR_BGR2YCrCb)
                skin_mask = cv2.inRange(
                    ycrcb,
                    np.array([0, 133, 77]),
                    np.array([255, 173, 127])
                )
                kernel = np.ones((3, 3), np.uint8)
                skin_mask = cv2.dilate(skin_mask, kernel, iterations=2)
                skin_mask = cv2.erode(skin_mask, kernel, iterations=1)
                skin_mask = cv2.GaussianBlur(skin_mask, (5, 5), 0)
                skin_only = cv2.bitwise_and(roi, roi, mask=skin_mask)

                gray = cv2.cvtColor(skin_only, cv2.COLOR_BGR2GRAY)
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

                time.sleep(0.01)

            except Exception as e:
                print(f"Error in frame capture thread: {e}")
                time.sleep(0.05)  # FIX: wait before retrying on error
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
                self.vs = None  # FIX: explicitly clear so next start is clean
            with self.frame_lock:
                self.current_frame = None
                self.processed_frame = None
            print("✓ Camera stopped")
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

            if current_symbol in ['D', 'R', 'U'] and confidence > 0.5:
                result_dru = self.specialized_models['dru'].predict(test_image_input, verbose=0)
                dru_pred = {'D': result_dru[0][0], 'R': result_dru[0][1], 'U': result_dru[0][2]}
                dru_pred = sorted(dru_pred.items(), key=operator.itemgetter(1), reverse=True)
                current_symbol = dru_pred[0][0]

            elif current_symbol in ['T', 'D', 'I', 'K'] and confidence > 0.5:
                result_tkdi = self.specialized_models['tkdi'].predict(test_image_input, verbose=0)
                tkdi_pred = {
                    'D': result_tkdi[0][0], 'I': result_tkdi[0][1],
                    'K': result_tkdi[0][2], 'T': result_tkdi[0][3]
                }
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
                    if len(self.sentence) > 500:
                        self.sentence = ""
                    self.blank_flag = 0
                    self.word += current_symbol.lower()

        except Exception as e:
            print(f"Prediction error: {e}")

    def get_suggestions(self, word):
        if not word:
            return []

        word_lower = word.lower()
        if word_lower in self.cache:
            return self.cache[word_lower]

        prefix_hits = prefix_completions(word_lower, limit=6)
        spell_hits = sorted(self.hs.candidates(word_lower) or [])

        seen = set(prefix_hits)
        merged = list(prefix_hits)
        for w in spell_hits:
            if w not in seen and w != word_lower:
                merged.append(w)
                seen.add(w)
            if len(merged) >= 6:
                break

        if len(self.cache) > 500:
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
            "camera_initializing": self.camera_initializing,  # FIX: expose to frontend
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
        "camera_initializing": service.camera_initializing,
        "models_loaded": hasattr(service, 'loaded_model'),  # FIX: tell frontend if models are ready
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
    word = request.args.get('word', '').strip()
    if not word:
        return jsonify({"status": "success", "word": word, "suggestions": []})
    suggestions = service.get_suggestions(word)
    return jsonify({"status": "success", "word": word, "suggestions": suggestions})


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
    return jsonify({"status": "success", "message": "All text cleared", "data": service.get_state()})


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
    return jsonify({"status": "success", "message": "Last letter deleted", "data": service.get_state()})


@app.route('/api/recognition/clear-word', methods=['POST'])
def clear_word():
    service.word = ""
    service.initialize_counters()
    service.blank_flag = 0
    return jsonify({"status": "success", "message": "Current word cleared", "data": service.get_state()})


@app.route('/api/recognition/clear-sentence-word', methods=['POST'])
def clear_sentence_word():
    words = service.sentence.strip().split()
    if words:
        words.pop()
    service.sentence = " ".join(words)
    service.blank_flag = 0
    return jsonify({"status": "success", "message": "Last sentence word removed", "data": service.get_state()})


@app.route('/api/recognition/send-sentence', methods=['POST'])
def send_sentence():
    result = {
        "status": "success",
        "message": "Sentence sent and cleared",
        "sentence": service.sentence,
        "data": {"current_symbol": "—", "word": "", "sentence": "", "suggestions": []},
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
    return jsonify({"status": "success", "message": "Sentence cleared", "data": service.get_state()})


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print(" Sign Language Recognition API Server (OPTIMIZED)")
    print("=" * 60)
    print(f"Server running at http://{BACKEND_HOST}:{BACKEND_PORT}")
    print("=" * 60 + "\n")

    app.run(
        debug=DEBUG,
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        threaded=True,
        use_reloader=False,
    )