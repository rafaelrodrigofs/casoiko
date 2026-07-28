import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { audioBus } from '../lib/audioBus'

export interface AutoAudioHandle {
  replay: () => void
}

interface AutoAudioProps {
  clip: string | null
  /** Muda a cada tecla (exerciseId + cursor) — sempre enfileira o próximo */
  playId: string
  /** Muda só ao trocar de exercício — aí reinicia a fila */
  exerciseId: string
}

/**
 * Não corta o áudio ao acertar a tecla: enfileira o próximo e toca quando o atual acabar.
 * Replay reinicia o clip atual.
 */
export const AutoAudio = forwardRef<AutoAudioHandle, AutoAudioProps>(
  function AutoAudio({ clip, playId, exerciseId }, ref) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [error, setError] = useState<string | null>(null)

    const queueRef = useRef<string[]>([])
    const busyRef = useRef(false)
    const duckedRef = useRef(false)
    const finishCurrentRef = useRef<(() => void) | null>(null)
    const clipRef = useRef(clip)
    const exerciseIdRef = useRef(exerciseId)
    const lastPlayIdRef = useRef<string | null>(null)

    clipRef.current = clip

    function applyDuck() {
      if (!duckedRef.current) {
        audioBus.duck()
        duckedRef.current = true
      }
    }

    function releaseDuck() {
      if (duckedRef.current) {
        audioBus.unduck()
        duckedRef.current = false
      }
    }

    function stopCurrentPlayback() {
      finishCurrentRef.current?.()
      finishCurrentRef.current = null
      const audio = audioRef.current
      if (audio) {
        audio.onended = null
        audio.onerror = null
        audio.pause()
      }
    }

    function playNext() {
      const audio = audioRef.current
      if (!audio) return

      if (queueRef.current.length === 0) {
        busyRef.current = false
        releaseDuck()
        return
      }

      const src = queueRef.current.shift()!
      busyRef.current = true
      applyDuck()
      setError(null)

      const done = () => {
        if (finishCurrentRef.current !== done) return
        finishCurrentRef.current = null
        audio.onended = null
        audio.onerror = null
        playNext()
      }
      finishCurrentRef.current = done

      audio.onended = done
      audio.onerror = () => {
        setError('Não foi possível tocar o áudio.')
        done()
      }
      audio.src = src
      audio.currentTime = 0
      void audio.play().catch(() => {
        setError('Não foi possível tocar o áudio.')
        done()
      })
    }

    function enqueue(src: string) {
      queueRef.current.push(src)
      if (!busyRef.current) {
        playNext()
      }
    }

    function hardPlay(src: string | null) {
      stopCurrentPlayback()
      queueRef.current = []
      busyRef.current = false
      releaseDuck()
      if (src) {
        enqueue(src)
      }
    }

    useImperativeHandle(ref, () => ({
      replay: () => hardPlay(clipRef.current),
    }))

    useEffect(() => {
      if (exerciseIdRef.current !== exerciseId) {
        exerciseIdRef.current = exerciseId
        lastPlayIdRef.current = playId
        hardPlay(clip)
        return
      }

      if (playId !== lastPlayIdRef.current) {
        lastPlayIdRef.current = playId
        if (clip) {
          enqueue(clip)
        }
      }
    }, [exerciseId, playId, clip])

    useEffect(() => {
      return () => {
        stopCurrentPlayback()
        queueRef.current = []
        busyRef.current = false
        releaseDuck()
      }
    }, [])

    return (
      <div className="auto-audio">
        <audio ref={audioRef} preload="auto" />
        <button
          type="button"
          className="btn-replay"
          onClick={() => hardPlay(clipRef.current)}
          title="Repetir áudio"
          aria-label="Repetir áudio"
          disabled={!clip}
        >
          <SpeakerIcon />
          <span>Repetir</span>
        </button>
        {error ? <p className="audio-error">{error}</p> : null}
      </div>
    )
  },
)

function SpeakerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}
