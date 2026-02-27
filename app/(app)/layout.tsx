import { Navbar } from '@/components/navbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </>
  )
}
