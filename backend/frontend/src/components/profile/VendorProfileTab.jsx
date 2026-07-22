import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getSupabase } from '../../services/supabase'
import { Store, MapPin, CheckCircle2, LogOut, Edit3, AlertCircle, FileText } from 'lucide-react'

export function VendorProfileTab({ user }) {
  const { logout } = useAuth()
  const [shop, setShop] = useState(null)
  const [name, setName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [location, setLocation] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    async function loadShop() {
      const supabase = await getSupabase()
      if (!supabase || !user) return

      const { data } = await supabase.from('shops').select('*').eq('owner_id', user.id).single()
      if (data) {
        setShop(data)
        setName(data.name || '')
        setOwnerName(data.owner_name || '')
        setLocation(data.location || '')
      }
    }
    loadShop()
  }, [user])

  const handleUpdateShop = async (e) => {
    e.preventDefault()
    if (shop && !shop.is_approved) return
    const supabase = await getSupabase()
    if (!supabase || !user) return

    const { data, error } = await supabase
      .from('shops')
      .update({
        name: name,
        owner_name: ownerName,
        location: location
      })
      .eq('owner_id', user.id)
      .select()

    if (!error && data) {
      setShop(data[0])
      setSavedMsg('Shop details updated successfully!')
      setTimeout(() => setSavedMsg(''), 3000)
    }
  }

  const isApproved = shop?.is_approved

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: '800', marginBottom: '4px' }}>
          Vendor Shop Profile
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Manage physical store details and address in Hosur
        </p>
      </div>

      {/* Shop Info Badge */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: isApproved ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'rgba(245, 158, 11, 0.15)',
            border: isApproved ? 'none' : '1px solid #f59e0b',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Store size={26} color={isApproved ? '#fff' : '#f59e0b'} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '2px' }}>{shop?.name || user?.shopName || 'Vendor Shop'}</h3>
            {isApproved ? (
              <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Verified & Admin Approved
              </span>
            ) : (
              <span style={{ fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={14} /> Pending Admin Approval
              </span>
            )}
          </div>
        </div>

        {/* Read-Only Details for Both Pending & Approved Vendors */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Shop Name</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f8fafc' }}>{shop?.name || user?.shopName || 'Pending Registration'}</span>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Owner Name</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f8fafc' }}>{shop?.owner_name || user?.name || 'Pending Owner'}</span>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Store Address</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f8fafc' }}>{shop?.location || user?.location || 'Hosur'}</span>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '2px' }}>Verified Contact Phone</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#10b981' }}>{shop?.phone || user?.phone}</span>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Uploaded Verification Proof Document</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(168, 85, 247, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
              <FileText size={18} color="#c084fc" />
              <a href={shop?.document_url || user?.documentUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop'} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#a5b4fc', textDecoration: 'underline', fontWeight: '700' }}>
                Open Document Link ↗
              </a>
            </div>
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
