import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID, timingSafeEqual } from 'crypto'

const s3 = new S3Client({
  region: 'us-east-2',
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const ALLOWED_TYPES = {
  'image/jpeg':  'jpg',
  'image/png':   'png',
  'image/gif':   'gif',
  'image/webp':  'webp',
  'image/avif':  'avif',
  'image/heic':  'heic',
  'video/mp4':   'mp4',
  'video/webm':  'webm',
  'video/ogg':   'ogv',
  'video/quicktime': 'mov',
  'audio/mpeg':  'mp3',
  'audio/ogg':   'ogg',
  'audio/wav':   'wav',
  'audio/flac':  'flac',
  'audio/aac':   'aac',
  'audio/mp4':   'm4a',
  'audio/webm':  'weba',
}

const ALLOWED_ORIGINS = new Set([
  'https://irc.lizard.fun',
  'http://localhost:5173',
])

function corsHeaders(event) {
  const origin = event.headers?.Origin ?? event.headers?.origin ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }
}

export const handler = async (event) => {
  const authHeader = event.headers?.Authorization ?? event.headers?.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const expected = process.env.PRESIGN_TOKEN ?? ''
  const valid = token.length > 0 && expected.length > 0 && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  if (!valid) {
    return {
      statusCode: 403,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Not authorized' }),
    }
  }

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event
  const { contentType } = body

  const ext = ALLOWED_TYPES[contentType]
  if (!ext) {
    return {
      statusCode: 400,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: `Unsupported content type: ${contentType}` }),
    }
  }

  const key = `${randomUUID()}.${ext}`

  const url = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: 'lizardnet-media',
    Key: key,
    ContentType: contentType,
  }), { expiresIn: 300 })

  return {
    statusCode: 200,
    headers: corsHeaders(event),
    body: JSON.stringify({
      uploadUrl: url,
      publicUrl: `https://lizardnet-media.s3.amazonaws.com/${key}`,
    }),
  }
}
