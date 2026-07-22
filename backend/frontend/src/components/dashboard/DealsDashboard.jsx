import React, { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '../../services/supabase'
import { Tag, Sparkles, Plus, Store, Check, AlertTriangle, Clock } from 'lucide-react'

export function DealsDashboard({ user }) {
  const [allItems, setAllItems] = useState([])
  const [activeTab, setActiveTab] = useState('all') // 'all' (All Products), 'offers' (Today's Offers)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [wishlistAddedMap, setWishlistAddedMap] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    const supabase = await getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    try {
      // 1. Fetch all items with their associated shops
      const { data: itemsData, error: itemsErr } = await supabase
        .from('items')
        .select('*, shops(*)')
      
      // 2. Fetch all offers
      const { data: offersData, error: offersErr } = await supabase
        .from('offers')
        .select('*')

      if (itemsErr || offersErr) {
        console.error('Error fetching dashboard catalog data:', itemsErr, offersErr)
      }

      // Map offers by item_id
      const offersMap = {}
      if (offersData) {
        offersData.forEach(o => {
          offersMap[o.item_id] = o
        })
      }

      const now = new Date()

      // Process all items and join with their offers
      const processedItems = (itemsData || []).map(item => {
        const offer = offersMap[item.id]
        let discountPct = null
        let salePrice = null
        let offerDescription = null
        let hasOffer = false
        let isExpired = false

        if (offer) {
          hasOffer = true
          discountPct = parseFloat(offer.discount_pct)
          salePrice = parseFloat(offer.sale_price)
          offerDescription = offer.description

          // Check expiration
          if (offer.end_time) {
            const end = new Date(offer.end_time)
            isExpired = end < now
          }
        }

        return {
          id: item.id,
          name: item.name,
          category: item.category,
          price: parseFloat(item.price),
          shop_id: item.shop_id,
          shop_name: item.shops?.name || 'Local Store',
          location: item.shops?.location || 'Hosur',
          hasOffer,
          isExpired,
          discount_pct: discountPct,
          sale_price: salePrice,
          description: offerDescription
        }
      })

      setAllItems(processedItems)

      // Check existing wishlist items for current customer
      if (user && user.id) {
        const { data: wList } = await supabase
          .from('wishlists')
          .select('item_id')
          .eq('customer_id', user.id)
        if (wList) {
          const map = {}
          wList.forEach(w => { map[w.item_id] = true })
          setWishlistAddedMap(map)
        }
      }
    } catch (err) {
      console.error('Error in customer dashboard fetch:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handleAddToWishlist = async (itemId, itemName) => {
    if (!user || !user.id) return
    const supabase = await getSupabase()
    if (!supabase) return

    const { data, error } = await supabase.from('wishlists').insert({
      customer_id: user.id,
      item_id: itemId
    }).select()

    if (!error && data) {
      setWishlistAddedMap(prev => ({ ...prev, [itemId]: true }))
    } else {
      console.error('Error adding to wishlist:', error)
    }
  }

  // Filter items based on Category and Search Query
  const filteredBase = allItems.filter(item => {
    const matchesCat = categoryFilter === 'All' || (item.category || '').toLowerCase() === categoryFilter.toLowerCase()
    const matchesSearch = !searchQuery || 
      (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.shop_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  // Tab 1: All Products (Expired offers display as normal base-price items with no expired tags)
  const allTabItems = filteredBase.map(item => {
    if (item.isExpired) {
      return {
        ...item,
        hasOffer: false,
        isExpired: false,
        discount_pct: null,
        sale_price: null,
        description: null
      }
    }
    return item
  })

  // Tab 2: Today's Offers (Segregated lists: Active offers and Expired offers)
  const activeOffers = filteredBase.filter(item => item.hasOffer && !item.isExpired)
  const expiredOffers = filteredBase.filter(item => item.hasOffer && item.isExpired)

  // Card renderer helper
  const renderItemCard = (item, isExpiredOffer) => {
    const isAdded = wishlistAddedMap[item.id]
    const showActiveOffer = item.hasOffer && !isExpiredOffer

    return (
      <div 
        key={item.id} 
        className="deal-card"
        style={{
          opacity: isExpiredOffer ? 0.6 : 1,
          border: showActiveOffer ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid var(--border-color)',
          background: showActiveOffer ? 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.05), rgba(255,255,255,0.01))' : 'rgba(255,255,255,0.03)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>{item.name}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <Store size={14} color="#a5b4fc" />
              <span>{item.shop_name} ({item.location || 'Hosur'})</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {showActiveOffer && (
              <>
                <span className="badge-discount">{item.discount_pct}% OFF</span>
                <span className="badge-today">⚡ Live</span>
              </>
            )}
            {isExpiredOffer && (
              <span style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '2px' }}>
                <Clock size={10} /> Expired
              </span>
            )}
          </div>
        </div>

        {item.description && item.hasOffer && (
          <p style={{ fontSize: '0.75rem', color: isExpiredOffer ? 'var(--text-muted)' : '#c084fc', fontStyle: 'italic', marginTop: '6px', marginBottom: '2px' }}>
            "{item.description}"
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <div>
            {showActiveOffer ? (
              <>
                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>₹{item.sale_price}</span>
                <span style={{ fontSize: '0.8rem', textDecoration: 'line-through', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  ₹{item.price}
                </span>
              </>
            ) : (
              <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>₹{item.price}</span>
            )}
          </div>

          <button
            className={`btn-secondary ${isAdded ? 'active' : ''}`}
            onClick={() => !isAdded && !isExpiredOffer && handleAddToWishlist(item.id, item.name)}
            disabled={isAdded || isExpiredOffer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              fontSize: '0.75rem',
              background: isAdded ? 'rgba(16, 185, 129, 0.15)' : isExpiredOffer ? 'rgba(255,255,255,0.05)' : 'rgba(99, 102, 241, 0.2)',
              borderColor: isAdded ? 'rgba(16, 185, 129, 0.3)' : isExpiredOffer ? 'var(--border-color)' : '#6366f1',
              color: isAdded ? '#10b981' : isExpiredOffer ? 'var(--text-muted)' : '#a5b4fc',
              cursor: isExpiredOffer ? 'not-allowed' : 'pointer'
            }}
          >
            {isAdded ? (
              <>
                <Check size={14} /> Wishlisted
              </>
            ) : isExpiredOffer ? (
              <>Offer Ended</>
            ) : (
              <>
                <Plus size={14} /> Add to Wishlist
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: '800', marginBottom: '4px' }}>
          Customer Dashboard
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Discover local goods and grab the best discount offers in Hosur
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: activeTab === 'all' ? '#6366f1' : 'var(--border-color)',
            background: activeTab === 'all' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
            color: activeTab === 'all' ? '#a5b4fc' : 'var(--text-muted)',
            fontWeight: '700',
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🛍️ All Products
        </button>
        <button
          onClick={() => setActiveTab('offers')}
          style={{
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: activeTab === 'offers' ? '#a855f7' : 'var(--border-color)',
            background: activeTab === 'offers' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.02)',
            color: activeTab === 'offers' ? '#c084fc' : 'var(--text-muted)',
            fontWeight: '700',
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🏷️ Today's Offers
        </button>
      </div>

      {/* Search Input */}
      <input
        type="text"
        className="input-field"
        placeholder="🔍 Search items or shops..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Category Pills */}
      <div className="category-scroll">
        {['All', 'Electronics', 'Groceries', 'Home Appliances', 'Clothing'].map(cat => (
          <button
            key={cat}
            className={`pill-btn ${categoryFilter === cat ? 'active' : ''}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>Loading items...</div>
      ) : activeTab === 'all' ? (
        allTabItems.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allTabItems.map(item => renderItemCard(item, false))}
          </div>
        ) : (
          <div className="glass-card" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No items found in category <strong>{categoryFilter}</strong>.
          </div>
        )
      ) : (
        /* Today's Offers Tab (Active and Expired segregated) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Active Offers Section */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#a855f7', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔥 Active Offers ({activeOffers.length})
            </h3>
            {activeOffers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeOffers.map(item => renderItemCard(item, false))}
              </div>
            ) : (
              <div className="glass-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                No active offers available today.
              </div>
            )}
          </div>

          {/* Expired Offers Section */}
          {expiredOffers.length > 0 && (
            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#ef4444', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🛑 Ended / Expired Offers ({expiredOffers.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {expiredOffers.map(item => renderItemCard(item, true))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
