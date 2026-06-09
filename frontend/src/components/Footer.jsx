
import { Phone, Globe } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-dark-800 border-t border-dark-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand-green flex items-center justify-center">
                <span className="text-dark-900 font-display font-bold text-sm">IB</span>
              </div>
              <span className="font-display font-bold text-white text-lg">ishnaBridge</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Bridging the gap between the deaf community and regional India. Easy sign language translations for everyday conversations.
            </p>
            <div className="flex items-center gap-3">
              <button className="btn-primary text-xs px-3 py-1.5">Made for India</button>
              <span className="text-xs font-mono">100% Free</span>
            </div>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">EXPLORE</h4>
            <ul className="space-y-2.5">
              {['Home & Overview', 'Gesture Dictionary', 'Live Translation Browser', 'How to Use Guide'].map(item => (
                <li key={item}>
                  <a href="#" className="text-xs text-gray-400 hover:text-brand-green transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">LANGUAGES SUPPORTED</h4>
            <ul className="space-y-2 grid grid-cols-2 gap-x-4">
              {[
                'Hindi (हिन्दी)', 'Tamil (தமிழ்)', 'Telugu (తెలుగు)',
                'Bengali (বাংলা)', 'Marathi (मराठी)', 'Kannada (ಕನ್ನಡ)',
                'Gujarati (ગુજ.)', 'Malayalam (മല.)'
              ].map(lang => (
                <li key={lang}>
                  <span className="text-xs text-gray-400">{lang}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Emergency Support */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Emergency Support</h4>
            <p className="text-xs text-gray-500 mb-3">Local support services available in regional languages from accessibility experts.</p>
            <div className="flex items-center gap-2 mb-2">
              <Phone size={13} className="text-brand-green" />
              <a href="tel:9830162110" className="text-xs text-brand-green font-mono hover:underline">+91-9830162110</a>
            </div>
            <div className="flex items-center gap-2">
              <Globe size={13} className="text-gray-400" />
              <span className="text-xs text-gray-400">Available Mon–Sun, 10 AM – 6 PM</span>
            </div>
          </div>
        </div>

        <div className="border-t border-dark-300 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2025 IshnaBridge. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-xs text-gray-500 hover:text-gray-300">Privacy Policy</a>
            <a href="#" className="text-xs text-gray-500 hover:text-gray-300">Terms of Service</a>
            
          </div>
        </div>
      </div>
    </footer>
  )
}
