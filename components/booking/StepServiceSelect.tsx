'use client'
import { useState } from 'react'
import { Search, Clock, DollarSign } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn, formatCurrency, formatDuration } from '@/lib/utils'
import { useBookingStore, useServices } from '@/hooks/useBooking'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'

const CATEGORIES = ['All', 'Hair', 'Beard', 'Skin', 'Nails', 'Spa', 'Package']

export function StepServiceSelect() {
  const { data: services = [], isLoading } = useServices()
  const { setFormData, setStep, formData } = useBookingStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const filtered: any[] = services.filter((s: any) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchCat    = category === 'All' || s.category === category
    return matchSearch && matchCat
  })

  const handleSelect = (serviceId: string) => {
    setFormData({ service_id: serviceId })
    setStep(1)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Choose a Service</h2>
        <p className="text-sm text-gray-400 mt-1">Select the service you'd like to book</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search services..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gold-500/50"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all',
              category === cat
                ? 'bg-gold-500/20 text-gold-400 border border-gold-500/40'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Services grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((service, i) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card
                hover
                gold={formData.service_id === service.id}
                onClick={() => handleSelect(service.id)}
                className={cn(
                  'p-5 cursor-pointer transition-all',
                  formData.service_id === service.id && 'ring-1 ring-gold-500/50'
                )}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{service.name}</h3>
                    {service.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{service.description}</p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-400 text-xs font-medium shrink-0">
                    {service.category}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/8">
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock size={13} />
                    {formatDuration(service.duration)}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-gold-400">
                    <DollarSign size={13} />
                    {formatCurrency(service.base_price)}
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <p className="text-center text-gray-500 py-8">No services match your search.</p>
      )}
    </div>
  )
}
