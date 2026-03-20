import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'zrobefakturu.sk - Elektronicka fakturacia pre Slovensko'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'radial-gradient(circle at 25% 25%, #1e3a5f 0%, transparent 50%), radial-gradient(circle at 75% 75%, #1e3a5f 0%, transparent 50%)',
        }}
      >
        {/* Logo / Brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: '#ef4444',
            }}
          >
            zrob
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: '#3b82f6',
            }}
          >
            efakturu
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: '#ffffff',
            }}
          >
            .sk
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            fontSize: 32,
            color: '#a1a1aa',
            marginBottom: 40,
            textAlign: 'center',
            maxWidth: 800,
          }}
        >
          Elektronicka fakturacia pre Slovensko
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 20,
          }}
        >
          {['Peppol BIS 3.0', 'EN16931', 'UBL XML', 'AI Asistent'].map((feature) => (
            <div
              key={feature}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 24px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderRadius: 12,
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  color: '#60a5fa',
                  fontWeight: 500,
                }}
              >
                {feature}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 18,
            color: '#71717a',
          }}
        >
          Bezplatny nastroj na tvorbu elektronickych faktur
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
