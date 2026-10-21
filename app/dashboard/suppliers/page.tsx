import { Header } from '@/components/layout/Header'
import { SupplierManager } from '@/components/inventory/SupplierManager'
import { ExpiryTracker } from '@/components/inventory/ExpiryTracker'

export default function SuppliersPage() {
  return (
    <>
      <Header title="Advanced Inventory" subtitle="Suppliers · Purchase orders · Expiry tracking · Wastage · Barcode · Retail sales" />
      <div className="p-6 space-y-6">
        <SupplierManager />
        <ExpiryTracker />
      </div>
    </>
  )
}
