import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  region: 'us-east-2',
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const BUCKET = 'lizardnet-media'
const BUCKET_URL = 'https://lizardnet-media.s3.amazonaws.com/'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

export const handler = async (event) => {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event
  const { url } = body

  if (!url || !url.startsWith(BUCKET_URL)) {
    return {
      statusCode: 400,
      headers: cors,
      body: JSON.stringify({ error: 'Invalid URL' }),
    }
  }

  const key = url.slice(BUCKET_URL.length)

  // Must be a UUID filename with a known extension — no path traversal
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\w+$/.test(key)) {
    return {
      statusCode: 400,
      headers: cors,
      body: JSON.stringify({ error: 'Invalid key' }),
    }
  }

  const authHeader = event.headers?.Authorization ?? event.headers?.authorization ?? ''
  if (!process.env.ADMIN_TOKEN || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return {
      statusCode: 403,
      headers: cors,
      body: JSON.stringify({ error: 'Not authorized' }),
    }
  }

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ deleted: key }),
  }
}
