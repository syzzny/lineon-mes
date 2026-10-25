/** DB-01 생산 현황 대시보드 — 공장 전체 상황을 한 화면에서, 문제는 바로 해당 화면으로 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import { Card, CardLink, Dot, KpiCard, LiveBadge, Meter, Tag } from '../components/panels'
import { BarChart } from '../components/charts'
import { Select } from '../components/form'
import { useMes } from '../store/MesStore'
import useNow from '../hooks/useNow'
import { LINES, TODAY } from '../data/workOrders'
import { DAILY_PLAN, HOURLY_BASE, HOURLY_TARGET, LINE_PLAN } from '../data/mes'
import { countByStatus, dueRisk, lineProgress } from '../utils/mes'
import { formatNumber, formatShortDate, percent } from '../utils/format'
import { minutesBetween, shortStamp } from '../utils/clock'
import './Dashboard.scss'

const PERIODS = [
  { key: 'today', label: '오늘' },
  { key: 'week', label: '이번 주' },
  { key: 'month', label: '이번 달' },
]

// 지난 날짜 생산량 (시드) — 주·월 보기용
const PAST_DAYS = Array.from({ length: 21 }, (_, i) => {
  const day = String(i + 1).padStart(2, '0')
  const dow = new Date(`2026-10-${day}T00:00:00`).getDay()
  const value = dow === 0 ? 0 : dow === 6 ? 9200 : 17200 + ((i * 3517) % 1900)
  return { date: `2026-10-${day}`, value }
})

export default function Dashboard() {
  const navigate = useNavigate()
  const now = useNow()
  const { workOrders, equipment, results, defects, items, extraOutput } = useMes()
  const [period, setPeriod] = useState('today')
  const [line, setLine] = useState('')

  // 라인을 고르면 아래 모든 지표가 그 라인 기준으로 다시 계산됨
  const lines = line ? [line] : LINES
  const eqs = equipment.filter((e) => !line || e.line === line)
  const wos = workOrders.filter((w) => !line || w.line === line)
  const st = countByStatus(eqs)

  // 오늘 생산 = 라인별 실적 합
  const todayDone = lines.reduce((n, l) => n + lineProgress(l, extraOutput).done, 0)
  const todayPlan = lines.reduce((n, l) => n + LINE_PLAN[l], 0)
  const share = todayPlan / DAILY_PLAN

  // 시간대별 실적 (마지막 막대 = 진행 중인 현재 시간)
  const nowHour = Math.floor(now.min / 60)
  const extra = lines.reduce((n, l) => n + (extraOutput[l] ?? 0), 0)
  const hourly = HOURLY_BASE.map((h) => {
    const hr = Number(h.hour)
    const state = hr < nowHour ? 'done' : hr === nowHour ? 'live' : 'future'
    const value = Math.round(h.value * share) + (state === 'live' ? extra : 0)
    return { label: `${h.hour}:00`, value, state, note: h.hour === '12' ? '점심' : undefined }
  })

  // 주·월 보기
  const days = period === 'week' ? PAST_DAYS.filter((d) => d.date >= '2026-10-19') : PAST_DAYS
  const daily = [...days.map((d) => ({ label: d.date.slice(8), value: Math.round(d.value * share), state: 'done' })), { label: TODAY.slice(8), value: todayDone, state: 'live' }]
  const periodDone = period === 'today' ? todayDone : daily.reduce((n, d) => n + d.value, 0)
  const periodPlan = period === 'today' ? Math.round(HOURLY_TARGET * share * Math.max(1, (now.min - 480) / 60 - 1)) : daily.length * Math.round(DAILY_PLAN * share) * 0.95

  // 불량률 = 기간 불량 / 기간 생산
  const from = period === 'today' ? TODAY : period === 'week' ? '2026-10-19' : '2026-10-01'
  const defectQty = defects.filter((d) => d.at >= from && (!line || d.line === line)).reduce((n, d) => n + d.qty, 0)
  const defectRate = periodDone ? (defectQty / periodDone) * 100 : 0

  // 납기 위험: 지연 → 시간 부족 → 여유 적음 순 (계산 기준은 utils/mes.js dueRisk)
  const risks = wos
    .map((w) => ({ wo: w, risk: dueRisk(w, items, now.min) }))
    .filter((r) => r.risk.level !== 'ok')
    .sort((a, b) => b.risk.hours - a.risk.hours)
  const lateCount = risks.filter((r) => r.risk.level === 'late').length

  const down = eqs.filter((e) => e.status === '비가동')
  const pending = results.filter((r) => r.status === '승인 대기' && (!line || r.line === line))
  const oldest = pending.reduce((a, b) => (!a || b.at < a.at ? b : a), null)
  const running = wos.filter((w) => w.status === '진행' || w.status === '일시정지')
  const opRate = percent(st.가동, eqs.length)

  return (
    <AppLayout current="DB-01">
      <main className="page dash">
        <header className="page-top">
          <div>
            <h1>생산 현황</h1>
            <p className="num">{formatShortDate(TODAY).replace(/^(\d+)\.(\d+)/, '2026.$1.$2')} · 주간 근무 08:00 – 17:00</p>
          </div>
          <div className="page-top__right">
            <LiveBadge>실시간 · {now.time} 업데이트</LiveBadge>
            <div className="seg" role="group" aria-label="기간">
              {PERIODS.map((p) => (
                <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</button>
              ))}
            </div>
            <Select aria-label="라인" className="dash__line" options={LINES.map((l) => ({ value: l, label: `${l} 라인` }))} placeholder="라인 전체" value={line} onChange={(e) => setLine(e.target.value)} />
          </div>
        </header>

        {/* 바로 처리해야 할 일 */}
        <div className="alerts">
          <AlertCard
            tone="danger" icon="alert" title="납기 지연 위험" value={`${risks.length}건`}
            sub={`지연 ${lateCount} · 위험 ${risks.length - lateCount}`}
            onClick={() => document.getElementById('risk-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          />
          <AlertCard
            tone="warning" icon="stop" title="설비 비가동" value={`${down.length}대`}
            sub={down.length ? `${down.map((e) => e.id).join(', ')} · ${minutesBetween(down[0].since)}분째` : '모든 설비 정상'}
            onClick={() => navigate(down.length ? `/line-monitoring?line=${down[0].line}` : '/line-monitoring')}
          />
          <AlertCard
            tone="brand" icon="check" title="실적 승인 대기" value={`${pending.length}건`}
            sub={oldest ? `가장 오래된 건 ${shortStamp(oldest.at).slice(6)} 입력` : '대기 중인 실적 없음'}
            onClick={() => navigate('/results/approval')}
          />
        </div>

        <div className="kpi-row">
          <KpiCard
            label={`${PERIODS.find((p) => p.key === period).label} 생산 실적`}
            value={formatNumber(periodDone)} unit="EA"
            delta={{ text: `${periodDone >= periodPlan ? '+' : '−'}${Math.abs(100 - percent(periodDone, periodPlan))}%`, good: periodDone >= periodPlan }}
            meter={percent(periodDone, periodPlan)}
            sub={`현재 시점 목표 대비 ${percent(periodDone, periodPlan)}%`}
            to="/results"
          />
          <KpiCard label="설비 가동률" value={opRate} unit="%" delta={{ text: '+2%p', good: true }} meter={opRate} meterTone="success" sub={`${eqs.length}대 중 ${st.가동}대 가동`} to="/equipment" />
          <KpiCard
            label="불량률" value={defectRate.toFixed(1)} unit="%"
            delta={{ text: defectRate <= 2 ? '목표 이내' : '목표 초과', good: defectRate <= 2 }}
            meter={(defectRate / 3) * 100} meterTone={defectRate <= 2 ? 'success' : 'danger'}
            sub="목표 2.0% 이하" to="/defects"
          />
          <KpiCard
            label="진행 중 작업지시" value={running.length} unit="건"
            sub={`대기 ${wos.filter((w) => w.status === '대기').length} · 일시정지 ${running.filter((w) => w.status === '일시정지').length} · 오늘 완료 ${wos.filter((w) => w.status === '완료' && w.history[0]?.at.startsWith(TODAY)).length}`}
            to="/work-orders"
          />
        </div>

        <div className="dash__grid">
          <div className="dash__col">
            <Card
              title={period === 'today' ? '시간대별 생산 실적' : '일별 생산 실적'}
              desc={period === 'today' ? `시간당 목표 ${formatNumber(Math.round(HOURLY_TARGET * share))} EA` : `일 목표 ${formatNumber(Math.round(DAILY_PLAN * share))} EA`}
              action={
                <div className="legend">
                  <Dot tone="brand">실적</Dot>
                  <span className="legend__live">진행 중</span>
                  <span className="legend__target">목표</span>
                </div>
              }
            >
              <div className="card__body">
                {period === 'today' ? (
                  <BarChart data={hourly} target={Math.round(HOURLY_TARGET * share)} unit="EA" ariaLabel="시간대별 생산 실적 막대 차트" />
                ) : (
                  <BarChart data={daily} target={Math.round(DAILY_PLAN * share)} unit="EA" ariaLabel="일별 생산 실적 막대 차트" />
                )}
              </div>
            </Card>

            <Card title="라인별 계획 대비 실적" action={<CardLink to="/line-monitoring">라인 모니터링</CardLink>}>
              <ul className="card__body line-progress">
                {lines.map((l) => {
                  const p = lineProgress(l, extraOutput)
                  const tone = p.pct < 50 ? 'warning' : 'brand'
                  return (
                    <li key={l}>
                      <Link to={`/line-monitoring?line=${l}`} className="line-progress__row">
                        <span>{l} 라인</span>
                        <span className="num muted">{formatNumber(p.done)} / {formatNumber(p.plan)}</span>
                        <strong className={`num is-${tone}`}>{p.pct}%</strong>
                      </Link>
                      <Meter value={p.pct} tone={tone} height={8} label={`${l} 라인 달성률`} />
                    </li>
                  )
                })}
              </ul>
            </Card>
          </div>

          <div className="dash__col">
            <Card id="risk-list" title="납기 지연 위험" action={<CardLink to="/work-orders">전체 보기</CardLink>}>
              <ul className="card__body risk-list">
                {risks.slice(0, 3).map(({ wo, risk }) => (
                  <li key={wo.id}>
                    <div className="risk-list__top">
                      <Link to={`/work-orders/${wo.id}`} className="cell-link num">{wo.id}</Link>
                      <Tag tone={risk.tone}>{risk.label}</Tag>
                    </div>
                    <p><strong>{wo.itemName}</strong> <span className="num muted">· {wo.equip || '미배정'}</span></p>
                    <div className="risk-list__bar">
                      <Meter value={percent(wo.done, wo.qty)} />
                      <span className="num">{percent(wo.done, wo.qty)}% · 납기 {wo.due.slice(5).replace('-', '.')}</span>
                    </div>
                  </li>
                ))}
                {risks.length === 0 && <li className="muted">납기 위험이 있는 작업지시가 없어요</li>}
              </ul>
            </Card>

            <Card title="설비 상태" action={<CardLink to="/line-monitoring">라인 모니터링</CardLink>}>
              <div className="card__body">
                <div className="stack-bar" role="img" aria-label={`가동 ${st.가동}, 비가동 ${st.비가동}, 대기 ${st.대기}, 점검 ${st.점검}`}>
                  {['가동', '비가동', '점검', '대기'].map((s) => st[s] > 0 && <span key={s} className={`is-${s}`} style={{ flex: st[s] }} />)}
                </div>
                <div className="equip-stat">
                  {[['가동', 'success'], ['비가동', 'danger'], ['대기', 'neutral'], ['점검', 'brand']].map(([s, tone]) => (
                    <Link key={s} to="/equipment" className="equip-stat__box">
                      <Dot tone={tone}>{s}</Dot>
                      <strong className="num">{st[s]}<small>대</small></strong>
                    </Link>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </AppLayout>
  )
}

/** 상단 '바로 처리할 일' 카드 — 누르면 해당 화면으로 이동 */
function AlertCard({ tone, icon, title, value, sub, onClick }) {
  return (
    <button type="button" className={`alert-card is-${tone}`} onClick={onClick}>
      <span className="alert-card__icon"><Icon name={icon} size={20} /></span>
      <span className="alert-card__text">
        <span>{title}</span>
        <span><strong className="num">{value}</strong> <small className="num">{sub}</small></span>
      </span>
      <Icon name="chevR" size={18} />
    </button>
  )
}
