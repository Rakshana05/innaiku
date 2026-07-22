import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Smartphone, ArrowRight } from 'lucide-react'

export function PhoneAuth() {
  const [phone, setPhone] = useState('')
  const { startPhoneAuth, loginAsDemoRole } = useAuth()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!phone || phone.length < 5) return
    startPhoneAuth(phone)
  }

  return (
    <div className="glass-card" style={{ marginTop: '40px', padding: '30px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0 auto 16px'
        }}>
          <Smartphone size={28} color="#a5b4fc" />
        </div>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.6rem', fontWeight: '700', marginBottom: '6px' }}>
          Innaikku AI Mobile Sign-In
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Enter your mobile phone number to sign in or register
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Mobile Phone Number
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="tel"
              className="input-field"
              placeholder="Enter mobile phone number..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              style={{ marginBottom: 0 }}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          Continue with OTP <ArrowRight size={18} />
        </button>
      </form>

      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => loginAsDemoRole('customer')}
          className="btn-secondary"
          style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.15)', borderColor: '#6366f1', color: '#a5b4fc', fontWeight: '700' }}
        >
          🔑 Quick Demo Sign-In
        </button>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
          Instantly login and toggle between any role from the top-right dropdown.
        </span>
      </div>
    </div>
  )
}
