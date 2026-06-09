import { Link } from 'react-router-dom'
import { Camera, BookOpen, ChevronRight, Star, Globe, Mic, Zap, Users, Heart, ArrowRight, Volume2 } from 'lucide-react'
import { useState, useEffect } from 'react'

const languages = [
  { name: 'Hindi', native: 'हिन्दी', flag: '💿', speakers: '530M speakers' },
  { name: 'Tamil', native: 'தமிழ்', flag: '💿', speakers: 'Official language of Tamil Nadu' },
  { name: 'Telugu', native: 'తెలుగు', flag: '💿', speakers: 'Widely spoken in Andhra' },
  { name: 'Marathi', native: 'मराठी', flag: '💿', speakers: 'Official language of Maharashtra' },
  { name: 'Bengali', native: 'বাংলা', flag: '💿', speakers: 'Official language of West Bengal' },
  { name: 'Kannada', native: 'ಕನ್ನಡ', flag: '💿', speakers: 'Official language of Karnataka' },
  { name: 'Gujarati', native: 'ગુજરાતી', flag: '💿', speakers: 'Official language of Gujarat' },
  { name: 'Malayalam', native: 'മലയാളം', flag: '💿', speakers: 'Official language of Kerala' },
]

const testimonials = [
  {
    stars: 5,
    text: '"lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."',
    name: 'Gourab Das Gupta',
    location: 'Blind Child, Kolkata, West Bengal',
  },
  {
    stars: 5,
    text: '"lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."',
    name: 'Sudipta Giri',
    location: 'Deaf Child, Kolkata, West Bengal',
  },
]


const steps = [
  {
    num: '1',
    title: 'Select Your Regional Language',
    desc: 'Choose from Hindi, Marathi, Tamil, Bengali, Telugu, Kannada, and more. Select the language best at home. Select from Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, and more.',
    cta: 'Tamil (தமிழ்)',
    color: 'bg-brand-green',
  },
  {
    num: '2',
    title: 'Show Signs to Your Camera',
    desc: 'Show your Indian Sign Language (ISL) gestures to the camera. Our advanced system captures standard Indian Sign Language hand signals faithfully for you.',
    cta: 'Ready ✓',
    color: 'bg-orange-500',
  },
  {
    num: '3',
    title: 'Listen & Read Translation',
    desc: 'Hear the translated text in your regional word and have the translation displayed neatly, and obtain larger meanings on screen.',
    cta: 'Listen (Read) & Translate →',
    color: 'bg-purple-500',
  },
]

export default function HomePage() {
  const [currentTranslation, setCurrentTranslation] = useState('नमस्ते आप कैसे हैं?')

  useEffect(() => {
    const translations = [
      'नमस्ते आप कैसे हैं?',
      'வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?',
      'నమస్కారం, మీరు ఎలా ఉన్నారు?',
      'হ্যালো, আপনি কেমন আছেন?',
    ]
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % translations.length
      setCurrentTranslation(translations[i])
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center bg-grid-pattern bg-grid">
        {/* Radial glow */}
        <div className="absolute inset-0 bg-radial-green pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-brand-green/5 blur-3xl pointer-events-none" />

        {/* Marquee Banner */}
        <div className="absolute top-0 left-0 right-0 bg-dark-700 border-b border-dark-300 py-2 overflow-hidden">
          <div className="flex gap-8 animate-pulse-slow">
            <span className="text-xs text-gray-200 whitespace-nowrap px-4">
            IshnaBridge now supports 10+ regional Indian Languages —  Hindi •  Tamil  • Telugu  •  Bengali • Marathi  •  Kannada  •  Gujarati  •  Malayalam  •  more coming soon
            </span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="animate-fadeInUp">
            <div className="section-tag mb-2">Sign Language Translator</div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
              Convert Sign Language into{' '}
              <span className="text-gradient">Your Own Regional Language</span>
            </h1>
            <p className="text-gray-400 text-base leading-relaxed mb-8 max-w-lg">
              IshnaBridge makes it simple for relatives, colleagues, and friends to communicate with deaf individuals. Show your sign on camera, and hear the speech instantly in Hindi, Tamil, Telugu, and more.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Link to="/translator" className="btn-primary">
                <Camera size={16} />
                Try Live Translator
              </Link>
              <Link to="/learn" className="btn-outline">
                <BookOpen size={16} />
                Learn Sign Language (Tutorial)
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>No Sign-up Required</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>Includes Audio Speech</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>Designed for Deaf People</span>
            </div>
          </div>

          {/* Right — Live Demo Preview */}
          <div className="relative animate-fadeInUp" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
            <div className="card-dark rounded-3xl overflow-hidden">
              {/* Camera feed mockup */}
              <div className="camera-feed h-52 relative flex items-center justify-center">
                <div className="scan-line" />
                <div className="text-center z-10 relative">
                  <div className="w-16 h-16 rounded-full border-2 border-brand-green/50 flex items-center justify-center mx-auto mb-2">
                    <Camera size={28} className="text-brand-green" />
                  </div>
                  <p className="text-xs text-gray-500">Camera feed appears here</p>
                </div>
                {/* Corner brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-brand-green rounded-tl" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-brand-green rounded-tr" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-brand-green rounded-bl" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-brand-green rounded-br" />
                {/* Live badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-red-500/20 border border-red-500/40 rounded px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-400 font-mono">LIVE</span>
                </div>
              </div>

              {/* Output */}
              <div className="p-4 border-t border-dark-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 font-mono">HINDI OUTPUT (हिंदी)</span>
                  <Volume2 size={14} className="text-brand-green cursor-pointer hover:text-brand-green-light" />
                </div>
                <p className="text-xl font-display font-bold text-white transition-all duration-500">{currentTranslation}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-dark-500 rounded-full overflow-hidden">
                    <div className="confidence-bar h-full rounded-full" style={{ width: '87%' }} />
                  </div>
                  <span className="text-xs text-gray-500 font-mono">87%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Translating — "Software: How are you?" — ✓</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How Does It Work */}
      <section className="py-20 bg-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-3">How does it work?</h2>
            <p className="text-gray-400 text-sm">Designed specifically to be as simple as washing hands. No complex technology skills required!</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="card-dark p-6 relative group hover:border-brand-green/30 transition-colors duration-300">
                <div className={`w-8 h-8 ${step.color} rounded-lg flex items-center justify-center font-bold text-white text-sm mb-5`}>
                  {step.num}
                </div>
                <h3 className="font-display font-bold text-white text-lg mb-3">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-5">{step.desc}</p>
                <button className="text-brand-green text-xs font-medium hover:underline flex items-center gap-1">
                  {step.cta} <ChevronRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages Supported */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-4">
            <div>
              <div className="section-tag">Languages</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
                Supported Indian Regional Languages
              </h2>
              <p className="text-gray-400 text-sm mt-2">Bringing families together across different states. We support major native Indian dialects.</p>
            </div>
            <button className="btn-outline text-xs whitespace-nowrap self-start sm:self-auto">
              <Globe size={13} />
              Suggest Another Language
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {languages.map((lang, i) => (
              <div
                key={i}
                className="card-dark p-5 hover:border-brand-green/40 transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
              >
                <div className="text-2xl mb-2">{lang.flag}</div>
                <h3 className="font-display font-bold text-white text-base">{lang.name}</h3>
                <p className="text-brand-green font-mono text-xs">{lang.native}</p>
                <p className="text-gray-500 text-xs mt-1">{lang.speakers}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="section-tag">True Stories</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">Connecting Hearts Across India</h2>
            <p className="text-gray-400 text-sm mt-2">Real stories from people using IshnaBridge to help India's amazing communities.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="card-dark p-6 hover:border-brand-green/30 transition-colors">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_, si) => (
                    <Star key={si} size={14} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed italic mb-5">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-dark-500 border border-dark-300 flex items-center justify-center">
                    <Users size={16} className="text-gray-400" />
                  </div>
                  
                  <div>
                    <p className="text-white font-medium text-sm">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.location}</p>
                   </div>
                  
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-green pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="section-tag">Start Now</div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">
            Ready to communicate without boundaries?
          </h2>
          <p className="text-gray-400 text-base mb-8">
            It requires no subscription, no credit card, and absolutely no training. Open the live camera and let IshnaBridge translate.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/translator" className="btn-primary text-base px-8 py-3">
              <Camera size={18} />
              Open Live Translator
            </Link>
            <Link to="/learn" className="btn-outline text-base px-8 py-3">
              <BookOpen size={18} />
              Read Quick Tutorial
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
