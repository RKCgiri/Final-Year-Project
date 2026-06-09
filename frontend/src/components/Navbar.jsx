import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Globe, Accessibility, ChevronDown } from 'lucide-react'

const languages = ['Hindi (हिन्दी)', 'Tamil (தமிழ்)', 'Telugu (తెలుగు)', 'Bengali (বাংলা)', 'Marathi (मराठी)', 'Kannada (ಕನ್ನಡ)', 'Gujarati (ગુજરાતી)', 'Malayalam (മലയാളം)']

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const location = useLocation()

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Learn Signs', path: '/tutorial' },
    { label: 'Live Translator', path: '/translator' },
    { label: 'Contact Us', path: '/contact' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-dark-900/95 backdrop-blur-md border-b border-dark-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-green flex items-center justify-center">
              <span className="text-dark-900 font-display font-bold text-sm">IB</span>
            </div>
            <span className="font-display font-bold text-white text-lg">ishnaBridge</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`nav-link ${location.pathname === link.path ? 'text-brand-green' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-600 border border-dark-300 rounded-full text-xs text-gray-300 hover:border-brand-green transition-colors"
              >
                <Globe size={13} />
                <span>Selected (हिंदी)</span>
                <ChevronDown size={12} className={`transition-transform ${langOpen ? 'rotate-180' : ''}`} />
              </button>
              {langOpen && (
                <div className="absolute right-0 top-10 w-52 bg-dark-700 border border-dark-300 rounded-xl shadow-2xl overflow-hidden z-50">
                  {languages.map(lang => (
                    <button
                      key={lang}
                      onClick={() => setLangOpen(false)}
                      className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-dark-500 hover:text-brand-green transition-colors"
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>

            
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-600 border border-dark-300 rounded-full text-xs text-gray-300 hover:border-brand-green transition-colors">
              <Accessibility size={13} />
              <span>Options</span>
            </button>
          </div>

          
          <button
            className="md:hidden p-2 text-gray-400 hover:text-brand-green"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>


{/* mobile */}
      {mobileOpen && (
        <div className="md:hidden bg-dark-800 border-t border-dark-300 px-4 py-4 flex flex-col gap-3">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileOpen(false)}
              className={`text-sm font-medium py-2 border-b border-dark-300 ${location.pathname === link.path ? 'text-brand-green' : 'text-gray-300'}`}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <Globe size={14} className="text-gray-400" />
            <span className="text-xs text-gray-400">Selected (हिंदी)</span>
          </div>
        </div>
      )}
    </nav>
  )
}
