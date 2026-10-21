import { Header } from '@/components/layout/Header'
import { InventoryTable } from '@/components/inventory/InventoryTable'
import { LowStockAlert } from '@/components/inventory/LowStockAlert'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'

export default function InventoryPage() {
  return (
    <>
      <Header title="Inventory" subtitle="Stock levels & alerts" />
      <div className="p-6 space-y-6">
        <LowStockAlert />
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-white">All Items</h2>
          </CardHeader>
          <CardContent>
            <InventoryTable />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
