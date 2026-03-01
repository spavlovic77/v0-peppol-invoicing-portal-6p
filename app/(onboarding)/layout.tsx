// Minimal layout for onboarding -- no navbar, no supplier requirement
export const dynamic = 'force-dynamic'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {children}
    </main>
  )
}
