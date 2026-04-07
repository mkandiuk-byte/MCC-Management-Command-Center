import { SidebarTrigger } from '@/components/ui/sidebar'
import { AdPerformanceDetail } from '@/components/ad-performance-detail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OfferDetailPage({ params }: Props) {
  const { id } = await params
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-6 py-4 border-b shrink-0">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Offer Detail</h1>
          <p className="text-sm text-muted-foreground">offer_id · traffic analysis · AI insights</p>
        </div>
      </header>
      <div className="flex-1 p-6 overflow-auto min-h-0">
        <AdPerformanceDetail type="offer" id={id} />
      </div>
    </div>
  )
}
