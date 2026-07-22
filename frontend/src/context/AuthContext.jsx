import React, { createContext, useContext, useState, useEffect } from 'react'
import { getSupabase } from '../services/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authState, setAuthState] = useState('LOADING') // 'LOADING', 'PHONE', 'OTP', 'SETUP', 'AUTHENTICATED'
  const [pendingPhone, setPendingPhone] = useState('')
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    // Check saved session in localStorage for 2nd time auto-login
    async function restoreSession() {
      try {
        const savedSession = localStorage.getItem('innaikku_user_session')
        if (savedSession) {
          const parsed = JSON.parse(savedSession)
          if (parsed && parsed.id && parsed.role) {
            setUser(parsed)
            setAuthState('AUTHENTICATED')
            return
          }
        }

        // Check active Supabase Auth session
        const supabase = await getSupabase()
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session && session.user) {
            const phoneNum = session.user.phone || ''
            // Fetch profile from database
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .or(`phone.eq.${phoneNum},phone.eq.${phoneNum.replace('+91', '')}`)
              .maybeSingle()

            const restored = {
              id: session.user.id,
              phone: phoneNum,
              role: profile?.role || session.user.user_metadata?.role || 'customer',
              name: profile?.full_name || session.user.user_metadata?.name || 'User',
              lang: profile?.preferred_language || 'ta',
              location: profile?.location || 'Hosur',
              is_approved: profile ? profile.is_approved : (session.user.user_metadata?.role !== 'vendor')
            }
            setUser(restored)
            localStorage.setItem('innaikku_user_session', JSON.stringify(restored))
            setAuthState('AUTHENTICATED')
            return
          }
        }
      } catch (e) {
        console.error('Error restoring session:', e)
      }
      setAuthState('PHONE')
    }

    restoreSession()
  }, [])

  const startPhoneAuth = async (phone) => {
    setAuthError('')
    if (!phone || phone.trim().length < 5) {
      setAuthError('Please enter a valid phone number.')
      return false
    }

    const rawPhone = phone.trim()
    const intlPhone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone}`
    setPendingPhone(rawPhone)
    setAuthState('OTP')

    try {
      const supabase = await getSupabase()
      if (supabase) {
        // Try sending to international format (+91...), fallback to raw number (7777777777)
        const { error } = await supabase.auth.signInWithOtp({ phone: intlPhone })
        if (error) {
          await supabase.auth.signInWithOtp({ phone: rawPhone })
        }
      }
    } catch (e) {
      console.warn('Supabase signInWithOtp notice:', e)
    }
    return true
  }

  const verifyOtp = async (otp) => {
    setAuthError('')
    const cleanOtp = (otp || '').trim()

    if (!cleanOtp || cleanOtp.length < 4) {
      setAuthError('Please enter the complete 6-digit OTP code.')
      return false
    }

    const rawPhone = pendingPhone.trim()
    const intlPhone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone}`

    // 1. Try Supabase Auth verifyOtp (Validates live SMS / Supabase Dashboard Test Numbers box)
    try {
      const supabase = await getSupabase()
      if (supabase) {
        let { data, error } = await supabase.auth.verifyOtp({
          phone: intlPhone,
          token: cleanOtp,
          type: 'sms'
        })

        // Retry with raw phone number format if test number in Supabase is added without +91
        if (error) {
          const retry = await supabase.auth.verifyOtp({
            phone: rawPhone,
            token: cleanOtp,
            type: 'sms'
          })
          if (!retry.error && retry.data) {
            data = retry.data
            error = null
          }
        }

        if (!error && data && data.user) {
          // OTP WAS VERIFIED BY SUPABASE AUTH!
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .or(`phone.eq.${intlPhone},phone.eq.${rawPhone}`)
            .maybeSingle()

          if (profile) {
            const authenticatedUser = {
              id: profile.id,
              phone: profile.phone,
              role: profile.role || 'customer',
              name: profile.full_name || 'User',
              lang: profile.preferred_language || 'ta',
              location: profile.location || 'Hosur',
              is_approved: profile.is_approved
            }
            setUser(authenticatedUser)
            localStorage.setItem('innaikku_user_session', JSON.stringify(authenticatedUser))
            setAuthState('AUTHENTICATED')
            return true
          } else {
            // New user registration flow
            setAuthState('SETUP')
            return true
          }
        }
      }
    } catch (e) {
      console.warn('Supabase verifyOtp check:', e)
    }

    // 2. Demo Mode OTP Match (If testing preset numbers offline)
    if (cleanOtp === '123456' || cleanOtp === '777777') {
      try {
        const supabase = await getSupabase()
        if (supabase) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .or(`phone.eq.${intlPhone},phone.eq.${rawPhone}`)
            .maybeSingle()

          if (profile) {
            const dbUser = {
              id: profile.id,
              phone: profile.phone,
              role: profile.role || 'customer',
              name: profile.full_name || 'User',
              lang: profile.preferred_language || 'ta',
              location: profile.location || 'Hosur',
              is_approved: profile.is_approved
            }
            setUser(dbUser)
            localStorage.setItem('innaikku_user_session', JSON.stringify(dbUser))
            setAuthState('AUTHENTICATED')
            return true
          }
        }
      } catch (e) {
        console.warn('Demo profile check:', e)
      }

      setAuthState('SETUP')
      return true
    }

    // IF OTP WAS INCORRECT, SHOW VERIFICATION ERROR & BLOCK LOGIN!
    setAuthError('❌ Invalid OTP Code. Verification failed.')
    return false
  }

  const completeSetup = async (details) => {
    const rawPhone = (pendingPhone || details.phone || '').trim()
    const formattedPhone = rawPhone ? (rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone}`) : '+919999999999'
    const userId = details.id || `user-${Date.now()}`

    const newUser = {
      id: userId,
      phone: formattedPhone,
      role: details.role, // 'customer', 'vendor', or 'admin'
      name: details.name || 'User',
      lang: details.lang || 'ta',
      location: details.location || 'Hosur',
      shopName: details.shopName || '',
      documentUrl: details.documentUrl || '',
      is_approved: details.role !== 'vendor'
    }

    try {
      const supabase = await getSupabase()
      if (supabase) {
        // 1. Upsert profile in Supabase
        await supabase.from('profiles').upsert({
          id: userId,
          phone: formattedPhone,
          role: details.role,
          full_name: details.name,
          preferred_language: details.lang,
          location: details.location,
          shop_name: details.shopName || null,
          document_url: details.documentUrl || null,
          is_approved: details.role !== 'vendor'
        }, { on_conflict: 'phone' })

        // 2. If Vendor, create or update Shop record in Supabase
        if (details.role === 'vendor') {
          // Check if shop already exists for this owner
          const { data: existingShop } = await supabase
            .from('shops')
            .select('id')
            .eq('owner_id', userId)
            .maybeSingle()

          if (existingShop) {
            await supabase.from('shops').update({
              name: details.shopName || 'Vendor Shop',
              owner_name: details.name,
              location: details.location,
              phone: formattedPhone,
              document_url: details.documentUrl || null,
              is_approved: false
            }).eq('id', existingShop.id)
          } else {
            await supabase.from('shops').insert({
              owner_id: userId,
              name: details.shopName || 'Vendor Shop',
              owner_name: details.name,
              location: details.location,
              phone: formattedPhone,
              document_url: details.documentUrl || null,
              is_approved: false
            })
          }
        }
      }
    } catch (e) {
      console.warn('Error saving profile / shop setup:', e)
    }

    setUser(newUser)
    localStorage.setItem('innaikku_user_session', JSON.stringify(newUser))
    setAuthState('AUTHENTICATED')
  }

  const loginAsDemoRole = async (roleType) => {
    setAuthError('')
    setAuthState('LOADING')

    let phoneNum = ''
    if (roleType === 'admin') phoneNum = '0000000000'
    else if (roleType === 'customer') phoneNum = '+919876543211'
    else if (roleType === 'vendor_approved') phoneNum = '+919999999999'
    else if (roleType === 'vendor_pending') phoneNum = '+919999999901'

    try {
      const supabase = await getSupabase()
      let profile = null

      if (supabase) {
        // Fetch profile
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('phone', phoneNum)
          .maybeSingle()
        profile = data

        if (!profile) {
          const mockId = `demo-${roleType}-${Date.now().toString().slice(-6)}`
          const isApproved = roleType !== 'vendor_pending'
          const role = roleType.startsWith('vendor') ? 'vendor' : roleType
          const newProfile = {
            id: mockId,
            phone: phoneNum,
            role: role,
            full_name: roleType === 'customer' ? 'Demo Customer' : roleType === 'admin' ? 'System Admin' : roleType === 'vendor_approved' ? 'Approved Vendor' : 'Pending Vendor',
            is_approved: isApproved,
            location: 'Hosur Main Road',
            preferred_language: 'ta'
          }

          const { data: insertedData, error } = await supabase
            .from('profiles')
            .insert(newProfile)
            .select()
            .single()

          if (!error && insertedData) {
            profile = insertedData
          }

          if (role === 'vendor') {
            await supabase.from('shops').insert({
              owner_id: profile ? profile.id : mockId,
              name: roleType === 'vendor_approved' ? 'Hosur Electronics Hub' : 'Hosur Pending Store',
              owner_name: profile ? profile.full_name : 'Vendor Owner',
              location: 'Denkanikottai Road, Hosur',
              phone: phoneNum,
              is_approved: isApproved
            })
          }
        } else {
          // Sync role in DB profiles in case of role mismatch
          const correctRole = roleType.startsWith('vendor') ? 'vendor' : roleType
          const correctApproval = roleType !== 'vendor_pending'
          if (profile.role !== correctRole || profile.is_approved !== correctApproval) {
            const { data: updatedProfile } = await supabase
              .from('profiles')
              .update({ role: correctRole, is_approved: correctApproval })
              .eq('id', profile.id)
              .select()
              .single()
            if (updatedProfile) profile = updatedProfile

            if (correctRole === 'vendor') {
              await supabase
                .from('shops')
                .update({ is_approved: correctApproval })
                .eq('owner_id', profile.id)
            }
          }
        }
      }

      if (!profile) {
        profile = {
          id: `demo-${roleType}`,
          phone: phoneNum,
          role: roleType.startsWith('vendor') ? 'vendor' : roleType,
          full_name: roleType === 'customer' ? 'Demo Customer' : roleType === 'admin' ? 'System Admin' : roleType === 'vendor_approved' ? 'Approved Vendor' : 'Pending Vendor',
          is_approved: roleType !== 'vendor_pending',
          location: 'Hosur Main Road',
          preferred_language: 'ta'
        }
      }

      const authenticatedUser = {
        id: profile.id,
        phone: profile.phone,
        role: profile.role,
        name: profile.full_name || 'Demo User',
        lang: profile.preferred_language || 'ta',
        location: profile.location || 'Hosur',
        is_approved: profile.is_approved
      }

      setUser(authenticatedUser)
      localStorage.setItem('innaikku_user_session', JSON.stringify(authenticatedUser))
      setAuthState('AUTHENTICATED')
      return true
    } catch (e) {
      console.error('Error logging in as demo role:', e)
      setAuthError('Failed to login as demo role')
      setAuthState('PHONE')
      return false
    }
  }

  const logout = async () => {
    try {
      const supabase = await getSupabase()
      if (supabase) {
        await supabase.auth.signOut()
      }
    } catch (e) {
      console.warn('Supabase signOut notice:', e)
    }

    localStorage.removeItem('innaikku_user_session')
    setUser(null)
    setAuthState('PHONE')
  }

  return (
    <AuthContext.Provider value={{
      user,
      authState,
      pendingPhone,
      authError,
      startPhoneAuth,
      verifyOtp,
      completeSetup,
      logout,
      loginAsDemoRole
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
