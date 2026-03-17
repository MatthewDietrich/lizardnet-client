export interface ParsedRawLine {
  cmd: string
  params: string[]
}

/**
 * Parses a raw IRC line into its command and parameter list.
 * Strips the optional tags prefix (@...) and prefix (:...) before parsing.
 * The trailing parameter (prefixed with ':') is returned as a single joined element.
 */
export function parseRawLine(line: string): ParsedRawLine {
  let rest = line
  if (rest.startsWith('@')) rest = rest.slice(rest.indexOf(' ') + 1)
  if (rest.startsWith(':')) rest = rest.slice(rest.indexOf(' ') + 1)
  const spaceIdx = rest.indexOf(' ')
  const cmd = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
  const paramStr = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1)
  const parts = paramStr.split(' ')
  const params: string[] = []
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith(':')) { params.push(parts.slice(i).join(' ').slice(1)); break }
    if (parts[i]) params.push(parts[i])
  }
  return { cmd, params }
}
