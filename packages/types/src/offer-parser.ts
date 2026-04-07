// ─── Offer Name Parser ────────────────────────────────────────────────────────
// Parses the standard naming convention:
// [emoji] BRAND | GEO | SOURCE | LANDING_TYPE TIER[VARIANT] | CONV_ACTION | NETWORK

export interface ParsedOfferName {
  brand:       string   // FORTUNICA, MILLIONER
  geo:         string   // GB, FR, UA
  source:      string   // FB, TT, UAC, GOOGLE
  landingType: string   // PWA, ALL, CLOAK, APP
  tier:        string   // T1, T2, T3
  variant:     string   // FB1, FB2 (empty if absent)
  convAction:  string   // REGFORM, DEPOSIT, FTD, INSTALL
  network:     string   // C.R.E.A.M PARTNERS, AFFINA PARTNERS
  segments:    string[] // raw trimmed segments (stripped of emojis)
}

/** Strip leading emojis/non-ASCII from segment start */
function stripLeading(s: string): string {
  return s.replace(/^[^A-Za-z0-9(]+/, '').trim()
}

export function parseOfferName(name: string): ParsedOfferName {
  const segments = name.split('|').map(stripLeading).filter(Boolean)

  const brand      = segments[0] ?? ''
  const geo        = segments[1] ?? ''
  const source     = segments[2] ?? ''
  const tierSeg    = segments[3] ?? ''
  const convAction = segments[4] ?? ''
  const network    = segments[5] ?? ''

  // "PWA T1FB1" | "ALL T1" | "CLOAK T2" | "APP T1FB2"
  const m = tierSeg.match(/^(\S+)\s+T(\d+)([A-Z]+\d+)?$/i)
  const landingType = (m ? m[1] : tierSeg.split(/\s+/)[0] ?? '').toUpperCase()
  const tier        = m ? `T${m[2]}` : ''
  const variant     = m ? (m[3] ?? '') : ''

  return { brand, geo, source, landingType, tier, variant, convAction, network, segments }
}

/** Converts ISO 2-letter country code to flag emoji */
export function geoFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1A5 + c.charCodeAt(0))).join('')
}
