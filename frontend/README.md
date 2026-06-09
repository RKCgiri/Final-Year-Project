# IshnaBridge — Sign Language to Regional Language Translator

A complete React + Vite + Tailwind CSS frontend for the IshnaBridge sign language translation platform.

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Build for Production

```bash
npm run build
```

---

## 📁 Project Structure

```
isnabridge/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx          # Sticky nav with language selector
│   │   └── Footer.jsx          # Footer with links & support info
│   ├── pages/
│   │   ├── HomePage.jsx        # Landing page (hero, how it works, languages, testimonials)
│   │   ├── TranslatorPage.jsx  # Live camera translator UI
│   │   ├── TutorialPage.jsx    # Learn signs / gesture dictionary
│   │   └── ContactPage.jsx     # Contact form & helpline info
│   ├── App.jsx                 # Router setup
│   ├── main.jsx                # Entry point
│   └── index.css               # Global styles + Tailwind
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 🔌 Backend Integration Guide

All backend connection points are marked with `// TODO: Connect to backend API endpoint` comments.

### 1. Live Sign Language Translation (TranslatorPage.jsx)

Replace the simulated effect with your actual model API:

```jsx
// In TranslatorPage.jsx — startCamera() function
// After camera stream is ready, send frames to your backend:

const sendFrameToBackend = async (imageBlob) => {
  const formData = new FormData()
  formData.append('frame', imageBlob)
  formData.append('language', selectedLang.code) // e.g. 'hi', 'ta', 'te'

  const res = await fetch('/api/translate', {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()
  // data = { text: 'नमस्ते', romanized: 'Namaste', confidence: 94 }
  setCurrentSign(data)
  setConfidence(data.confidence)
}
```

### 2. Contact Form Submission (ContactPage.jsx)

Replace the simulated delay with your API call:

```jsx
// In ContactPage.jsx — handleSubmit()
const response = await fetch('/api/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(form),
})
if (response.ok) setSent(true)
```

### 3. Language Selection API (TranslatorPage.jsx)

To fetch available languages dynamically:

```jsx
useEffect(() => {
  fetch('/api/languages')
    .then(r => r.json())
    .then(setOutputLanguages)
}, [])
```

### 4. Gesture Dictionary (TutorialPage.jsx)

To load gestures from your database:

```jsx
useEffect(() => {
  fetch('/api/gestures')
    .then(r => r.json())
    .then(setGestures)
}, [])
```

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Primary Green | `#00C853` |
| Dark Background | `#0A0F0D` |
| Card Background | `#111A14` |
| Display Font | Syne |
| Body Font | Plus Jakarta Sans |

---

## 📡 Expected API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/translate` | Send camera frame, get translation |
| GET | `/api/languages` | Get supported output languages |
| GET | `/api/gestures` | Get gesture dictionary |
| POST | `/api/contact` | Submit contact form |

---

## ✅ Features

- ✅ 4 fully designed pages (Home, Translator, Learn, Contact)
- ✅ Dark theme matching the original design
- ✅ Fully responsive (mobile, tablet, desktop)
- ✅ React Router v6 navigation
- ✅ Live camera API ready (navigator.mediaDevices)
- ✅ Simulated translation with confidence meter
- ✅ Language selector (8 Indian regional languages)
- ✅ Gesture dictionary with search & filter
- ✅ Contact form with validation
- ✅ Sticky navbar with mobile menu
- ✅ All backend hooks pre-wired with TODO comments
