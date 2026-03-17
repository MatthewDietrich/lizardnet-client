import IRC from 'irc-framework'
import { DatabaseSync } from 'node:sqlite'

const HOST            = process.env.IRC_HOST || '127.0.0.1'
const PORT            = 6667
const CHANNEL         = '#chat'
const BOT_NICK        = process.env.BOT_NICK        || 'MediaBot'
const BOT_PASS        = process.env.BOT_PASS        || ''
const ADMIN_TOKEN     = process.env.ADMIN_TOKEN
const PRESIGN_URL     = process.env.PRESIGN_URL     || 'https://yw76re20g8.execute-api.us-east-2.amazonaws.com/prod/presign'
const DELETE_URL      = process.env.DELETE_URL      || 'https://yw76re20g8.execute-api.us-east-2.amazonaws.com/prod/delete'
const DB_PATH         = process.env.DB_PATH         || '/opt/mediabot/uploads.db'

if (!ADMIN_TOKEN) { console.error('ADMIN_TOKEN is required'); process.exit(1) }

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/mp4', 'audio/webm',
])

// ─── Persistent upload ownership DB ──────────────────────────────────────────

const db = new DatabaseSync(DB_PATH)
db.exec(`CREATE TABLE IF NOT EXISTS uploads (url TEXT PRIMARY KEY, nick TEXT NOT NULL)`)

const stmtSet    = db.prepare(`INSERT OR REPLACE INTO uploads (url, nick) VALUES (?, ?)`)
const stmtGet    = db.prepare(`SELECT nick FROM uploads WHERE url = ?`)
const stmtDelete = db.prepare(`DELETE FROM uploads WHERE url = ?`)
const stmtRename = db.prepare(`UPDATE uploads SET nick = ? WHERE nick = ?`)

const uploadedBy = {
  set: (url, nick) => stmtSet.run(url, nick),
  get: (url) => stmtGet.get(url)?.nick ?? null,
  delete: (url) => stmtDelete.run(url),
  rename: (oldNick, newNick) => stmtRename.run(newNick, oldNick),
}

// nicks currently opped in CHANNEL
const channelOps = new Set()

// pending NickServ ACC callbacks: nick -> [resolve]
const pendingAcc = new Map()

// ─── IRC client ───────────────────────────────────────────────────────────────

const client = new IRC.Client()

function connect() {
  client.connect({ host: HOST, port: PORT, nick: BOT_NICK, tls: false })
}

client.on('registered', () => {
  console.log(`[bot] Connected as ${BOT_NICK}`)
  if (BOT_PASS) client.say('NickServ', `IDENTIFY ${BOT_PASS}`)
  client.join(CHANNEL)
})

client.on('close', () => {
  console.log('[bot] Disconnected — reconnecting in 15s')
  setTimeout(connect, 15_000)
})

client.on('error', err => console.error('[bot] Error:', err))

// ─── Op tracking ─────────────────────────────────────────────────────────────

// Initial NAMES list on join
client.on('userlist', ({ channel, users }) => {
  if (channel !== CHANNEL) return
  channelOps.clear()
  for (const u of users) {
    if (u.modes?.includes('o')) channelOps.add(u.nick)
  }
})

client.on('mode', ({ target, modes }) => {
  if (target !== CHANNEL) return
  for (const { mode, param } of modes) {
    if (mode === '+o') channelOps.add(param)
    else if (mode === '-o') channelOps.delete(param)
  }
})

// Keep op set and uploadedBy consistent on nick changes
client.on('nick', ({ nick, new_nick }) => {
  if (channelOps.delete(nick)) channelOps.add(new_nick)
  uploadedBy.rename(nick, new_nick)
})

// ─── NickServ identification check ───────────────────────────────────────────
// Atheme: "ACC <nick>" → NickServ NOTICE "<nick> ACC <0|1|3>"
// Adjust the regex below if your server uses a different NickServ flavour.

client.on('notice', ({ nick, message }) => {
  if (nick?.toLowerCase() !== 'nickserv') return
  const m = message.match(/^(\S+) ACC (\d)/)
  if (!m) return
  const [, target, levelStr] = m
  const callbacks = pendingAcc.get(target)
  if (!callbacks) return
  pendingAcc.delete(target)
  const identified = parseInt(levelStr) === 3
  for (const cb of callbacks) cb(identified)
})

function checkAcc(nick) {
  return new Promise(resolve => {
    // Do not coalesce — each call must get its own independent ACC response
    const existing = pendingAcc.get(nick)
    if (existing) { existing.push(resolve); return }
    pendingAcc.set(nick, [resolve])
    client.say('NickServ', `ACC ${nick}`)
    setTimeout(() => {
      const cbs = pendingAcc.get(nick)
      if (cbs) { pendingAcc.delete(nick); for (const cb of cbs) cb(false) }
    }, 5_000)
  })
}

// Two consecutive ACC checks required. An attacker would need to release and
// re-acquire an identified nick between two back-to-back NickServ round trips.
async function checkIdentified(nick) {
  if (!await checkAcc(nick)) return false
  return checkAcc(nick)
}

// ─── Lambda helpers ───────────────────────────────────────────────────────────

async function callPresign(contentType) {
  const res = await fetch(PRESIGN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify({ contentType }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error ?? `Presign failed (${res.status})`)
  }
  return res.json() // { uploadUrl, publicUrl, deleteToken }
}

async function callDelete(url) {
  const res = await fetch(DELETE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error ?? `Delete failed (${res.status})`)
  }
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

const RATE_WINDOW = 60_000   // 1 minute
const RATE_MAX    = 10       // max commands per window per nick
const rateMap = new Map()    // nick -> { count, resetAt }

function rateLimit(nick) {
  const now = Date.now()
  let entry = rateMap.get(nick)
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW }
    rateMap.set(nick, entry)
  }
  entry.count++
  return entry.count > RATE_MAX
}

// ─── Command handler ──────────────────────────────────────────────────────────

client.on('privmsg', async ({ nick, target, message }) => {
  // Only handle DMs to the bot
  if (target.toLowerCase() !== BOT_NICK.toLowerCase()) return

  if (rateLimit(nick)) {
    client.notice(nick, 'Rate limited — try again later')
    return
  }

  const [cmd, ...args] = message.trim().split(/\s+/)

  // PRESIGN <contentType>
  if (cmd.toUpperCase() === 'PRESIGN') {
    const contentType = args[0]
    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      client.notice(nick, `PRESIGN_FAIL Unsupported or missing content type`)
      return
    }
    try {
      const { uploadUrl, publicUrl } = await callPresign(contentType)
      uploadedBy.set(publicUrl, nick)
      client.notice(nick, `PRESIGN_OK ${uploadUrl} ${publicUrl}`)
      console.log(`[bot] Presigned ${publicUrl} for ${nick}`)
    } catch (e) {
      client.notice(nick, `PRESIGN_FAIL ${e.message}`)
      console.error(`[bot] Presign error for ${nick}:`, e.message)
    }
    return
  }

  // DELETE <url>
  if (cmd.toUpperCase() === 'DELETE') {
    const url = args[0]
    if (!url || !url.startsWith('https://lizardnet-media.s3.amazonaws.com/')) {
      client.notice(nick, `DELETE_FAIL Invalid or missing URL`)
      return
    }
    const identified = await checkIdentified(nick)
    if (!identified) {
      client.notice(nick, `DELETE_FAIL Not identified with NickServ`)
      return
    }
    const isOp = channelOps.has(nick)
    const isOwner = uploadedBy.get(url) === nick
    if (!isOp && !isOwner) {
      client.notice(nick, `DELETE_FAIL Not authorized`)
      return
    }
    try {
      await callDelete(url)
      uploadedBy.delete(url)
      client.say(CHANNEL, `MEDIADELETE ${url}`)
      client.notice(nick, `DELETE_OK`)
      console.log(`[bot] Deleted ${url} (requested by ${nick})`)
    } catch (e) {
      client.notice(nick, `DELETE_FAIL ${e.message}`)
      console.error(`[bot] Delete error for ${nick}:`, e.message)
    }
    return
  }

  // REDACT <msgid>
  if (cmd.toUpperCase() === 'REDACT') {
    const msgid = args[0]
    if (!msgid) {
      client.notice(nick, `REDACT_FAIL Missing message ID`)
      return
    }
    const identified = await checkIdentified(nick)
    if (!identified) {
      client.notice(nick, `REDACT_FAIL Not identified with NickServ`)
      return
    }
    if (!channelOps.has(nick)) {
      client.notice(nick, `REDACT_FAIL Not authorized`)
      return
    }
    client.say(CHANNEL, `MSGDELETE ${msgid}`)
    client.notice(nick, `REDACT_OK`)
    console.log(`[bot] Redacted message ${msgid} (requested by ${nick})`)
    return
  }

  client.notice(nick, `Unknown command. Available: PRESIGN <contentType>, DELETE <url>, REDACT <msgid>`)
})

// ─── Start ────────────────────────────────────────────────────────────────────

connect()
