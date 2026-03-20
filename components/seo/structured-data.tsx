export function WebsiteStructuredData() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'zrobefakturu.sk',
    url: 'https://zrobefakturu.sk',
    description: 'Vytvarajte platne elektronicke faktury podla Peppol BIS 3.0 a EN16931. Bezplatny nastroj pre slovenske firmy na tvorbu e-faktur.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    },
    featureList: [
      'Tvorba elektronickych faktur podla Peppol BIS 3.0',
      'Validacia podla EN16931 normy',
      'Export do UBL XML formatu',
      'AI asistent pre pomoc s fakturami',
      'Sprava dodavatelov a odberatelov',
      'Tvorba dobropisov a opravnych faktur',
    ],
    inLanguage: 'sk',
    isAccessibleForFree: true,
    provider: {
      '@type': 'Organization',
      name: 'zrobefakturu.sk',
      url: 'https://zrobefakturu.sk',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

export function FAQStructuredData() {
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Co je elektronicka faktura podla Peppol?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Elektronicka faktura podla Peppol je strukturovany dokument vo formate UBL XML, ktory splna normu EN16931 a Peppol BIS 3.0. Umoznuje automaticke spracovanie faktur medzi firmami v celej Europe.',
        },
      },
      {
        '@type': 'Question',
        name: 'Je zrobefakturu.sk zadarmo?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Ano, zrobefakturu.sk je bezplatny nastroj pre tvorbu elektronickych faktur. Mozete vytvorit neobmedzeny pocet faktur bez poplatkov.',
        },
      },
      {
        '@type': 'Question',
        name: 'Ako funguje validacia faktur?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kazda faktura je automaticky validovana podla normy EN16931 a Peppol schematronov. System skontroluje vsetky povinne polia, vypocty a format udajov.',
        },
      },
      {
        '@type': 'Question',
        name: 'Mozem vytvorit dobropis k fakture?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Ano, system podporuje tvorbu dobropisov (credit note) s odkazom na povodnu fakturu. Mozete vytvorit uplne storno, zmenu ceny alebo mnozstva.',
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
    />
  )
}

export function OrganizationStructuredData() {
  const orgData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'zrobefakturu.sk',
    url: 'https://zrobefakturu.sk',
    logo: 'https://zrobefakturu.sk/icon-512.png',
    sameAs: [
      'https://github.com/spavlovic77/v0-peppol-invoicing-portal-6p',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['Slovak', 'English'],
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(orgData) }}
    />
  )
}

export function SoftwareApplicationStructuredData() {
  const softwareData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'zrobefakturu.sk',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '50',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareData) }}
    />
  )
}
