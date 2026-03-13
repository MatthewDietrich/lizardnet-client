export const BUCKET_URL = 'https://lizardnet-media.s3.amazonaws.com'
const PRESIGN_ENDPOINT = 'https://yw76re20g8.execute-api.us-east-2.amazonaws.com/prod/presign'
const DELETE_ENDPOINT = 'https://yw76re20g8.execute-api.us-east-2.amazonaws.com/prod/delete'

const tokenKey = (url: string) => `media_delete_token:${url}`

export function getDeleteToken(url: string): string | null {
  return localStorage.getItem(tokenKey(url))
}

export async function deleteFromS3(url: string): Promise<void> {
  const bearerToken = import.meta.env.VITE_UPLOAD_TOKEN
  const deleteToken = getDeleteToken(url)
  if (!bearerToken && !deleteToken) throw new Error('Not authorized to delete this file')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`
  const res = await fetch(DELETE_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url, ...(deleteToken && { deleteToken }) }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error ?? 'Delete failed')
  }
  localStorage.removeItem(tokenKey(url))
}

const MAX_SIZE = 50 * 1024 * 1024

export async function uploadToS3(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (file.size > MAX_SIZE) throw new Error('File too large (max 50MB)')

  const token = import.meta.env.VITE_UPLOAD_TOKEN
  if (!token) throw new Error('VITE_UPLOAD_TOKEN is not set')
  const res = await fetch(PRESIGN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error ?? 'Could not get upload URL')
  }
  const { uploadUrl, publicUrl, deleteToken } = await res.json()
  if (deleteToken) localStorage.setItem(tokenKey(publicUrl), deleteToken)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100))
    }
    xhr.onload = () => xhr.status === 200 ? resolve(publicUrl) : reject(new Error(`Upload failed (${xhr.status})`))
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(file)
  })
}
