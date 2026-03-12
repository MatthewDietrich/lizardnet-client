export const BUCKET_URL = 'https://lizardnet-media.s3.amazonaws.com'
const PRESIGN_ENDPOINT = 'https://yw76re20g8.execute-api.us-east-2.amazonaws.com/prod/presign'
const MAX_SIZE = 50 * 1024 * 1024

export async function uploadToS3(file: File, onProgress?: (pct: number) => void): Promise<string> {
  if (file.size > MAX_SIZE) throw new Error('File too large (max 50MB)')

  const token = import.meta.env.VITE_UPLOAD_TOKEN
  const res = await fetch(PRESIGN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  })
  if (!res.ok) throw new Error('Could not get upload URL')
  const { uploadUrl, publicUrl } = await res.json()

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
