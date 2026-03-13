export const BUCKET_URL = 'https://lizardnet-media.s3.amazonaws.com'
const PRESIGN_ENDPOINT = 'https://yw76re20g8.execute-api.us-east-2.amazonaws.com/prod/presign'

export type BotRequest = (cmd: string) => Promise<string>

const uploadedKey = (url: string) => `media_uploaded:${url}`

export function hasUploadedUrl(url: string): boolean {
  return !!localStorage.getItem(uploadedKey(url))
}

export async function uploadToS3(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const MAX_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_SIZE) throw new Error('File too large (max 50MB)')

  const res = await fetch(PRESIGN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error ?? 'Could not get upload URL')
  }
  const { uploadUrl, publicUrl } = await res.json()

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
