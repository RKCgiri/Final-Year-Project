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
CORS(app)  # Enable CORS for frontend communication

# Load environment variables from .env (if present)
load_dotenv()

# Backend server configuration from env
BACKEND_HOST = os.getenv('BACKEND_HOST', '0.0.0.0')
BACKEND_PORT = int(os.getenv('BACKEND_PORT', 5000))
DEBUG = os.getenv('DEBUG', 'False').lower() in ('1', 'true', 'yes')

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
        self.frame_queue = deque(maxlen=2)  # Keep only latest frames
        self.last_prediction_time = 0
        self.prediction_interval = 0.1  # Predict every 100ms
        self.frame_skip_count = 0
        self.cache = {}  # Simple cache for suggestions
        
        # Load models
        self.load_models()
        self.initialize_counters()
    
    def initialize_counters(self):
        """Initialize character counters"""
        self.ct = {'blank': 0}
        for i in ascii_uppercase:
            self.ct[i] = 0
    
    def load_models(self):
        """Load Keras models with error handling and caching"""
        try:
            print("🔄 Loading gesture recognition models...")
            start_time = time.time()
            
            # Load main model
            with open("Models/model_new.json", "r") as f:
                self.model_json = f.read()
            self.loaded_model = model_from_json(self.model_json)
            self.loaded_model.load_weights("Models/model_new.h5")
            self.loaded_model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
            
            # Load specialized models (lighter models for specific character pairs)
            models_config = [
                ("Models/model-bw_dru.json", "Models/model-bw_dru.h5", "dru"),
                ("Models/model-bw_tkdi.json", "Models/model-bw_tkdi.h5", "tkdi"),
                ("Models/model-bw_smn.json", "Models/model-bw_smn.h5", "smn")
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
            print(f"✓ All models loaded successfully in {elapsed:.2f}s")
        except Exception as e:
            print(f"✗ Error loading models: {e}")
            raise
    
    def start_camera(self):
        """Start video capture with background thread for continuous processing"""
        if self.is_running:
            return {"status": "warning", "message": "Camera already running"}
        
        try:
            self.vs = cv2.VideoCapture(0)
            if not self.vs.isOpened():
                return {"status": "error", "message": "Could not open camera"}
            
            # Set camera properties for better performance
            self.vs.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.vs.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.vs.set(cv2.CAP_PROP_FPS, 30)
            self.vs.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimize buffer
            
            self.is_running = True
            
            # Start continuous frame capture thread
            self.processing_thread = threading.Thread(target=self._continuous_frame_capture, daemon=True)
            self.processing_thread.start()
            
            return {"status": "success", "message": "Camera started"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _continuous_frame_capture(self):
        """Background thread that continuously captures and processes frames"""
        while self.is_running:
            try:
                ok, frame = self.vs.read()
                if not ok:
                    continue
                
                # Flip frame
                frame = cv2.flip(frame, 1)
                
                # Extract ROI (Region of Interest)
                x1 = int(0.5 * frame.shape[1])
                y1 = 10
                x2 = frame.shape[1] - 10
                y2 = int(0.5 * frame.shape[0])
                
                # Draw rectangle on original frame
                cv2.rectangle(frame, (x1 - 1, y1 - 1), (x2 + 1, y2 + 1), (255, 0, 0), 1)
                
                # Extract ROI
                roi = frame[y1:y2, x1:x2]
                
                # Process ROI for prediction
                gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                blur = cv2.GaussianBlur(gray, (5, 5), 2)
                th3 = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
                ret, processed = cv2.threshold(th3, 70, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                
                # Update frame with lock to prevent race conditions
                with self.frame_lock:
                    self.current_frame = frame
                    self.processed_frame = processed
                
                time.sleep(0.01)  # ~100 FPS capture rate
            except Exception as e:
                print(f"Error in frame capture thread: {e}")
                continue
    
    def stop_camera(self):
        """Stop video capture"""
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
        """Get current frame (pre-captured in background thread) - OPTIMIZED"""
        if not self.is_running or self.current_frame is None:
            return None, None
        
        with self.frame_lock:
            return self.current_frame.copy(), self.processed_frame.copy() if self.processed_frame is not None else None
    
    def predict(self, test_image):
        """Predict gesture from image - OPTIMIZED with specialized models only when needed"""
        if test_image is None:
            return
        
        # Throttle predictions
        current_time = time.time()
        if current_time - self.last_prediction_time < self.prediction_interval:
            return
        self.last_prediction_time = current_time
        
        try:
            test_image = cv2.resize(test_image, (128, 128))
            test_image_input = test_image.reshape(1, 128, 128, 1).astype('float32') / 255.0
            
            # Main prediction
            result = self.loaded_model.predict(test_image_input, verbose=0)
            
            prediction = {'blank': result[0][0]}
            idx = 1
            for i in ascii_uppercase:
                prediction[i] = result[0][idx]
                idx += 1
            
            # Sort and get top prediction
            prediction = sorted(prediction.items(), key=operator.itemgetter(1), reverse=True)
            current_symbol = prediction[0][0]
            confidence = prediction[0][1]
            
            # Use specialized models only for confusable characters
            if current_symbol in ['D', 'R', 'U'] and confidence > 0.5:
                result_dru = self.specialized_models['dru'].predict(test_image_input, verbose=0)
                dru_pred = {'D': result_dru[0][0], 'R': result_dru[0][1], 'U': result_dru[0][2]}
                dru_pred = sorted(dru_pred.items(), key=operator.itemgetter(1), reverse=True)
                current_symbol = dru_pred[0][0]
            
            elif current_symbol in ['T', 'D', 'I', 'K'] and confidence > 0.5:
                result_tkdi = self.specialized_models['tkdi'].predict(test_image_input, verbose=0)
                tkdi_pred = {'D': result_tkdi[0][0], 'I': result_tkdi[0][1], 'K': result_tkdi[0][2], 'T': result_tkdi[0][3]}
                tkdi_pred = sorted(tkdi_pred.items(), key=operator.itemgetter(1), reverse=True)
                current_symbol = tkdi_pred[0][0]
            
            elif current_symbol in ['M', 'N', 'S'] and confidence > 0.5:
                result_smn = self.specialized_models['smn'].predict(test_image_input, verbose=0)
                smn_pred = {'M': result_smn[0][0], 'N': result_smn[0][1], 'S': result_smn[0][2]}
                smn_pred = sorted(smn_pred.items(), key=operator.itemgetter(1), reverse=True)
                if smn_pred[0][0] == 'S':
                    current_symbol = smn_pred[0][0]
            
            self.current_symbol = current_symbol
            
            # Handle blank (space)
            if current_symbol == 'blank':
                self.initialize_counters()
            else:
                self.ct[current_symbol] += 1
            
            # Check if symbol confidence is high enough
            if self.ct[current_symbol] > 60:
                for i in ascii_uppercase:
                    if i == current_symbol:
                        continue
                    tmp = abs(self.ct[current_symbol] - self.ct[i])
                    if tmp <= 20:
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
                    if len(self.sentence) > 16:
                        self.sentence = ""
                    self.blank_flag = 0
                    self.word += current_symbol
        except Exception as e:
            print(f"Prediction error: {e}")
    
    def get_suggestions(self, word):
        """Get spell check suggestions - OPTIMIZED with caching"""
        if not word:
            return []
        
        # Check cache first
        if word in self.cache:
            return self.cache[word]
        
        suggestions = sorted(self.hs.candidates(word))[:3]
        
        # Cache result (limit cache size)
        if len(self.cache) > 100:
            self.cache.pop(next(iter(self.cache)))
        self.cache[word] = suggestions
        
        return suggestions
    
    def accept_suggestion(self, suggestion):
        """Accept a suggestion"""
        self.word = ""
        self.initialize_counters()  # Reset counters after accepting
        self.blank_flag = 0  # Reset blank flag
        if len(self.sentence) > 0:
            self.sentence += " "
        self.sentence += suggestion
    
    def clear_all(self):
        """Clear all text"""
        self.word = ""
        self.sentence = ""
        self.initialize_counters()
    
    def get_state(self):
        """Get current recognition state"""
        return {
            "current_symbol": self.current_symbol,
            "word": self.word,
            "sentence": self.sentence,
            "is_running": self.is_running,
            "suggestions": self.get_suggestions(self.word)
        }

# Initialize service
service = GestureRecognitionService()

# ==================== API ENDPOINTS ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "service": "Sign Language Recognition API",
        "camera_active": service.is_running
    })

@app.route('/api/camera/start', methods=['POST'])
def start_camera():
    """Start camera capture"""
    result = service.start_camera()
    return jsonify(result)

@app.route('/api/camera/stop', methods=['POST'])
def stop_camera():
    """Stop camera capture"""
    result = service.stop_camera()
    return jsonify(result)

@app.route('/api/camera/frame', methods=['GET'])
def get_frame():
    """Get current frame (returns base64 encoded image) - OPTIMIZED with compression"""
    frame, processed = service.get_frame()
    
    if frame is None:
        return jsonify({
            "status": "error",
            "message": "Could not capture frame"
        }), 400
    
    try:
        # Encode with compression (quality 70 for faster transmission)
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
        _, buffer = cv2.imencode('.jpg', frame, encode_param)
        frame_b64 = base64.b64encode(buffer).decode('utf-8')
        
        _, processed_buffer = cv2.imencode('.jpg', processed, encode_param)
        processed_b64 = base64.b64encode(processed_buffer).decode('utf-8')
        
        response = jsonify({
            "status": "success",
            "frame": frame_b64,
            "processed": processed_b64
        })
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/recognition/state', methods=['GET'])
def get_recognition_state():
    """Get current recognition state - OPTIMIZED combined response"""
    frame, processed = service.get_frame()
    
    if processed is not None:
        service.predict(processed)
    
    state = service.get_state()
    
    # Include frame in state response to reduce requests
    frame_data = None
    if frame is not None:
        try:
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 70]
            _, buffer = cv2.imencode('.jpg', frame, encode_param)
            frame_data = base64.b64encode(buffer).decode('utf-8')
        except:
            pass
    
    response_data = {
        "status": "success",
        "data": state
    }
    if frame_data:
        response_data["frame"] = frame_data
    
    return jsonify(response_data)

@app.route('/api/recognition/suggestions', methods=['GET'])
def get_suggestions():
    """Get spelling suggestions for current word"""
    word = request.args.get('word', '')
    suggestions = service.get_suggestions(word)
    return jsonify({
        "status": "success",
        "word": word,
        "suggestions": suggestions
    })

@app.route('/api/recognition/accept-suggestion', methods=['POST'])
def accept_suggestion():
    """Accept a spelling suggestion"""
    data = request.json
    suggestion = data.get('suggestion', '')
    
    if suggestion:
        service.accept_suggestion(suggestion)
        return jsonify({
            "status": "success",
            "data": service.get_state()
        })
    
    return jsonify({
        "status": "error",
        "message": "No suggestion provided"
    }), 400

@app.route('/api/recognition/clear', methods=['POST'])
def clear_recognition():
    """Clear all recognized text"""
    service.clear_all()
    return jsonify({
        "status": "success",
        "message": "All text cleared",
        "data": service.get_state()
    })

@app.route('/api/recognition/reset', methods=['POST'])
def reset():
    """Reset the service"""
    service.clear_all()
    if service.is_running:
        service.stop_camera()
    return jsonify({
        "status": "success",
        "message": "Service reset"
    })

@app.route('/api/recognition/delete-letter', methods=['POST'])
def delete_letter():
    """Delete the last letter from current word."""
    if len(service.word) > 0:
        service.word = service.word[:-1]
    return jsonify({
        "status": "success",
        "message": "Last letter deleted",
        "data": service.get_state()
    })

@app.route('/api/recognition/clear-word', methods=['POST'])
def clear_word():
    """Clear only the current in-progress word (not the full sentence)."""
    service.word = ""
    service.initialize_counters()
    service.blank_flag = 0  # Reset blank flag so next word starts fresh
    return jsonify({
        "status": "success",
        "message": "Current word cleared",
        "data": service.get_state()
    })


@app.route('/api/recognition/clear-sentence-word', methods=['POST'])
def clear_sentence_word():
    """Remove the last word from the committed sentence."""
    words = service.sentence.strip().split()
    if words:
        words.pop()
    service.sentence = " ".join(words)
    service.blank_flag = 0  # Reset blank flag
    return jsonify({
        "status": "success",
        "message": "Last sentence word removed",
        "data": service.get_state()
    })

@app.route('/api/recognition/send-sentence', methods=['POST'])
def send_sentence():
    """Send/finalize the current sentence and clear for next sentence."""
    result = {
        "status": "success",
        "message": "Sentence sent and cleared",
        "sentence": service.sentence,
        "data": {
            "current_symbol": "Empty",
            "word": "",
            "sentence": "",
            "suggestions": []
        }
    }
    # Clear for next sentence
    service.word = ""
    service.sentence = ""
    service.initialize_counters()
    service.blank_flag = 0
    return jsonify(result)

@app.route('/api/recognition/clear-current-sentence', methods=['POST'])
def clear_current_sentence():
    """Clear only the sentence, keep word intact."""
    service.sentence = ""
    service.blank_flag = 0
    return jsonify({
        "status": "success",
        "message": "Sentence cleared",
        "data": service.get_state()
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 Sign Language Recognition API Server (OPTIMIZED)")
    print("="*60)
    print("✓ Threading enabled for continuous frame capture")
    print("✓ Model predictions optimized with conditional specialization")
    print("✓ Frame compression enabled (JPEG quality 70)")
    print("✓ Suggestion caching implemented")
    print(f"✓ Server running at http://{BACKEND_HOST}:{BACKEND_PORT}")
    print("="*60 + "\n")
    
    # Run with optimized settings
    app.run(
        debug=DEBUG,
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        threaded=True,
        use_reloader=False  # Disable reloader to prevent double model loading
    )