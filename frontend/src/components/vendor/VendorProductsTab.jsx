import React, { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '../../services/supabase'
import { Package, Plus, Tag, Trash2, Percent } from 'lucide-react'

export function VendorProductsTab({ user }) {
  const [shop, setShop] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Add Product Form State
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('Electronics')
  const [newPrice, setNewPrice] = useState('')

  // Create Offer Form State
  const [offerItemId, setOfferItemId] = useState('')
  const [offerDiscount, setOfferDiscount] = useState('')
  const [offerTagline, setOfferTagline] = useState('')

  const fetchVendorProducts = useCallback(async () => {
    setLoading(true)
    const supabase = await getSupabase()
    if (!supabase || !user) return

    const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', user.id).single()
    setShop(shopData)

    if (shopData) {
      const { data: itemData } = await supabase.from('items').select('*, offers(*)').eq('shop_id', shopData.id)
      setItems(itemData || [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchVendorProducts()
  }, [fetchVendorProducts])

  const handleAddProduct = async (e) => {
    e.preventDefault()
    if (!shop || !newName || !newPrice) return
    const supabase = await getSupabase()
    if (!supabase) return

    const { data, error } = await supabase.from('items').insert({
      shop_id: shop.id,
      name: newName,
      category: newCategory,
      price: parseFloat(newPrice)
    }).select()

    if (!error && data) {
      setNewName('')
      setNewPrice('')
      fetchVendorProducts()
    } else {
      alert('Error adding item: ' + (error ? error.message : 'Unknown'))
    }
  }

  const handleDeleteItem = async (itemId) => {
    const supabase = await getSupabase()
    if (!supabase) return

    const { error } = await supabase.from('items').delete().eq('id', itemId)
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== itemId))
    }
  }

  const handleCreateOffer = async (e) => {
    e.preventDefault()
    if (!offerItemId || !offerDiscount) return
    const supabase = await getSupabase()
    if (!supabase) return

    const item = items.find(i => i.id === offerItemId)
    if (!item) return

    const discount = parseFloat(offerDiscount)
    const salePrice = item.price * (1 - (discount / 100))
    const nowDt = new Date()
    const endDt = new Date(nowDt.getTime() + 24 * 60 * 60 * 1000)

    const { error } = await supabase.from('offers').upsert({
      item_id: offerItemId,
      discount_pct: discount,
      sale_price: salePrice,
      description: offerTagline,
      start_time: nowDt.toISOString(),
      end_time: endDt.toISOString()
    }, { on_conflict: 'item_id' })

    if (!error) {
      setOfferItemId('')
      setOfferDiscount('')
      setOfferTagline('')
      fetchVendorProducts()
    }
  }

  const handleRemoveOffer = async (itemId) => {
    const supabase = await getSupabase()
    if (!supabase) return

    const { error } = await supabase.from('offers').delete().eq('item_id', itemId)
    if (!error) {
      fetchVendorProducts()
    }
  }

  const isApproved = shop?.is_approved

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: '800', marginBottom: '4px' }}>
          Catalog & Offers Manager
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Manage your products, create 24-hr discount offers, and clear old items
        </p>
      </div>

      {!isApproved ? (
        <div className="glass-card" style={{ border: '1px solid var(--accent-warning)', padding: '24px 16px', textAlign: 'center' }}>
          <Package size={48} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f59e0b', marginBottom: '8px' }}>Catalog Access Locked</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Catalog uploading and daily offer configuration are currently disabled because your store is pending admin approval.
            Once approved by the admin, you will be able to add inventory and launch flash sales immediately.
          </p>
          <div style={{ marginTop: '16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '10px', borderRadius: '8px', fontSize: '0.78rem', color: '#f59e0b' }}>
            ⏳ Status: Waiting for Admin Review
          </div>
        </div>
      ) : (
        <>
          {/* Add Product Form */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} color="#6366f1" /> Add Product to Catalog
            </h3>

            <form onSubmit={handleAddProduct}>
              <input
                type="text"
                className="input-field"
                placeholder="Product Name (e.g. Smart Watch)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <select
                  className="input-field"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  <option value="Electronics" style={{ background: '#13112b' }}>Electronics</option>
                  <option value="Groceries" style={{ background: '#13112b' }}>Groceries</option>
                  <option value="Home Appliances" style={{ background: '#13112b' }}>Home Appliances</option>
                  <option value="Clothing" style={{ background: '#13112b' }}>Clothing</option>
                </select>

                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="Base Price (₹)"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-secondary" style={{ width: '100%', background: 'rgba(99, 102, 241, 0.2)', borderColor: '#6366f1', color: '#a5b4fc', fontWeight: '700' }}>
                Add Item
              </button>
            </form>
          </div>

          {/* Create Offer Form */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={18} color="#a855f7" /> Create Today's Discount Offer
            </h3>

            <form onSubmit={handleCreateOffer}>
              <select
                className="input-field"
                value={offerItemId}
                onChange={(e) => setOfferItemId(e.target.value)}
                required
              >
                <option value="" style={{ background: '#13112b' }}>Select Item from Inventory...</option>
                {items.map(i => (
                  <option key={i.id} value={i.id} style={{ background: '#13112b' }}>
                    {i.name} (₹{i.price})
                  </option>
                ))}
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="input-field"
                  placeholder="Discount % (e.g. 15)"
                  value={offerDiscount}
                  onChange={(e) => setOfferDiscount(e.target.value)}
                  required
                />

                <input
                  type="text"
                  className="input-field"
                  placeholder="Tagline (e.g. Today Sale!)"
                  value={offerTagline}
                  onChange={(e) => setOfferTagline(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-secondary" style={{ width: '100%', background: 'rgba(168, 85, 247, 0.2)', borderColor: '#a855f7', color: '#c084fc', fontWeight: '700' }}>
                Create Offer (Valid 24h Today)
              </button>
            </form>
          </div>

          {/* Products Inventory List */}
          <h3 style={{ fontFamily: 'Outfit', fontSize: '1.2rem', fontWeight: '700', marginBottom: '12px' }}>
            Current Shop Products ({items.length})
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading inventory...</div>
          ) : items.length > 0 ? (
            items.map(item => {
              const hasOffer = item.offers && item.offers.discount_pct

              return (
                <div key={item.id} className="deal-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: '700' }}>{item.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.category} • Base: ₹{item.price}</span>
                    </div>

                    <button
                      className="btn-secondary"
                      onClick={() => handleDeleteItem(item.id)}
                      style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '6px 10px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Offer Details */}
                  {hasOffer ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>
                          {parseFloat(item.offers.discount_pct)}% OFF • Sale: ₹{parseFloat(item.offers.sale_price)}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {item.offers.description || 'Active Today'}
                        </span>
                      </div>

                      <button
                        className="btn-secondary"
                        onClick={() => handleRemoveOffer(item.id)}
                        style={{ fontSize: '0.7rem', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
                      >
                        Remove Offer
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No active discount offer set.
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="glass-card" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              No items listed in catalog. Use the form above to add products.
            </div>
          )}
        </>
      )}
    </div>
  )
}
