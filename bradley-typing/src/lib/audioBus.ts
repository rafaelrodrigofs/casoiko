const BGM_TRACKS = [
  encodeURI('audios/Loop de Pixel.mp3'),
  encodeURI('audios/Loop de Pixel 2.mp3'),
  encodeURI('audios/Pixelado Relax.mp3'),
  encodeURI('audios/Pixelado Relax (1).mp3'),
  encodeURI('audios/Pixelado Relax (2).mp3'),
  encodeURI('audios/Pixelado Relax (3).mp3'),
]

/** Volume no menu */
const BGM_MENU_VOLUME = 0.18
/** Volume durante a lição (entre as falas) */
const BGM_LESSON_VOLUME = 0.06
/** Volume enquanto a letra está falando */
const BGM_DUCK_VOLUME = 0.015

class AudioBus {
  private bgm: HTMLAudioElement | null = null
  private duckDepth = 0
  private inLesson = false
  private started = false
  private currentTrack: string | null = null

  private pickTrack(avoid?: string | null): string {
    if (BGM_TRACKS.length === 1) return BGM_TRACKS[0]

    const options =
      avoid && BGM_TRACKS.length > 1
        ? BGM_TRACKS.filter((t) => t !== avoid)
        : BGM_TRACKS

    return options[Math.floor(Math.random() * options.length)]
  }

  private ensureBgm(): HTMLAudioElement {
    if (!this.bgm) {
      this.bgm = new Audio()
      this.bgm.loop = false
      this.bgm.volume = BGM_MENU_VOLUME
      this.bgm.preload = 'auto'
      this.bgm.addEventListener('ended', () => {
        if (!this.started) return
        void this.playRandomTrack(true)
      })
    }
    return this.bgm
  }

  private baseVolume(): number {
    return this.inLesson ? BGM_LESSON_VOLUME : BGM_MENU_VOLUME
  }

  private applyVolume() {
    if (!this.bgm) return
    this.bgm.volume = this.duckDepth > 0 ? BGM_DUCK_VOLUME : this.baseVolume()
  }

  private async playRandomTrack(avoidCurrent: boolean): Promise<void> {
    const audio = this.ensureBgm()
    const track = this.pickTrack(avoidCurrent ? this.currentTrack : null)
    this.currentTrack = track
    audio.src = track
    audio.currentTime = 0
    this.applyVolume()
    try {
      await audio.play()
    } catch {
      // Autoplay bloqueado — próximo gesto tenta de novo.
    }
  }

  /** Inicia a música ambiente (escolhe uma faixa aleatória). */
  async startBgm(): Promise<void> {
    this.started = true
    const audio = this.ensureBgm()
    if (!audio.paused && this.currentTrack) {
      this.applyVolume()
      return
    }
    await this.playRandomTrack(false)
  }

  stopBgm(): void {
    if (!this.bgm) return
    this.bgm.pause()
    this.bgm.currentTime = 0
    this.started = false
    this.duckDepth = 0
    this.inLesson = false
    this.currentTrack = null
    this.applyVolume()
  }

  /** Abaixa a base da música enquanto estiver na tela de exercício. */
  setLessonMode(enabled: boolean): void {
    this.inLesson = enabled
    this.applyVolume()
  }

  isStarted(): boolean {
    return this.started
  }

  duck(): void {
    this.duckDepth += 1
    this.applyVolume()
  }

  unduck(): void {
    this.duckDepth = Math.max(0, this.duckDepth - 1)
    this.applyVolume()
  }
}

export const audioBus = new AudioBus()
