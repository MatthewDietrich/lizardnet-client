export const BUCKET_URL = 'https://lizardnet-media.s3.amazonaws.com'

export type BotRequest = (cmd: string) => Promise<string>

const uploadedKey = (url: string) => `media_uploaded:${url}`

export function hasUploadedUrl(url: string): boolean {
  return !!localStorage.getItem(uploadedKey(url))
}

export async function uploadToS3(file: File, botRequest: BotRequest, onProgress?: (pct: number) => void): Promise<string> {
  const MAX_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_SIZE) throw new Error('File too large (max 50MB)')

  // reply: "PRESIGN_OK <uploadUrl> <publicUrl>"
  const reply = await botRequest(`PRESIGN ${file.type}`)
  const rest = reply.slice('PRESIGN_OK '.length)
  const spaceIdx = rest.lastIndexOf(' ')
  if (spaceIdx < 0) throw new Error('Invalid bot response')
  const uploadUrl = rest.slice(0, spaceIdx)
  const publicUrl = rest.slice(spaceIdx + 1)

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100))
    }
    xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(file)
  })

  localStorage.setItem(uploadedKey(publicUrl), '1')
  return publicUrl
}

export async function deleteFromS3(url: string, botRequest: BotRequest): Promise<void> {
  await botRequest(`DELETE ${url}`)
  localStorage.removeItem(uploadedKey(url))
}
