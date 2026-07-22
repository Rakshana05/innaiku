import React from 'react'
import { useVoiceAgent } from '../../hooks/useVoiceAgent'
import { Mic, Square, Sparkles, Volume2, Database } from 'lucide-react'

export function AIVoicePage({ user }) {
  const {
    isConnected,
    voiceState,
    userTranscript,
    botTranscript,
    tickerText,
    toggleVoice
  } = useVoiceAgent(user)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '520px', justifyContent: 'space-between' }}>
      
      {/* Header Info */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', fontWeight: '800', marginBottom: '4px' }}>
          Innaikku AI Voice Assistant
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Speak in <strong>Tamil (தமிழ்)</strong>, <strong>English</strong>, or <strong>Telugu (తెలుగు)</strong>
        </p>
      </div>

      {/* Visualizer & Mic Section */}
      <div className="voice-visualizer-container">
        <div className="visualizer-wrapper-large">
          <div className="outer-ring-large"></div>
          <div className="glow-ring-large" style={{
            transform: voiceState === 'speaking' ? 'scale(1.3)' : voiceState === 'listening' ? 'scale(1.15)' : 'scale(1)',
            background: voiceState === 'speaking'
              ? 'radial-gradient(circle, rgba(168, 85, 247, 0.6) 0%, rgba(99, 102, 241, 0) 70%)'
              : voiceState === 'listening'
              ? 'radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, rgba(99, 102, 241, 0) 70%)'
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0) 70%)'
          }}></div>

          <button
            className="mic-button-large"
            onClick={toggleVoice}
            style={{
              background: isConnected
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #4f46e5, #7c3aed)'
            }}
          >
            {isConnected ? <Square size={38} color="#fff" /> : <Mic size={44} color="#fff" />}
          </button>
        </div>

        {/* State Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-color)',
          fontSize: '0.85rem',
          fontWeight: '600'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? (voiceState === 'speaking' ? '#c084fc' : voiceState === 'listening' ? '#3b82f6' : '#10b981') : '#94a3b8',
            boxShadow: '0 0 8px currentColor'
          }}></span>
          <span style={{ textTransform: 'capitalize' }}>
            {isConnected ? voiceState : 'Tap Mic to Start Voice'}
          </span>
        </div>
      </div>

      {/* Captions & Logs Console */}
      <div className="captions-box" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Volume2 size={14} color="#a5b4fc" /> Live Subtitles & Transcripts
          </span>
        </div>

        {/* User Captions */}
        <div className="caption-user">
          <span className="caption-label">You Spoke</span>
          <p className={`caption-text ${!userTranscript ? 'empty' : ''}`}>
            {userTranscript || '...waiting for speech...'}
          </p>
        </div>

        {/* Bot Captions */}
        <div className="caption-bot">
          <span className="caption-label">AI Agent Response</span>
          <p className={`caption-text ${!botTranscript ? 'empty' : ''}`}>
            {botTranscript || '...waiting for response...'}
          </p>
        </div>

        {/* DB Status Ticker */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderTop: '1px solid var(--border-color)',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          fontFamily: 'Courier New, Courier, monospace',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Database size={12} color="#f59e0b" />
          <span>{tickerText}</span>
        </div>
      </div>

    </div>
  )
}
