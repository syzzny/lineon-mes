import { useEffect, useState } from 'react'
import { nowMinutes, nowTime } from '../utils/clock'

/** 30초마다 다시 그려지는 현재 시각 { min, time } — 경과 시간·실시간 표시용 */
export default function useNow(interval = 30000) {
  const [now, setNow] = useState(() => ({ min: nowMinutes(), time: nowTime() }))
  useEffect(() => {
    const t = setInterval(() => setNow({ min: nowMinutes(), time: nowTime() }), interval)
    return () => clearInterval(t)
  }, [interval])
  return now
}
