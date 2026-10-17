import { describe, expect, it } from 'vitest'
import { describeUserAgent } from './userAgent'

describe('describeUserAgent', () => {
  it('reconnaît les navigateurs et systèmes courants, dans le bon ordre', () => {
    expect(describeUserAgent('Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36')).toEqual({ label: 'Chrome sur Android', kind: 'mobile' })
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Edg/129.0')).toEqual({ label: 'Edge sur Windows', kind: 'desktop' })
    expect(describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toEqual({ label: 'Safari sur iOS', kind: 'mobile' })
    expect(describeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) Gecko/20100101 Firefox/131.0')).toEqual({ label: 'Firefox sur macOS', kind: 'desktop' })
    expect(describeUserAgent('Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Chrome/129.0 Safari/537.36')).toEqual({ label: 'Chrome sur Android', kind: 'tablet' })
  })

  it('inconnu ou absent : libellé neutre', () => {
    expect(describeUserAgent(null)).toEqual({ label: 'Appareil inconnu', kind: 'desktop' })
    expect(describeUserAgent('curl/8.5.0')).toEqual({ label: 'Appareil inconnu', kind: 'desktop' })
  })
})
