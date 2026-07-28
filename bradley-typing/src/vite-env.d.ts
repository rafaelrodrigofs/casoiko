/// <reference types="vite/client" />

interface BradleyTypingApi {
  platform: NodeJS.Platform
}

interface Window {
  bradleyTyping?: BradleyTypingApi
}
