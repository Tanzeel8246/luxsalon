import { Header } from '@/components/layout/Header'
import { CampaignManager } from '@/components/marketing/CampaignManager'
import { GiftCardManager } from '@/components/marketing/GiftCardManager'
import { PayrollPanel } from '@/components/financial/PayrollPanel'

export default function MarketingPage() {
  return (
    <>
      <Header title="Marketing & CRM" subtitle="Campaigns · Gift Cards · WhatsApp · Loyalty" />
      <div className="p-6 space-y-6">
        <CampaignManager />
        <GiftCardManager />
        <PayrollPanel />
      </div>
    </>
  )
}
