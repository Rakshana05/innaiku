import { useState, useRef, useCallback, useEffect } from 'react'

class AudioQueuePlayer {
  constructor(sampleRate = 16000) {
    this.sampleRate = sampleRate
    this.audioCtx = null
    this.nextStartTime = 0
  }
  isBufferPlaying() {
    if (!this.audioCtx) return false
    return this.audioCtx.currentTime < this.nextStartTime
  }
  init() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    this.nextStartTime = 0
  }
  playChunk(int16Array) {
    if (!this.audioCtx) this.init()
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume()
    }
    const float32 = new Float32Array(int16Array.length)
    for (let i = 0; i < int16Array.length; i++) {
      float32[i] = int16Array[i] / 32768.0
    }
    const buffer = this.audioCtx.createBuffer(1, float32.length, this.sampleRate)
    buffer.copyToChannel(float32, 0)
    const source = this.audioCtx.createBufferSource()
    source.buffer = buffer
    source.connect(this.audioCtx.destination)
    const currentTime = this.audioCtx.currentTime
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime
    }
    source.start(this.nextStartTime)
    this.nextStartTime += buffer.duration
  }
  stop() {
    this.nextStartTime = 0
    if (this.audioCtx) {
      this.audioCtx.close().catch(e => console.error(e))
      this.audioCtx = null
    }
  }
}

export function useVoiceAgent(user) {
  const [isConnected, setIsConnected] = useState(false)
  const [voiceState, setVoiceState] = useState('disconnected') // 'disconnected', 'connected', 'listening', 'thinking', 'speaking', 'querying'
  const [userTranscript, setUserTranscript] = useState('')
  const [botTranscript, setBotTranscript] = useState('')
  const [tickerText, setTickerText] = useState('System ready. Tap Mic to talk in Tamil/English/Telugu.')

  const wsRef = useRef(null)
  const audioCtxRef = useRef(null)
  const micStreamRef = useRef(null)
  const processorRef = useRef(null)
  const playerRef = useRef(null)
  const speakTimeoutRef = useRef(null)

  const stopVoiceSession = useCallback(() => {
    setIsConnected(false)
    setVoiceState('disconnected')
    setTickerText('Session stopped.')

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(e => console.error(e))
      audioCtxRef.current = null
    }
    if (playerRef.current) {
      playerRef.current.stop()
      playerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const startVoiceSession = useCallback(async () => {
    if (!user) return
    
    setTickerText('Connecting voice session...')
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const lang = user.lang || 'ta'
    
    // WebSockets URL connecting to FastAPI backend
    const wsUrl = `${protocol}//${host}/ws?mode=${user.role}&user_id=${user.id}&phone=${encodeURIComponent(user.phone || '')}&lang=${lang}`

    try {
      const ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      playerRef.current = new AudioQueuePlayer(16000)

      ws.onopen = async () => {
        setIsConnected(true)
        setVoiceState('connected')
        setTickerText('Microphone active. Speak in Tamil, English, or Telugu...')
        await setupMicrophone(ws)
      }

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const int16Array = new Int16Array(event.data)
          setVoiceState('speaking')
          if (playerRef.current) playerRef.current.playChunk(int16Array)

          clearTimeout(speakTimeoutRef.current)
          speakTimeoutRef.current = setTimeout(() => {
            setVoiceState('listening')
          }, 850)
        } else {
          try {
            const msg = JSON.parse(event.data)
            if (msg.event === 'tool_calling') {
              setVoiceState('querying')
              setTickerText(`⚙️ Database Action: [${msg.tool}] ${JSON.stringify(msg.args)}`)
            } else if (msg.event === 'user_transcription') {
              setUserTranscript(msg.text)
              setBotTranscript('...thinking...')
              setVoiceState('thinking')
            } else if (msg.event === 'bot_transcription') {
              setBotTranscript(prev => (prev === '...thinking...' ? '' : prev) + ' ' + msg.text)
            } else if (['wishlist_updated', 'catalog_updated', 'offer_updated', 'shop_updated'].includes(msg.event)) {
              setTickerText(`⭐ Database Synced: ${msg.event.replace('_', ' ')}`)
            }
          } catch (e) {
            console.error('WS Parse error:', e)
          }
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err)
        setTickerText('Voice session error.')
        stopVoiceSession()
      }

      ws.onclose = () => {
        stopVoiceSession()
      }
    } catch (e) {
      console.error('Connection error:', e)
      setTickerText('Failed to connect to voice server.')
    }
  }, [user, stopVoiceSession])

  const setupMicrophone = async (ws) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
      audioCtxRef.current = audioContext

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      micStreamRef.current = micStream

      const source = audioContext.createMediaStreamSource(micStream)
      const bufferSize = 2048
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return
        if (playerRef.current && playerRef.current.isBufferPlaying()) return

        const inputBuffer = e.inputBuffer.getChannelData(0)
        const pcm16Data = new Int16Array(inputBuffer.length)
        for (let i = 0; i < inputBuffer.length; i++) {
          let val = inputBuffer[i] * 32767
          pcm16Data[i] = Math.max(-32768, Math.min(32767, val))
        }
        ws.send(pcm16Data.buffer)
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
      setVoiceState('listening')
    } catch (err) {
      console.error('Microphone error:', err)
      setTickerText(`Microphone error: ${err.message}`)
      stopVoiceSession()
    }
  }

  const toggleVoice = () => {
    if (isConnected) {
      stopVoiceSession()
    } else {
      startVoiceSession()
    }
  }

  useEffect(() => {
    return () => {
      stopVoiceSession()
    }
  }, [stopVoiceSession])

  return {
    isConnected,
    voiceState,
    userTranscript,
    botTranscript,
    tickerText,
    toggleVoice
  }
}
