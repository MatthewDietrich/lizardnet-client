import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { timingSafeEqual } from 'crypto'

const s3 = new S3Client({
  region: 'us-east-2',
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const BUCKET = 'lizardnet-media'
const BUCKET_URL = 'https://lizardnet-media.s3.amazonaws.com/'

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
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event
  const { url } = body

  if (!url || !url.startsWith(BUCKET_URL)) {
    return {
      statusCode: 400,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Invalid URL' }),
    }
  }

  const key = url.slice(BUCKET_URL.length)

  // Must be a UUID filename with a known extension — no path traversal
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\w+$/.test(key)) {
    return {
      statusCode: 400,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Invalid key' }),
    }
  }

  const authHeader = event.headers?.Authorization ?? event.headers?.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const expected = process.env.ADMIN_TOKEN ?? ''
  const valid = token.length > 0 && expected.length > 0 && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  if (!valid) {
    return {
      statusCode: 403,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Not authorized' }),
    }
  }

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))

  return {
    statusCode: 200,
    headers: corsHeaders(event),
    body: JSON.stringify({ deleted: key }),
  }
}
