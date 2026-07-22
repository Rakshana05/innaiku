import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { uploadVendorDocument } from '../../services/supabase'
import { UserCheck, Store, User, MapPin, Navigation, FileText, Upload, CheckCircle2, ShieldCheck, AlertCircle, Loader2, X } from 'lucide-react'

export function AccountSetup() {
  const { pendingPhone, completeSetup } = useAuth()
  const [role, setRole] = useState('customer')
  const [name, setName] = useState('')
  const [lang, setLang] = useState('ta')
  const [location, setLocation] = useState('')
  const [shopName, setShopName] = useState('')
  
  // File Upload State for Vendor Proof
  const [file, setFile] = useState(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState('')
  const [fileError, setFileError] = useState('')

  // Geolocation state
  const [detectingLoc, setDetectingLoc] = useState(false)
  const [locStatus, setLocStatus] = useState('')

  // Handle current location detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus('Geolocation is not supported by your browser.')
      return
    }
    setDetectingLoc(true)
    setLocStatus('Detecting GPS location...')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        try {
          // Attempt reverse geocoding
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
          if (res.ok) {
            const data = await res.json()
            const displayStr = data.display_name || `${data.address?.suburb || data.address?.city || 'Hosur'} (${lat.toFixed(4)}, ${lon.toFixed(4)})`
            setLocation(displayStr)
            setLocStatus('Location detected!')
          } else {
            setLocation(`Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`)
            setLocStatus('GPS coordinates fetched!')
          }
        } catch (e) {
          setLocation(`GPS Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`)
          setLocStatus('GPS coordinates set!')
        }
        setDetectingLoc(false)
        setTimeout(() => setLocStatus(''), 3000)
      },
      (err) => {
        console.warn('Geolocation error:', err)
        setLocStatus('Unable to retrieve location. Please enter manually.')
        setDetectingLoc(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // Handle file selection and upload
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFileError('')
    // Max size 10MB
    if (selectedFile.size > 10 * 1024 * 1024) {
      setFileError('File size exceeds 10MB limit. Please upload a smaller file.')
      return
    }

    setFile(selectedFile)
    setUploadingFile(true)

    try {
      const docUrl = await uploadVendorDocument(selectedFile)
      if (docUrl) {
        setUploadedUrl(docUrl)
        setFileError('')
      } else {
        setFileError('File upload failed. Please try again.')
      }
    } catch (err) {
      console.error('Error uploading file:', err)
      setFileError('Upload error. Please try selecting the file again.')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setUploadedUrl('')
    setFileError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (role === 'vendor' && !uploadedUrl && !file) {
      setFileError('Please upload a document of proof for vendor registration.')
      return
    }

    let docUrl = uploadedUrl
    if (role === 'vendor' && file && !docUrl) {
      setUploadingFile(true)
      docUrl = await uploadVendorDocument(file)
      setUploadingFile(false)
    }

    completeSetup({
      role,
      name,
      lang,
      location: location || 'Hosur Main Road',
      shopName: role === 'vendor' ? shopName : '',
      documentUrl: role === 'vendor' ? docUrl : '',
      phone: pendingPhone
    })
  }

  const formattedPhoneDisplay = pendingPhone ? (pendingPhone.startsWith('+') ? pendingPhone : `+91 ${pendingPhone}`) : '+91 Verified'

  return (
    <div className="glass-card" style={{ marginTop: '16px', padding: '24px 18px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', fontWeight: '800', marginBottom: '6px', color: '#f8fafc' }}>
          Complete Account Setup
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Choose your account type to personalize your experience
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Role Choice Pills */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            type="button"
            className={`btn-secondary ${role === 'customer' ? 'active' : ''}`}
            onClick={() => {
              setRole('customer')
              setFileError('')
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 8px',
              border: role === 'customer' ? '1px solid #6366f1' : '1px solid var(--border-color)',
              background: role === 'customer' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255,255,255,0.04)',
              borderRadius: '12px'
            }}
          >
            <User size={18} color={role === 'customer' ? '#818cf8' : '#94a3b8'} />
            <span style={{ color: role === 'customer' ? '#f8fafc' : '#94a3b8', fontWeight: '700', fontSize: '0.9rem' }}>Customer</span>
          </button>

          <button
            type="button"
            className={`btn-secondary ${role === 'vendor' ? 'active' : ''}`}
            onClick={() => {
              setRole('vendor')
              setFileError('')
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 8px',
              border: role === 'vendor' ? '1px solid #a855f7' : '1px solid var(--border-color)',
              background: role === 'vendor' ? 'rgba(168, 85, 247, 0.18)' : 'rgba(255,255,255,0.04)',
              borderRadius: '12px'
            }}
          >
            <Store size={18} color={role === 'vendor' ? '#c084fc' : '#94a3b8'} />
            <span style={{ color: role === 'vendor' ? '#f8fafc' : '#94a3b8', fontWeight: '700', fontSize: '0.9rem' }}>Vendor</span>
          </button>
        </div>

        {/* Contact Phone (OTP Verified Badge) */}
        <div style={{ marginBottom: '14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={13} /> Verified Contact Number
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#f8fafc', marginTop: '2px', display: 'block' }}>
              {formattedPhoneDisplay}
            </span>
          </div>
          <span style={{ background: '#10b981', color: '#000', fontSize: '0.65rem', fontWeight: '800', padding: '2px 8px', borderRadius: '12px' }}>
            OTP Verified
          </span>
        </div>

        {/* Name Input */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
            {role === 'vendor' ? 'Shop Owner Name *' : 'Full Name / Username *'}
          </label>
          <input
            type="text"
            className="input-field"
            placeholder={role === 'vendor' ? 'e.g. S. Murugan' : 'e.g. Priya R'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Vendor Shop Name */}
        {role === 'vendor' && (
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Shop Name *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Hosur Organic & General Store"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
            />
          </div>
        )}

        {/* Current Location Field + Geolocation Detector */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)' }}>
              {role === 'vendor' ? 'Store Location Address *' : 'Current Location *'}
            </label>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={detectingLoc}
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#818cf8',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '0.7rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {detectingLoc ? <Loader2 size={12} className="spin" /> : <Navigation size={12} />}
              {detectingLoc ? 'Detecting...' : '📍 Use Current Location'}
            </button>
          </div>

          <div style={{ relative: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder={role === 'vendor' ? 'e.g. Denkanikottai Road, Hosur' : 'e.g. Mathigiri Road, Hosur'}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          {locStatus && (
            <div style={{ fontSize: '0.72rem', color: locStatus.includes('Unable') ? '#f59e0b' : '#10b981', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} /> {locStatus}
            </div>
          )}
        </div>

        {/* Vendor Document of Proof Upload Field */}
        {role === 'vendor' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Document of Proof (GST / FSSAI / ID Proof / Trade License) *
            </label>

            {!file && (
              <div
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '20px 14px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => document.getElementById('proof-file-input').click()}
              >
                <Upload size={24} color="#a5b4fc" style={{ marginBottom: '6px' }} />
                <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#f8fafc' }}>
                  Click to select or upload proof document
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  PDF, JPG, PNG, WEBP, or DOCX (Max 10MB)
                </div>
                <input
                  id="proof-file-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            )}

            {/* Selected / Uploading / Uploaded File Card */}
            {file && (
              <div style={{
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={22} color="#c084fc" />
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#f8fafc', display: 'block', wordBreak: 'break-all' }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {(file.size / 1024).toFixed(1)} KB • {uploadingFile ? 'Uploading to Supabase storage...' : (uploadedUrl ? 'Uploaded to Supabase Storage ✓' : 'Ready')}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {uploadingFile ? (
                    <Loader2 size={16} color="#c084fc" className="spin" />
                  ) : uploadedUrl ? (
                    <CheckCircle2 size={18} color="#10b981" />
                  ) : null}

                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {fileError && (
              <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={13} /> {fileError}
              </div>
            )}
          </div>
        )}

        {/* AI Voice Preferred Language */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Preferred AI Voice Language
          </label>
          <select
            className="input-field"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            <option value="ta" style={{ background: '#13112b' }}>Tamil (தமிழ்)</option>
            <option value="en" style={{ background: '#13112b' }}>English</option>
            <option value="te" style={{ background: '#13112b' }}>Telugu (తెలుగు)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={uploadingFile}
          className="btn-primary"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            opacity: uploadingFile ? 0.7 : 1
          }}
        >
          {uploadingFile ? (
            <>
              <Loader2 size={18} className="spin" /> Uploading Document...
            </>
          ) : (
            <>
              Save & Start Using App <UserCheck size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  )
}
