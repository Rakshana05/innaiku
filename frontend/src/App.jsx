import React from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PhoneAuth } from './components/auth/PhoneAuth'
import { OTPVerify } from './components/auth/OTPVerify'
import { AccountSetup } from './components/auth/AccountSetup'
import { AppLayout } from './components/layout/AppLayout'

function MainApp() {
  const { authState } = useAuth()

  if (authState === 'LOADING') {
    return (
      <div className="mobile-app-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading Innaikku AI...</div>
      </div>
    )
  }

  if (authState === 'PHONE') {
    return (
      <div className="mobile-app-shell">
        <div className="app-content">
          <PhoneAuth />
        </div>
      </div>
    )
  }

  if (authState === 'OTP') {
    return (
      <div className="mobile-app-shell">
        <div className="app-content">
          <OTPVerify />
        </div>
      </div>
    )
  }

  if (authState === 'SETUP') {
    return (
      <div className="mobile-app-shell">
        <div className="app-content">
          <AccountSetup />
        </div>
      </div>
    )
  }

  return <AppLayout />
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}
