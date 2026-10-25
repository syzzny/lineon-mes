/**
 * 차트 — 라이브러리 없이 HTML/SVG로 직접 그림
 * 규칙: 얇은 막대(끝 4px 라운드), 2px 선, 보조선은 옅게, 마우스를 올리면 툴팁, 상태색은 의미 있는 곳에만
 */
import { useLayoutEffect, useRef, useState } from 'react'
import './charts.scss'

/** 요소 너비 측정 (반응형 SVG용) */
function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const fmt = (n) => n.toLocaleString('ko-KR')

/**
 * 막대 차트 (시간대별 실적 등)
 * @param data  [{ label, value, state: 'done' | 'live' | 'future', note }]
 * @param target 목표선 값 (점선)
 */
export function BarChart({ data, target, max, unit = '', height = 180, ticks = 3, ariaLabel }) {
  const [hover, setHover] = useState(null)
  const top = max ?? Math.max(target ?? 0, ...data.map((d) => d.value)) * 1.1
  const step = top / (ticks - 1)
  const tickVals = Array.from({ length: ticks }, (_, i) => Math.round((i * step) / 100) * 100)
  const y = (v) => `${(v / top) * 100}%`
  return (
    <figure className="bars" aria-label={ariaLabel}>
      <div className="bars__plot" style={{ height }}>
        {tickVals.map((t) => (
          <span key={t} className="bars__grid" style={{ bottom: y(t) }}>
            <em className="num">{t >= 1000 ? `${t / 1000}k` : t}</em>
          </span>
        ))}
        {target && (
          <span className="bars__target" style={{ bottom: y(target) }} aria-hidden="true" />
        )}
        <div className="bars__cols">
          {data.map((d, i) => (
            <div
              key={d.label}
              className={`bars__col is-${d.state ?? 'done'}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={d.state === 'future' ? -1 : 0}
              aria-label={`${d.label} ${fmt(d.value)}${unit}${d.note ? ` · ${d.note}` : ''}`}
            >
              {d.note && d.state !== 'future' && <small className="bars__note" style={{ bottom: `calc(${y(d.value)} + 4px)` }}>{d.note}</small>}
              <span className="bars__bar" style={{ height: y(Math.max(d.value, d.state === 'live' ? top * 0.25 : 0)) }}>
                {d.state === 'live' && <span className="bars__fill" style={{ height: `${Math.min(100, (d.value / (top * 0.25)) * 100)}%` }} />}
              </span>
              {hover === i && d.state !== 'future' && (
                <span className="chart-tip" style={{ bottom: `calc(${y(Math.max(d.value, d.state === 'live' ? top * 0.25 : 0))} + 10px)` }}>
                  <strong>{d.label}</strong>
                  <span className="num">{fmt(d.value)} {unit}</span>
                  {target && <span className="num">목표 대비 {Math.round((d.value / target) * 100)}%{d.state === 'live' ? ' · 진행 중' : ''}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="bars__labels">
        {data.map((d) => (
          <span key={d.label} className={`num ${d.state === 'future' ? 'is-future' : ''}`}>{d.label}</span>
        ))}
      </div>
    </figure>
  )
}

/**
 * 선 차트 (일별 불량률 추이 등) — 목표선을 넘은 점은 강조
 * @param points [{ label, value }]
 */
export function LineChart({ points, target, max, height = 200, format = (v) => v, ariaLabel, tickLabels }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const padL = 36
  const padR = 12
  const padT = 12
  const padB = 28
  const top = max ?? Math.ceil(Math.max(target ?? 0, ...points.map((p) => p.value)) * 1.2)
  const w = Math.max(0, width - padL - padR)
  const h = height - padT - padB
  const x = (i) => padL + (points.length > 1 ? (i / (points.length - 1)) * w : w / 2)
  const y = (v) => padT + h - (v / top) * h
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')
  const area = `${path} L${x(points.length - 1)},${padT + h} L${x(0)},${padT + h} Z`
  const ticks = [0, top / 3, (top * 2) / 3, top].map((t) => Math.round(t * 10) / 10)
  const labelIdx = tickLabels ?? [0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1]

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = Math.round(((px - padL) / w) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }

  return (
    <figure className="line-chart" ref={ref} aria-label={ariaLabel}>
      {width > 0 && (
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={ariaLabel}>
          <defs>
            <linearGradient id="lc-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--brand-primary)" stopOpacity="0.14" />
              <stop offset="1" stopColor="var(--brand-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + w} y1={y(t)} y2={y(t)} className="line-chart__grid" />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="line-chart__tick">{format(t)}</text>
            </g>
          ))}
          {target != null && <line x1={padL} x2={padL + w} y1={y(target)} y2={y(target)} className="line-chart__target" />}
          <path d={area} fill="url(#lc-area)" />
          <path d={path} className="line-chart__line" />
          {points.map((p, i) =>
            target != null && p.value > target ? (
              <circle key={i} cx={x(i)} cy={y(p.value)} r={5} className="line-chart__over" />
            ) : null,
          )}
          {labelIdx.map((i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="line-chart__tick">{points[i]?.label}</text>
          ))}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + h} className="line-chart__cross" />
              <circle cx={x(hover)} cy={y(points[hover].value)} r={5} className="line-chart__hover" />
            </g>
          )}
        </svg>
      )}
      {hover != null && (
        <span className="chart-tip" style={{ left: x(hover), top: y(points[hover].value) - 12, transform: 'translate(-50%, -100%)' }}>
          <strong>{points[hover].label}</strong>
          <span className="num">{format(points[hover].value)}{target != null && points[hover].value > target ? ' · 목표 초과' : ''}</span>
        </span>
      )}
    </figure>
  )
}

/**
 * 하루 가동 타임라인 — segments: [{ from: 분, to: 분, kind: 'run' | 'setup' | 'down' | 'plan' }]
 * @param dayStart / dayEnd  분 단위 (08:00 = 480)
 */
export function Timeline({ segments, dayStart = 480, dayEnd = 1020, now, labels = ['08:00', '10:00', '12:00', '14:00', '16:00', '17:00'] }) {
  const [hover, setHover] = useState(null)
  const span = dayEnd - dayStart
  const pos = (m) => `${((Math.min(Math.max(m, dayStart), dayEnd) - dayStart) / span) * 100}%`
  const KIND = { run: '가동', setup: '셋업', down: '비가동', plan: '계획 정비' }
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return (
    <figure className="timeline-bar">
      <div className="timeline-bar__track">
        {segments.map((s, i) => (
          <span
            key={i}
            className={`timeline-bar__seg is-${s.kind}`}
            style={{ left: pos(s.from), width: `calc(${pos(s.to)} - ${pos(s.from)})` }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {hover === i && (
              <span className="chart-tip" style={{ left: '50%', bottom: 'calc(100% + 8px)', transform: 'translateX(-50%)' }}>
                <strong>{KIND[s.kind]}</strong>
                <span className="num">{hhmm(s.from)} – {hhmm(s.to)} · {s.to - s.from}분</span>
                {s.note && <span>{s.note}</span>}
              </span>
            )}
          </span>
        ))}
        {now != null && <span className="timeline-bar__now" style={{ left: pos(now) }} aria-hidden="true" />}
      </div>
      <div className="timeline-bar__labels">
        {labels.map((l) => {
          const [h, m] = l.split(':').map(Number)
          return <span key={l} className="num" style={{ left: pos(h * 60 + m) }}>{l}</span>
        })}
      </div>
    </figure>
  )
}
