/**
 * Gera WAVs curtos de placeholder (tom) para testar o app
 * até os áudios reais do Bradley estarem prontos.
 *
 * Uso: node scripts/generate-placeholders.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..', 'public', 'audios')

const files = [
  ['letras', 'a.wav', 440],
  ['letras', 'b.wav', 494],
  ['letras', 'c.wav', 523],
  ['silabas', 'ba.wav', 392],
  ['silabas', 'be.wav', 415],
  ['palavras', 'casa.wav', 349],
  ['palavras', 'gato.wav', 330],
  ['frases', 'frase-01.wav', 294],
]

function writeToneWav(filePath, frequencyHz, durationMs = 450) {
  const sampleRate = 22050
  const numSamples = Math.floor((sampleRate * durationMs) / 1000)
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const envelope = Math.min(1, i / 800) * Math.min(1, (numSamples - i) / 1200)
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * 0.35 * envelope
    const intSample = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)))
    buffer.writeInt16LE(intSample, 44 + i * 2)
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, buffer)
}

for (const [folder, name, freq] of files) {
  const target = path.join(root, folder, name)
  writeToneWav(target, freq)
  console.log('ok', path.relative(path.join(__dirname, '..'), target))
}

console.log('Placeholders gerados em public/audios/')
