import { Sidebar } from '@/components/layout/Sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ tenantId: string }>
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { tenantId } = await params

  return (
    <div className="flex min-h-screen" style={{ background: '#f0f2f5' }}>
      <Sidebar tenantId={tenantId} />
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
