import { timingSafeEqual } from 'crypto'

export const handler = async (event) => {
  console.log('Authorizer event:', JSON.stringify(event))

  // TOKEN-type authorizer: token is in event.authorizationToken
  // REQUEST-type authorizer: token is in event.headers
  const raw =
    event.authorizationToken ??
    event.headers?.authorization ??
    event.headers?.Authorization ??
    ''

  const token = raw.replace(/^Bearer\s+/i, '').trim()
  const expected = process.env.UPLOAD_TOKEN ?? ''

  const isValid =
    token.length > 0 &&
    expected.length > 0 &&
    token.length === expected.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected))

  if (!isValid) {
    throw new Error('Unauthorized')
  }

  return {
    principalId: 'upload-client',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: event.methodArn }],
    },
  }
}
