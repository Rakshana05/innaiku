import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { DealsDashboard } from '../dashboard/DealsDashboard'
import { VendorOverview } from '../dashboard/VendorOverview'
import { AdminDashboard } from '../admin/AdminDashboard'
import { AIVoicePage } from '../voice/AIVoicePage'
import { WishlistTab } from '../wishlist/WishlistTab'
import { VendorProductsTab } from '../vendor/VendorProductsTab'
import { CustomerProfileTab } from '../profile/CustomerProfileTab'
import { VendorProfileTab } from '../profile/VendorProfileTab'
import { AdminProfileTab } from '../profile/AdminProfileTab'
import { Home, Mic, Heart, Package, User, Flame, Users } from 'lucide-react'

export function AppLayout() {
  const { user, loginAsDemoRole } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard', 'voice', 'items', 'profile', 'users'

  const role = user?.role || 'customer'
  const isAdmin = role === 'admin'
  const isVendor = role === 'vendor'

  // Automatically reset tab if changing roles and current tab is invalid for that role
  useEffect(() => {
    if (isAdmin && activeTab === 'voice') {
      setActiveTab('dashboard')
    } else if (!isAdmin && activeTab === 'users') {
      setActiveTab('dashboard')
    }
  }, [role, isAdmin, activeTab])

  return (
    <div className="mobile-app-shell">
      <div className="background-glow glow-left"></div>
      <div className="background-glow glow-right"></div>

      {/* Top App Header */}
      <header className="app-header">
        <div>
          <h1 className="app-logo">Innaikku AI</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Regional Deals Portal</p>
        </div>

        {/* Demo Role Switcher Dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={role + (isVendor ? (user.is_approved ? '_approved' : '_pending') : '')}
            onChange={(e) => {
              const val = e.target.value
              if (val === 'admin') loginAsDemoRole('admin')
              else if (val === 'customer') loginAsDemoRole('customer')
              else if (val === 'vendor_approved') loginAsDemoRole('vendor_approved')
              else if (val === 'vendor_pending') loginAsDemoRole('vendor_pending')
            }}
            style={{
              background: isAdmin ? 'rgba(245, 158, 11, 0.15)' : isVendor ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.12)',
              border: '1px solid',
              borderColor: isAdmin ? '#f59e0b' : isVendor ? '#a855f7' : '#6366f1',
              color: isAdmin ? '#f59e0b' : isVendor ? '#c084fc' : '#c7d2fe',
              padding: '6px 10px',
              borderRadius: '12px',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'Outfit',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none',
              textAlign: 'center'
            }}
          >
            <option value="customer" style={{ background: '#13112b', color: '#c7d2fe' }}>🙋‍♂️ Customer</option>
            <option value="vendor_approved" style={{ background: '#13112b', color: '#c084fc' }}>🏪 Vendor (Approved)</option>
            <option value="vendor_pending" style={{ background: '#13112b', color: '#c084fc' }}>⏳ Vendor (Pending)</option>
            <option value="admin" style={{ background: '#13112b', color: '#f59e0b' }}>👑 Admin</option>
          </select>
        </div>
      </header>

      {/* Main Screen Content Based on Active Tab */}
      <main className="app-content">
        {activeTab === 'dashboard' && (
          isAdmin ? <AdminDashboard user={user} activeSubTab="dashboard" /> : isVendor ? <VendorOverview user={user} /> : <DealsDashboard user={user} />
        )}

        {activeTab === 'voice' && !isAdmin && (
          <AIVoicePage user={user} />
        )}

        {activeTab === 'users' && isAdmin && (
          <AdminDashboard user={user} activeSubTab="users" />
        )}

        {activeTab === 'items' && (
          isAdmin ? <AdminDashboard user={user} activeSubTab="catalog" /> : isVendor ? <VendorProductsTab user={user} /> : <WishlistTab user={user} />
        )}

        {activeTab === 'profile' && (
          isAdmin ? <AdminProfileTab user={user} /> : isVendor ? <VendorProfileTab user={user} /> : <CustomerProfileTab user={user} />
        )}
      </main>

      {/* Bottom Mobile Navigation Bar */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <Home />
          <span>Dashboard</span>
        </button>

        {!isAdmin ? (
          <button
            className={`nav-item voice-tab ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            <Mic />
            <span>AI Voice</span>
          </button>
        ) : (
          <button
            className={`nav-item ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            <Flame />
            <span>Demand</span>
          </button>
        )}

        {!isAdmin ? (
          <button
            className={`nav-item ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            {isVendor ? <Package /> : <Heart />}
            <span>{isVendor ? 'Products' : 'Wishlist'}</span>
          </button>
        ) : (
          <button
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users />
            <span>Users</span>
          </button>
        )}

        <button
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User />
          <span>Profile</span>
        </button>
      </nav>
    </div>
  )
}
