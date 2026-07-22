import React from 'react'
import { useAuth } from '../../context/AuthContext'
import { ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react'

export function AdminProfileTab({ user }) {
  const { logout } = useAuth()

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: '800', marginBottom: '4px', color: '#f59e0b' }}>
          System Admin Profile
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Innaikku AI Platform Administration Console
        </p>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <ShieldAlert size={28} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '2px' }}>{user?.name || 'System Admin'}</h3>
            <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: '700' }}>Phone: {user?.phone}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} /> Verified Platform Administrator
          </span>
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
        <LogOut size={18} /> Sign Out of Admin Account
      </button>
    </div>
  )
}
