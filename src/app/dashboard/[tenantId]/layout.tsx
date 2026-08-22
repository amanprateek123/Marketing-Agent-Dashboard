import { Sidebar } from '@/components/layout/Sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { tenantId } = await params

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar tenantId={tenantId} />
      <main className="app-shell-main" id="main-content">
        {children}
      </main>
    </div>
  )
}
