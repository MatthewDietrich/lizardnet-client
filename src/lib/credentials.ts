export type EncryptedCreds = {
  nick: string
  key: CryptoKey
  iv: Uint8Array<ArrayBuffer>
  ciphertext: ArrayBuffer
}

export async function encryptCreds(nick: string, password: string): Promise<EncryptedCreds> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(password))
  return { nick, key, iv, ciphertext }
}

export async function decryptCreds(enc: EncryptedCreds): Promise<string> {
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: enc.iv }, enc.key, enc.ciphertext)
  return new TextDecoder().decode(buf)
}
