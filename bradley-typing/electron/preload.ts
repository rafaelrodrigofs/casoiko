import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('bradleyTyping', {
  platform: process.platform,
})
