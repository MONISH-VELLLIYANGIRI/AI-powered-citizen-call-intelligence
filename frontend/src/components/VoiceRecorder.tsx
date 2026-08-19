import { useState, useRef, useCallback, useEffect } from 'react'
import { transcribeChunk } from '../api/client'

type RecorderState = 'idle' | 'recording' | 'processing_final' | 'review' | 'error'

interface VoiceRecorderProps {
  onTranscriptReady: (transcript: string) => void
}

const MAX_RECORDING_SECONDS = 90

export default function VoiceRecorder({ onTranscriptReady }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [editableTranscript, setEditableTranscript] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(MAX_RECORDING_SECONDS)
  const [, setIsProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const recognitionRef = useRef<any>(null)
  const speechTranscriptRef = useRef<string>('')
  const isRecordingRef = useRef<boolean>(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEverything()
    }
  }, [])

  const stopEverything = () => {
    isRecordingRef.current = false
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {}
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
  }

  // Draw audio level visualization
  const drawVisualizer = useCallback(() => {
    const analyser = analyserRef.current
    const canvas = canvasRef.current
    if (!analyser || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      if (!isRecordingRef.current) return
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      ctx.fillStyle = '#f0f4f8'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight)
        gradient.addColorStop(0, '#3b82f6')
        gradient.addColorStop(1, '#ef4444')
        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight)
        x += barWidth + 1
        if (x > canvas.width) break
      }
    }
    draw()
  }, [])

  const startRecording = async () => {
    setErrorMsg('')
    setLiveTranscript('')
    speechTranscriptRef.current = ''
    setSecondsLeft(MAX_RECORDING_SECONDS)
    chunksRef.current = []
    isRecordingRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up audio analyser for visualizer
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // Determine supported mimeType
      let mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '' // Let browser choose
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.start(1000)

      // Start Web Speech API for real-time live transcription if available
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition()
          recognition.continuous = true
          recognition.interimResults = true
          recognition.lang = 'en-US'

          recognition.onresult = (event: any) => {
            let current = ''
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript
            }
            speechTranscriptRef.current = current
            setLiveTranscript(current)
          }

          recognition.onerror = (event: any) => {
            console.warn('Speech recognition error:', event.error)
          }

          recognition.onend = () => {
            // Keep restarting recognition while recording state is active
            if (isRecordingRef.current && recognitionRef.current) {
              try {
                recognition.start()
              } catch {}
            }
          }

          recognition.start()
          recognitionRef.current = recognition
        } catch (e) {
          console.warn('Failed to start Web Speech API:', e)
        }
      }

      setState('recording')
      drawVisualizer()

      // Countdown timer
      let remaining = MAX_RECORDING_SECONDS
      countdownRef.current = setInterval(() => {
        remaining -= 1
        setSecondsLeft(remaining)
        if (remaining <= 0) {
          doStopRecording()
        }
      }, 1000)

    } catch (err: any) {
      isRecordingRef.current = false
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone access denied — you can still type your complaint below.')
      } else {
        setErrorMsg(`Microphone error: ${err.message}`)
      }
      setState('error')
    }
  }

  const doStopRecording = async () => {
    isRecordingRef.current = false

    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }

    // Stop Web Speech API
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }

    // Stop recorder
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {}
    }

    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }

    setState('processing_final')
    setIsProcessing(true)

    // Brief delay to allow final ondataavailable to fire
    await new Promise(resolve => setTimeout(resolve, 600))

    let finalTranscript = speechTranscriptRef.current.trim()

    // If Web Speech API transcript is short or missing, process full audio recording with backend STT
    if (!finalTranscript || finalTranscript.length < 5) {
      if (chunksRef.current.length > 0) {
        const fullAudioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (fullAudioBlob.size > 200) {
          try {
            const sttResult = await transcribeChunk(fullAudioBlob)
            if (sttResult.text && sttResult.text.trim()) {
              finalTranscript = sttResult.text.trim()
            }
          } catch (e) {
            console.error('Backend audio transcription error:', e)
          }
        }
      }
    }

    setIsProcessing(false)
    setLiveTranscript(finalTranscript)
    setEditableTranscript(finalTranscript)
    setState('review')
  }

  const handleConfirm = () => {
    if (editableTranscript.trim()) {
      onTranscriptReady(editableTranscript.trim())
      setState('idle')
      setLiveTranscript('')
      setEditableTranscript('')
    }
  }

  const handleCancel = () => {
    stopEverything()
    setState('idle')
    setLiveTranscript('')
    setEditableTranscript('')
    setErrorMsg('')
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Mic Button */}
      {state === 'idle' && (
        <button
          className="btn btn-secondary"
          onClick={startRecording}
          type="button"
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center' }}
        >
          <span style={{ fontSize: '1.3rem' }}>🎙️</span>
          Record Voice Complaint
        </button>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: '0.85rem' }}>
          {errorMsg}
          <button className="btn btn-secondary btn-sm" type="button" onClick={handleCancel} style={{ marginTop: 8, display: 'block' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Recording state */}
      {state === 'recording' && (
        <div className="card" style={{ border: '2px solid #ef4444' }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="recording-dot" style={{
                  width: 12, height: 12, borderRadius: '50%', background: '#ef4444',
                  display: 'inline-block',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
                <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.9rem' }}>Recording...</span>
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '4px 12px', borderRadius: 999 }}>
                {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')} remaining
              </span>
            </div>

            {/* Audio visualizer */}
            <canvas
              ref={canvasRef}
              width={500}
              height={60}
              style={{ width: '100%', height: 60, borderRadius: 8, background: '#f0f4f8', marginBottom: 12 }}
            />

            {/* Live transcript */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Transcript (live)
                </label>
              </div>
              <div style={{
                minHeight: 60, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 8, fontSize: '0.9rem', color: liveTranscript ? '#334155' : '#94a3b8',
                lineHeight: 1.6, fontStyle: liveTranscript ? 'normal' : 'italic',
              }}>
                {liveTranscript || 'Listening... speak your complaint clearly.'}
              </div>
            </div>

            <button
              className="btn btn-primary"
              type="button"
              onClick={doStopRecording}
              style={{ width: '100%' }}
            >
              ⏹️ Stop & Review Transcript
            </button>
          </div>
        </div>
      )}

      {/* Processing final chunk */}
      {state === 'processing_final' && (
        <div className="card">
          <div className="card-body loading-overlay" style={{ padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div className="spinner" />
            <span>Transcribing full audio recording...</span>
          </div>
        </div>
      )}

      {/* Review state */}
      {state === 'review' && (
        <div className="card" style={{ border: '2px solid #3b82f6' }}>
          <div className="card-body">
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
                📝 Review your complaint — edit if needed
              </label>
              <textarea
                value={editableTranscript}
                onChange={e => setEditableTranscript(e.target.value)}
                style={{
                  width: '100%', minHeight: 100, padding: '12px 14px', border: '1px solid #e2e8f0',
                  borderRadius: 8, fontSize: '0.9rem', fontFamily: "'Inter', sans-serif",
                  resize: 'vertical',
                }}
                placeholder="Your transcribed complaint will appear here..."
              />
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                Some words may need correction due to speech recognition. Please review before submitting.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleConfirm}
                disabled={!editableTranscript.trim()}
                style={{ flex: 1 }}
              >
                ✅ Use This Transcript
              </button>
              <button className="btn btn-secondary" type="button" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for pulsing dot animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}

