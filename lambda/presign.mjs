import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID, createHmac } from 'crypto'

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

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

function makeDeleteToken(key) {
  return createHmac('sha256', process.env.DELETE_TOKEN_SECRET).update(key).digest('hex')
}

export const handler = async (event) => {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event
  const { contentType } = body

  const ext = ALLOWED_TYPES[contentType]
  if (!ext) {
    return {
      statusCode: 400,
      headers: cors,
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
    headers: cors,
    body: JSON.stringify({
      uploadUrl: url,
      publicUrl: `https://lizardnet-media.s3.amazonaws.com/${key}`,
      deleteToken: makeDeleteToken(key),
    }),
  }
}
