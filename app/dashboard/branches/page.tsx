import { Header } from '@/components/layout/Header'
import { BranchDashboard } from '@/components/branch/BranchDashboard'

export default function BranchesPage() {
  return (
    <>
      <Header title="Multi-Branch" subtitle="Central dashboard · Staff transfer · Inventory · Franchise royalties" />
      <div className="p-6"><BranchDashboard /></div>
    </>
  )
}
