import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { KeyRound, ArrowRight, AlertTriangle } from 'lucide-react'

export function OTPVerify() {
  const [otp, setOtp] = useState('')
  const { pendingPhone, verifyOtp, authError } = useAuth()

  const handleSubmit = (e) => {
    e.preventDefault()
    verifyOtp(otp)
  }

  return (
    <div className="glass-card" style={{ marginTop: '40px', padding: '30px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(168, 85, 247, 0.15)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0 auto 16px'
        }}>
          <KeyRound size={28} color="#c084fc" />
        </div>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.6rem', fontWeight: '700', marginBottom: '6px' }}>
          Verify OTP
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Code sent to <strong>{pendingPhone}</strong>
        </p>
      </div>

      {authError && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '12px',
          color: '#ef4444',
          fontSize: '0.8rem',
          fontWeight: '600',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={18} />
          <span>{authError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Enter 6-digit OTP..."
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            required
            style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', fontWeight: '700' }}
          />
        </div>

        <button type="submit" className="btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          Verify & Sign In <ArrowRight size={18} />
        </button>
      </form>
    </div>
  )
}
