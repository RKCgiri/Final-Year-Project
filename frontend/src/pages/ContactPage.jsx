import { useState } from 'react'
import { Phone, Mail, MapPin, Send, CheckCircle } from 'lucide-react'

const centerLocations = [
  { city: 'Kalyani Center', desc: 'Support in Bengali & English. Open daily 10 AM to 6 PM.', address: 'Gayeshpur, Kalyani, West Bengal' },
  { city: 'AdiSaptagram Center', desc: 'Support in Hindi & English. Open daily 10 AM to 6 PM.', address: 'Academy of Technology, Adisaptagram, Hooghly' },
]

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    number: '',
    message: '',
    community: false,
    ageBridge: false,
    deafCoordinator: false,
  })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    // TODO: Connect to backend API endpoint
    // const response = await fetch('/api/contact', { method: 'POST', body: JSON.stringify(form) })
    await new Promise(r => setTimeout(r, 1500))
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        
        <div className="text-center mb-12">
          <div className="section-tag">We're Here to Help You Connect</div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            We're Here to Help You Connect
          </h1>
          <p className="text-gray-400 text-sm max-w-2xl mx-auto">
            Have questions about IshnaBridge? Want to add your regional language or partner with your local school? Send us a quick message below or call our free helpline!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

          
          <div className="lg:col-span-2 flex flex-col gap-5">
            <h2 className="font-display font-bold text-white text-xl">Direct Support & Helplines</h2>
            <p className="text-gray-500 text-sm -mt-2">Our Indian Sign Language experts are available to assist you in real time over call or phone.</p>

            {/* Phone */}
            <div className="card-dark rounded-2xl p-5 border-l-4 border-brand-green hover:border-brand-green/80 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-green/10 border border-brand-green/20 flex items-center justify-center shrink-0">
                  <Phone size={18} className="text-brand-green" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Toll-Free National Helpline</h3>
                  <p className="text-xs text-gray-500 mt-0.5 mb-2">Support in Hindi, Tamil, Telugu, Bengali, and more</p>
                  <a href="tel:1800-345-6HA" className="font-mono text-brand-green text-lg font-bold hover:underline">
                    +91-9830162110
                  </a>
                </div>
              </div>
            </div>

            
            

            {/* Email */}
            <div className="card-dark rounded-2xl p-5 border-l-4 border-purple-500 hover:border-purple-500/80 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <Mail size={18} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Email/Support Desk</h3>
                  <p className="text-xs text-gray-500 mt-0.5 mb-1">We reply to enquiries within 24 hours</p>
                  <a href="mailto:support@isnabridge.in" className="text-xs text-purple-400 hover:underline font-mono">support@mail.in</a>
                </div>
              </div>
            </div>

            {/* Our Center Locations */}
            <div>
              <h3 className="font-display font-bold text-white mb-3 text-base">Our Center Locations</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {centerLocations.map((c, i) => (
                  <div key={i} className="card-dark rounded-xl p-4 hover:border-brand-green/30 transition-colors">
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-brand-green shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-white">{c.city}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{c.desc}</p>
                        <p className="text-xs text-gray-600 mt-1 font-mono">{c.address}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Contact Form */}
          <div className="lg:col-span-3">
            <div className="card-dark rounded-3xl p-6 sm:p-8">
              <h2 className="font-display font-bold text-white text-xl mb-1">Send Us a Message</h2>
              <p className="text-gray-500 text-sm mb-6">
                Let us know how we can make IshnaBridge even more useful for you or your community.
              </p>

              {sent ? (
                <div className="text-center py-16">
                  <CheckCircle size={56} className="text-brand-green mx-auto mb-4" />
                  <h3 className="font-display text-2xl font-bold text-white mb-2">Message Sent!</h3>
                  <p className="text-gray-400 text-sm">Thank you for reaching out. Our team will respond within 24 hours.</p>
                  <button
                    onClick={() => { setSent(false); setForm({ name: '', email: '', mobile: '', number: '', message: '', community: false, ageBridge: false, deafCoordinator: false }) }}
                    className="btn-outline mt-6"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Your Name</label>
                      <input
                        name="name"
                        type="text"
                        placeholder="e.g. Sudipta Giri"
                        className="input-dark"
                        value={form.name}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Your Mobile Number</label>
                      <input
                        name="mobile"
                        type="tel"
                        placeholder="e.g. +91-95740 -01710"
                        className="input-dark"
                        value={form.mobile}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Your Email</label>
                      <input
                        name="email"
                        type="email"
                        placeholder="e.g. sudipta@gmail.com"
                        className="input-dark"
                        value={form.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">How can we help you?</label>
                    <textarea
                      name="message"
                      rows={4}
                      placeholder="Write your message here..."
                      className="input-dark resize-none"
                      value={form.message}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-2">I represent as:</p>
                    <div className="flex flex-wrap gap-3">
                      {[
                        
                        { field: 'ageBridge', label: 'Age Bridge' },
                        { field: 'deafCoordinator', label: 'Deaf Co-ordinator' },
                      ].map(opt => (
                        <label key={opt.field} className="flex items-center gap-2 cursor-pointer">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${form[opt.field] ? 'bg-brand-green border-brand-green' : 'border-dark-300 bg-dark-600'}`}
                            onClick={() => setForm(f => ({ ...f, [opt.field]: !f[opt.field] }))}
                          >
                            {form[opt.field] && <CheckCircle size={10} className="text-dark-900" />}
                          </div>
                          <span className="text-xs text-gray-400">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-gray-600">
                    By submitting, you agree to our community guidelines and privacy policy
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full justify-center py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-dark-900 border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send Message Publicly
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
