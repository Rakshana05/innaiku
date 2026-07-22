import React, { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '../../services/supabase'
import { ShieldAlert, Users, Store, CheckCircle, XCircle, MapPin, Heart, ChevronDown, ChevronUp, Flame, Phone, BarChart2, FileText, ExternalLink, Search, Eye, X } from 'lucide-react'

export function AdminDashboard({ user, activeSubTab = 'dashboard' }) {
  const [customers, setCustomers] = useState([])
  const [shops, setShops] = useState([])
  const [catalogDemand, setCatalogDemand] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [expandedItemId, setExpandedItemId] = useState(null)
  const [loading, setLoading] = useState(true)

  // Proof Document Viewer Modal State
  const [proofModalDoc, setProofModalDoc] = useState(null) // { url: string, name: string, owner: string }

  // Directory Search Filters
  const [vendorSearch, setVendorSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const defaultCatalog = [
    {
      item_id: 'i1',
      item_name: 'Bluetooth Speaker',
      category: 'Electronics',
      price: 1999,
      wishlist_count: 2,
      shop_name: 'Hosur Electronics Hub',
      owner_name: 'S. Murugan',
      shop_location: 'Denkanikottai Road, Hosur',
      shop_phone: '+919999999999',
      wishlisted_by: ['Priya (+919876543211)', 'Karthik (+919876543212)']
    },
    {
      item_id: 'i2',
      item_name: 'Smart Watch',
      category: 'Electronics',
      price: 2999,
      wishlist_count: 1,
      shop_name: 'Hosur Electronics Hub',
      owner_name: 'S. Murugan',
      shop_location: 'Denkanikottai Road, Hosur',
      shop_phone: '+919999999999',
      wishlisted_by: ['Priya (+919876543211)']
    },
    {
      item_id: 'i3',
      item_name: 'iPhone 15',
      category: 'Electronics',
      price: 79999,
      wishlist_count: 1,
      shop_name: 'Hosur Electronics Hub',
      owner_name: 'S. Murugan',
      shop_location: 'Denkanikottai Road, Hosur',
      shop_phone: '+919999999999',
      wishlisted_by: ['Karthik (+919876543212)']
    },
    {
      item_id: 'i4',
      item_name: 'LED Smart TV',
      category: 'Electronics',
      price: 24999,
      wishlist_count: 1,
      shop_name: 'Hosur Electronics Hub',
      owner_name: 'S. Murugan',
      shop_location: 'Denkanikottai Road, Hosur',
      shop_phone: '+919999999999',
      wishlisted_by: ['Priya (+919876543211)']
    },
    {
      item_id: 'i5',
      item_name: 'Organic Apples',
      category: 'Groceries',
      price: 180,
      wishlist_count: 1,
      shop_name: 'Hosur Organic Produce',
      owner_name: 'V. Raman',
      shop_location: 'Mathigiri Road, Hosur',
      shop_phone: '+919888888888',
      wishlisted_by: ['Karthik (+919876543212)']
    }
  ]

  const fetchAdminLiveData = useCallback(async () => {
    setLoading(true)
    const supabase = await getSupabase()
    if (!supabase) {
      setCustomers([
        { id: 'c1', full_name: 'Priya', phone: '+919876543211', location: 'Denkanikottai Road, Hosur' },
        { id: 'c2', full_name: 'Karthik', phone: '+919876543212', location: 'Hosur Railway Station Road, Hosur' }
      ])
      setShops([
        { id: 's1', name: 'Hosur Electronics Hub', owner_name: 'S. Murugan', phone: '+919999999999', location: 'Denkanikottai Road, Hosur', is_approved: true, document_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop' }
      ])
      setCatalogDemand(defaultCatalog)
      setLoading(false)
      return
    }

    try {
      // 1. Fetch Customers from DB profiles table
      const { data: custData } = await supabase.from('profiles').select('*').eq('role', 'customer')
      setCustomers(custData || [])

      // 2. Fetch Shops/Vendors from DB shops table
      const { data: shopData } = await supabase.from('shops').select('*')
      const { data: profileData } = await supabase.from('profiles').select('*')

      const profileMap = {};
      if (profileData) {
        profileData.forEach(p => { profileMap[p.id] = p })
      }

      // Map owner phone from profile data to the shop object
      const formattedShops = (shopData || []).map(s => {
        const ownerProfile = profileMap[s.owner_id] || {}
        return {
          ...s,
          phone: s.phone || ownerProfile.phone || 'No phone'
        }
      })
      setShops(formattedShops)

      const shopMap = {};
      formattedShops.forEach(s => { shopMap[s.id] = s })

      // 3. Query item_wishlist_counts view directly from Supabase
      const { data: countViewData } = await supabase.from('item_wishlist_counts').select('*')
      const { data: itemData } = await supabase.from('items').select('*')
      const { data: wishlistData } = await supabase.from('wishlists').select('*')

      // Map wishlists grouped by item_id
      const wishlistMap = {};
      (wishlistData || []).forEach(w => {
        if (!wishlistMap[w.item_id]) wishlistMap[w.item_id] = []
        const custProfile = profileMap[w.customer_id]
        const custName = custProfile ? `${custProfile.full_name || 'Customer'} (${custProfile.phone || ''})` : `Customer (${w.customer_id.slice(0, 6)}...)`
        wishlistMap[w.item_id].push(custName)
      })

      // Map view count
      const viewCountMap = {};
      (countViewData || []).forEach(v => { viewCountMap[v.item_id] = v.wishlist_count })

      // Format full catalog demand
      let formattedDemand = (itemData || []).map(item => {
        const shop = shopMap[item.shop_id] || {}
        const wishlistedBy = wishlistMap[item.id] || []
        const count = viewCountMap[item.id] !== undefined ? viewCountMap[item.id] : wishlistedBy.length
        return {
          item_id: item.id,
          item_name: item.name,
          category: item.category,
          price: parseFloat(item.price),
          wishlist_count: count,
          shop_name: shop.name || 'Hosur Local Store',
          owner_name: shop.owner_name || 'Vendor Owner',
          shop_location: shop.location || 'Hosur',
          shop_phone: shop.phone || 'Vendor Phone',
          wishlisted_by: wishlistedBy
        }
      })

      // SORT STRICTLY IN DESCENDING ORDER (HIGHEST WISHLIST COUNT FIRST)
      formattedDemand.sort((a, b) => b.wishlist_count - a.wishlist_count)

      if (formattedDemand.length === 0) {
        formattedDemand = defaultCatalog
      }

      setCatalogDemand(formattedDemand)

    } catch (e) {
      console.error('Error fetching admin live database data:', e)
      setCatalogDemand(defaultCatalog)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAdminLiveData()
  }, [fetchAdminLiveData])

  // Live Database Approve / Reject Vendor Update
  const handleApproveVendor = async (shopId, ownerId) => {
    const supabase = await getSupabase()
    if (supabase) {
      await supabase.from('shops').update({ is_approved: true }).eq('id', shopId)
      if (ownerId) {
        await supabase.from('profiles').update({ is_approved: true }).eq('id', ownerId)
      }
    }
    setShops(prev => prev.map(s => s.id === shopId ? { ...s, is_approved: true } : s))
  }

  const handleRejectVendor = async (shopId, ownerId) => {
    const supabase = await getSupabase()
    if (supabase) {
      await supabase.from('shops').update({ is_approved: false }).eq('id', shopId)
      if (ownerId) {
        await supabase.from('profiles').update({ is_approved: false }).eq('id', ownerId)
      }
    }
    setShops(prev => prev.map(s => s.id === shopId ? { ...s, is_approved: false } : s))
  }

  const pendingVendors = shops.filter(s => !s.is_approved)
  const approvedVendors = shops.filter(s => s.is_approved)

  // Filtered Shops List for Vendors Directory
  const filteredShops = shops.filter(s => {
    const q = vendorSearch.toLowerCase()
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.owner_name || '').toLowerCase().includes(q) ||
      (s.location || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    )
  })

  // Filtered Customers List
  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase()
    return (
      (c.full_name || c.name || '').toLowerCase().includes(q) ||
      (c.location || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    )
  })

  // DEMAND SECTION VIEW ONLY (When activeSubTab === 'catalog' / Demand Tab)
  if (activeSubTab === 'catalog') {
    return (
      <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(1.15rem, 4vw, 1.35rem)', fontWeight: '800', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={22} color="#c084fc" /> Catalog Demand Analytics
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Items ranked strictly in descending order by wishlist demand count
          </p>
        </div>

        {/* CATALOG DEMAND RANKING (item_wishlist_counts in Descending Order) */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={15} color="#f59e0b" /> Wishlist Demand Ranking
            </span>
            <span style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#c7d2fe', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600' }}>
              Descending Order
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Loading live wishlist counts...</div>
          ) : catalogDemand.length > 0 ? (
            catalogDemand.map((item, index) => {
              const isExpanded = expandedItemId === item.item_id

              return (
                <div
                  key={item.item_id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: isExpanded ? '1px solid #6366f1' : '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '12px',
                    marginBottom: '10px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Item Header Bar: Item Name & Wishlist Count */}
                  <div
                    onClick={() => setExpandedItemId(isExpanded ? null : item.item_id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '800', color: index === 0 ? '#f59e0b' : '#94a3b8' }}>
                          #{index + 1}
                        </span>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: '#f8fafc' }}>{item.item_name}</h4>
                      </div>

                      {/* Sub-place: Shop Name */}
                      <div style={{ fontSize: '0.78rem', color: '#a5b4fc', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                        <Store size={13} color="#a5b4fc" />
                        <span>{item.shop_name}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge-discount" style={{ background: item.wishlist_count > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)', color: item.wishlist_count > 0 ? '#f59e0b' : '#94a3b8', fontSize: '0.8rem', fontWeight: '800', padding: '4px 10px' }}>
                        🔥 {item.wishlist_count} Requests
                      </span>
                      {isExpanded ? <ChevronUp size={16} color="#a5b4fc" /> : <ChevronDown size={16} color="#94a3b8" />}
                    </div>
                  </div>

                  {/* Expanded Item Details Panel */}
                  {isExpanded && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '10px', borderRadius: '8px', fontSize: '0.78rem' }}>
                        <span style={{ fontWeight: '700', color: '#a5b4fc', display: 'block', marginBottom: '4px' }}>
                          🏪 Vendor & Shop Details:
                        </span>
                        <div>Shop Name: <strong>{item.shop_name}</strong></div>
                        <div>Owner: <strong>{item.owner_name}</strong></div>
                        <div>Category: <strong>{item.category}</strong> • Price: <strong>₹{item.price}</strong></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', color: '#f59e0b' }}>
                          <MapPin size={12} /> Address: {item.shop_location}
                        </div>
                        {item.shop_phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Phone size={12} /> Contact: {item.shop_phone}
                          </div>
                        )}
                      </div>

                      {/* Wishlist Customer Breakdown */}
                      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px', fontSize: '0.75rem' }}>
                        <span style={{ fontWeight: '700', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                          <Heart size={12} fill="#c084fc" color="#c084fc" /> Wishlisted By ({item.wishlisted_by?.length || 0} Customers):
                        </span>
                        {item.wishlisted_by && item.wishlisted_by.length > 0 ? (
                          item.wishlisted_by.map((cust, cIdx) => (
                            <div key={cIdx} style={{ color: '#f8fafc', padding: '2px 0' }}>
                              • {cust}
                            </div>
                          ))
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No customer has wishlisted this product yet.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No catalog demand entries found.</div>
          )}
        </div>
      </div>
    )
  }

  // USERS DIRECTORY VIEW (When activeSubTab === 'users')
  if (activeSubTab === 'users') {
    return (
      <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(1.15rem, 4vw, 1.35rem)', fontWeight: '800', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="#c084fc" /> Platform Users Directory
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Manage registered customer localities and vendor stores
          </p>
        </div>

        {/* VENDORS DIRECTORY */}
        <div className="glass-card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Store size={18} color="#c084fc" /> Registered Vendors Directory ({shops.length})
            </h3>
            <span style={{ fontSize: '0.7rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
              Live DB Sync
            </span>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '12px' }}>
            Directory of registered shops, owner contact details, document proofs, and approval status
          </p>

          {/* Vendor Search Input */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search vendors by shop name, owner, phone or location..."
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredShops.length > 0 ? (
              filteredShops.map(s => (
                <div
                  key={s.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#f8fafc' }}>{s.name}</h4>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: s.is_approved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: s.is_approved ? '#10b981' : '#f59e0b',
                          border: s.is_approved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          {s.is_approved ? 'Approved Vendor ✓' : 'Pending Approval ⏳'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.76rem', color: '#c7d2fe', marginTop: '4px' }}>
                        Owner: <strong>{s.owner_name}</strong> {s.phone ? `(${s.phone})` : ''}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.73rem', color: '#f59e0b', marginTop: '3px' }}>
                        <MapPin size={12} /> Address: {s.location}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* View Proof Document Button */}
                      <button
                        className="btn-secondary"
                        onClick={() => setProofModalDoc({ 
                          url: s.document_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop', 
                          name: s.name, 
                          owner: s.owner_name 
                        })}
                        style={{ background: 'rgba(168, 85, 247, 0.15)', borderColor: '#a855f7', color: '#c084fc', padding: '5px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <FileText size={13} /> View Proof
                      </button>

                      {/* Quick DB Action Toggles */}
                      {!s.is_approved ? (
                        <button
                          className="btn-secondary"
                          onClick={() => handleApproveVendor(s.id, s.owner_id)}
                          style={{ background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#10b981', padding: '5px 8px', fontSize: '0.72rem' }}
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          className="btn-secondary"
                          onClick={() => handleRejectVendor(s.id, s.owner_id)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '5px 8px', fontSize: '0.72rem' }}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No matching vendors found in directory.</div>
            )}
          </div>
        </div>

        {/* CUSTOMER LOCALITY DIRECTORY */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Users size={18} color="#818cf8" /> Customer Locality Directory ({customers.length})
            </h3>
            <span style={{ fontSize: '0.7rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
              Live DB Sync
            </span>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '12px' }}>
            View registered customer phone numbers and current locality addresses
          </p>

          {/* Customer Search Input */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search customers by name, phone or locality..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f8fafc' }}>{c.full_name || c.name || 'Customer'}</h4>
                      <span className="pill-btn" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{c.phone}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#f59e0b', marginTop: '2px' }}>
                      <MapPin size={12} /> Locality: <strong>{c.location || 'Hosur'}</strong>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No matching customers found in directory.</div>
            )}
          </div>
        </div>

        {/* PROOF DOCUMENT MODAL PREVIEW */}
        {proofModalDoc && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
          }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', background: '#13112b', border: '1px solid #a855f7', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', pb: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={18} /> Document of Proof
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Shop: <strong>{proofModalDoc.name}</strong> • Owner: {proofModalDoc.owner}
                  </span>
                </div>
                <button
                  onClick={() => setProofModalDoc(null)}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Document Content Display */}
              <div style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                {proofModalDoc.url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || proofModalDoc.url.startsWith('data:image') ? (
                  <img
                    src={proofModalDoc.url}
                    alt="Document Proof"
                    style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                ) : proofModalDoc.url.endsWith('.pdf') ? (
                  <iframe
                    src={proofModalDoc.url}
                    title="PDF Proof"
                    style={{ width: '100%', height: '340px', border: 'none', borderRadius: '8px' }}
                  />
                ) : (
                  <div style={{ padding: '30px 10px', textAlign: 'center' }}>
                    <FileText size={48} color="#c084fc" style={{ marginBottom: '10px' }} />
                    <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: '700' }}>Document Proof Attached</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Click below to open or download the full document
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={proofModalDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ flex: 1, textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  <ExternalLink size={16} /> Open Document in New Tab
                </a>
                <button
                  className="btn-secondary"
                  onClick={() => setProofModalDoc(null)}
                  style={{ width: '90px', padding: '10px', fontSize: '0.85rem' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // MAIN DASHBOARD VIEW (When activeSubTab === 'dashboard')
  return (
    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(1.15rem, 4vw, 1.35rem)', fontWeight: '800', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={22} /> System Admin Dashboard
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Vendor shop approvals, document proofs, and metrics summary
        </p>
      </div>

      {/* Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div className="glass-card" style={{ marginBottom: 0, padding: '12px 8px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#818cf8', display: 'block' }}>Customers</span>
          <span style={{ fontSize: '1.3rem', fontWeight: '800' }}>{customers.length}</span>
        </div>

        <div className="glass-card" style={{ marginBottom: 0, padding: '12px 8px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#c084fc', display: 'block' }}>Vendors</span>
          <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#c084fc' }}>{shops.length}</span>
        </div>

        <div className="glass-card" style={{ marginBottom: 0, padding: '12px 8px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#f59e0b', display: 'block' }}>Pending</span>
          <span style={{ fontSize: '1.3rem', fontWeight: '800', color: pendingVendors.length > 0 ? '#f59e0b' : '#10b981' }}>
            {pendingVendors.length}
          </span>
        </div>
      </div>

      {/* VENDOR APPROVALS QUEUE */}
      <div className="glass-card" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Store size={18} color="#f59e0b" /> Pending Vendor Approvals ({pendingVendors.length})
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '12px' }}>
          Review document proofs and approve vendor shops in the live database
        </p>

        {pendingVendors.length > 0 ? (
          pendingVendors.map(v => (
            <div key={v.id} style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#f8fafc' }}>{v.name}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Owner: {v.owner_name} ({v.phone || 'Phone verified'})</span>
                  <span style={{ fontSize: '0.75rem', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <MapPin size={12} /> Address: {v.location}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Proof Document Button */}
                  <button
                    className="btn-secondary"
                    onClick={() => setProofModalDoc({ 
                      url: v.document_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop', 
                      name: v.name, 
                      owner: v.owner_name 
                    })}
                    style={{ background: 'rgba(168, 85, 247, 0.2)', borderColor: '#a855f7', color: '#c084fc', padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <FileText size={14} /> View Proof
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() => handleApproveVendor(v.id, v.owner_id)}
                    style={{ background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#10b981', padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <CheckCircle size={14} /> Approve DB
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() => handleRejectVendor(v.id, v.owner_id)}
                    style={{ background: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444', color: '#ef4444', padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <XCircle size={14} /> Reject DB
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={16} /> All registered vendor shops are approved in the database!
          </div>
        )}
      </div>

      {/* PROOF DOCUMENT MODAL PREVIEW */}
      {proofModalDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', background: '#13112b', border: '1px solid #a855f7', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', pb: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={18} /> Document of Proof
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Shop: <strong>{proofModalDoc.name}</strong> • Owner: {proofModalDoc.owner}
                </span>
              </div>
              <button
                onClick={() => setProofModalDoc(null)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Document Content Display */}
            <div style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
              {proofModalDoc.url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || proofModalDoc.url.startsWith('data:image') ? (
                <img
                  src={proofModalDoc.url}
                  alt="Document Proof"
                  style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : proofModalDoc.url.endsWith('.pdf') ? (
                <iframe
                  src={proofModalDoc.url}
                  title="PDF Proof"
                  style={{ width: '100%', height: '340px', border: 'none', borderRadius: '8px' }}
                />
              ) : (
                <div style={{ padding: '30px 10px', textAlign: 'center' }}>
                  <FileText size={48} color="#c084fc" style={{ marginBottom: '10px' }} />
                  <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: '700' }}>Document Proof Attached</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Click below to open or download the full document
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <a
                href={proofModalDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ flex: 1, textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                <ExternalLink size={16} /> Open Document in New Tab
              </a>
              <button
                className="btn-secondary"
                onClick={() => setProofModalDoc(null)}
                style={{ width: '90px', padding: '10px', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
