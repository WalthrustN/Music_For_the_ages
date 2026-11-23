import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { videoFor } from '../videos'

export function VideoBackground({ genre }: { genre: string }) {
  const reduced = usePrefersReducedMotion()
  const clip = videoFor(genre)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [clip.mp4])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <img src={clip.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {reduced || broken ? null : (
        <AnimatePresence>
          <motion.video
            key={clip.mp4}
            muted
            autoPlay
            playsInline
            loop
            poster={clip.poster}
            onError={() => setBroken(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute inset-0 h-full w-full object-cover"
          >
            {clip.webm ? <source src={clip.webm} type="video/webm" /> : null}
            <source src={clip.mp4} type="video/mp4" />
          </motion.video>
        </AnimatePresence>
      )}
    </div>
  )
}
