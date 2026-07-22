import React, { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '../../services/supabase'
import { Store, Package, Tag, Users } from 'lucide-react'

export function VendorOverview({ user }) {
  const [shop, setShop] = useState(null)
  const [itemCount, setItemCount] = useState(0)
  const [activeOfferCount, setActiveOfferCount] = useState(0)
  const [demandList, setDemandList] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchVendorData = useCallback(async () => {
    setLoading(true)
    const supabase = await getSupabase()
    if (!supabase || !user) return

    // 1. Fetch vendor shop
    const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', user.id).single()
    setShop(shopData)

    if (shopData) {
      // 2. Fetch inventory items
      const { data: items } = await supabase.from('items').select('*, offers(*)').eq('shop_id', shopData.id)
      setItemCount(items ? items.length : 0)
      
      let liveOffers = 0
      if (items) {
        items.forEach(i => {
          if (i.offers && i.offers.discount_pct) liveOffers++
        })
      }
      setActiveOfferCount(liveOffers)

      // 3. Fetch demand statistics
      const { data: demand } = await supabase.from('item_wishlist_counts').select('*').eq('shop_id', shopData.id)
      setDemandList(demand || [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchVendorData()
  }, [fetchVendorData])

  const isApproved = shop?.is_approved

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: '800', marginBottom: '4px' }}>
          Vendor Shop Overview
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {shop ? `${shop.name} • ${shop.location}` : 'Managing Hosur Store'}
        </p>
      </div>

      {!isApproved ? (
        <div className="glass-card" style={{ border: '1px solid var(--accent-warning)', padding: '24px 16px', textAlign: 'center' }}>
          <Store size={48} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f59e0b', marginBottom: '8px' }}>Store Pending Approval</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Your business registration is currently under review by our administration team.
            You will gain access to catalog management, active promotions, and customer demand statistics as soon as your account is approved.
          </p>
          <div style={{ marginTop: '16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '10px', borderRadius: '8px', fontSize: '0.78rem', color: '#f59e0b' }}>
            ⏳ Status: Waiting for Admin Review
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div className="glass-card" style={{ marginBottom: 0, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', marginBottom: '6px' }}>
                <Package size={20} />
                <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>Catalog Items</span>
              </div>
              <span style={{ fontSize: '1.6rem', fontWeight: '800' }}>{itemCount}</span>
            </div>

            <div className="glass-card" style={{ marginBottom: 0, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c084fc', marginBottom: '6px' }}>
                <Tag size={20} />
                <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>Active Offers</span>
              </div>
              <span style={{ fontSize: '1.6rem', fontWeight: '800' }}>{activeOfferCount}</span>
            </div>
          </div>

          {/* Demand Analytics */}
          <div className="glass-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', color: '#f8fafc' }}>
              <Users size={18} color="#10b981" /> Wishlist Demand Analytics
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '12px' }}>
              Real-time count of Hosur customers interested in your items
            </p>

            {loading ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading demand...</div>
            ) : demandList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {demandList.map(d => (
                  <div key={d.item_id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{d.item_name}</span>
                    <span className="badge-discount" style={{ background: d.wishlist_count > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: d.wishlist_count > 0 ? '#10b981' : '#94a3b8' }}>
                      {d.wishlist_count} interested
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No customer demand registered yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
