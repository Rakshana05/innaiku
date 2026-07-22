import { createClient } from '@supabase/supabase-js'

let supabaseInstance = null

// Fallback credentials in case /config endpoint is offline
const HARDCODED_SUPABASE_URL = 'https://mmslmsfhyeflksnpxlyg.supabase.co'
const HARDCODED_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tc2xtc2ZoeWVmbGtzbnB4bHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwODI2NTQsImV4cCI6MjA2NzY1ODY1NH0.rYI_U9eU3B9V6X_T7Z3Z0H6zX-3A9Y4B0C1D2E3F4G5'

export async function getSupabase() {
  if (supabaseInstance) return supabaseInstance

  try {
    const res = await fetch('/config')
    if (res.ok) {
      const config = await res.json()
      if (config.supabase_url && config.supabase_anon_key) {
        supabaseInstance = createClient(config.supabase_url, config.supabase_anon_key)
        return supabaseInstance
      }
    }
  } catch (e) {
    console.warn('Failed to fetch /config endpoint. Using direct Supabase fallback credentials.', e)
  }

  // Direct fallback initialization
  try {
    const envUrl = import.meta.env?.VITE_SUPABASE_URL || HARDCODED_SUPABASE_URL
    const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || HARDCODED_SUPABASE_ANON_KEY
    supabaseInstance = createClient(envUrl, envKey)
    return supabaseInstance
  } catch (err) {
    console.error('Failed to initialize Supabase fallback client:', err)
  }

  return null
}

/**
 * File handling utility for uploading vendor proof documents.
 * Priority 1: Upload to Supabase Storage bucket 'vendor-documents'.
 * Priority 2: Fallback to backend API endpoint /api/upload-proof.
 * Priority 3: Base64 Data URL conversion fallback.
 */
export async function uploadVendorDocument(file) {
  if (!file) return null

  // 1. Try Supabase Storage upload
  try {
    const supabase = await getSupabase()
    if (supabase) {
      const fileExt = file.name.split('.').pop() || 'pdf'
      const fileName = `proof_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`
      const filePath = `documents/${fileName}`

      const { data, error } = await supabase.storage
        .from('vendor-documents')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('vendor-documents')
          .getPublicUrl(filePath)
        
        if (publicUrlData && publicUrlData.publicUrl) {
          console.log('Successfully uploaded vendor document to Supabase Storage:', publicUrlData.publicUrl)
          return publicUrlData.publicUrl
        }
      } else {
        console.warn('Supabase storage upload error, attempting backend upload fallback:', error)
      }
    }
  } catch (e) {
    console.warn('Supabase storage upload exception:', e)
  }

  // 2. Fallback: Backend API Upload endpoint /api/upload-proof
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload-proof', {
      method: 'POST',
      body: formData
    })
    if (res.ok) {
      const data = await res.json()
      if (data.url) {
        console.log('Successfully uploaded vendor document to backend endpoint:', data.url)
        return data.url
      }
    }
  } catch (e) {
    console.warn('Backend upload API fallback failed:', e)
  }

  // 3. Last Resort Fallback: Convert to Data URL (base64)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}
