import React, { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '../../services/supabase'
import { Heart, Trash2, Store, Calendar, ShoppingBag } from 'lucide-react'

export function WishlistTab({ user }) {
  const [wishlists, setWishlists] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchWishlists = useCallback(async () => {
    setLoading(true)
    const supabase = await getSupabase()
    if (!supabase || !user) return

    const { data } = await supabase
      .from('wishlists')
      .select('*, items(*, shops(*))')
      .eq('customer_id', user.id)

    setWishlists(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchWishlists()
  }, [fetchWishlists])

  const handleDelete = async (wishlistId, itemName) => {
    const supabase = await getSupabase()
    if (!supabase) return

    const { data, error } = await supabase.from('wishlists').delete().eq('id', wishlistId).select()
    if (!error) {
      setWishlists(prev => prev.filter(w => w.id !== wishlistId))
    } else {
      console.error('Error removing wishlist item:', error)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: '800', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Heart size={24} color="#ef4444" fill="#ef4444" /> My Wishlist
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Items you're interested in buying from local Hosur vendors
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>Loading wishlist...</div>
      ) : wishlists.length > 0 ? (
        wishlists.map(w => {
          const itemName = w.items?.name || 'Item'
          const category = w.items?.category || 'General'
          const shopName = w.items?.shops?.name || 'Vendor Shop'
          const date = new Date(w.created_at).toLocaleDateString()

          return (
            <div key={w.id} className="deal-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '700' }}>{itemName}</h4>
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShoppingBag size={12} color="#818cf8" /> {category}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Store size={12} color="#a5b4fc" /> {shopName}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> Added on {date}
                </div>
              </div>

              <button
                className="btn-secondary"
                onClick={() => handleDelete(w.id, itemName)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '8px 12px'
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )
        })
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          No items in your wishlist. Try asking the AI voice assistant: <br />
          <em style={{ color: '#a5b4fc', display: 'block', marginTop: '8px' }}>"Add a smart watch to my wishlist"</em>
        </div>
      )}
    </div>
  )
}
