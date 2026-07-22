import React from 'react'
import { useAuth } from '../../context/AuthContext'
import { User, Globe, MapPin, Bell, LogOut, CheckCircle2 } from 'lucide-react'

export function CustomerProfileTab({ user }) {
  const { logout } = useAuth()

  const getLangLabel = (code) => {
    if (code === 'ta') return 'Tamil (தமிழ்)'
    if (code === 'te') return 'Telugu (తెలుగు)'
    return 'English'
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: '800', marginBottom: '4px' }}>
          Customer Profile
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Your preferences and personal settings
        </p>
      </div>

      {/* User Info Card */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '1.4rem',
            fontWeight: '800',
            color: '#fff'
          }}>
            {(user?.name || 'C').charAt(0)}
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '2px' }}>{user?.name || 'Customer'}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.phone}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
            <Globe size={18} color="#818cf8" />
            <span>Voice Language: <strong>{getLangLabel(user?.lang)}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
            <MapPin size={18} color="#f59e0b" />
            <span>Location: <strong>{user?.location || 'Hosur'}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
            <Bell size={18} color="#10b981" />
            <span>Local Deal Notifications: <strong style={{ color: '#10b981' }}>Enabled</strong></span>
          </div>
        </div>
      </div>

      <button
        className="btn-secondary"
        onClick={logout}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(239, 68, 68, 0.1)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          padding: '14px',
          fontWeight: '700'
        }}
      >
        <LogOut size={18} /> Sign Out of Account
      </button>
    </div>
  )
}
