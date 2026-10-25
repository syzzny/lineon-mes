/** EQ-01 설비 현황 — 왼쪽 트리(공장 > 라인 > 설비) + 오른쪽 상세 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import DowntimeModal from '../components/DowntimeModal'
import { Dot, Tabs, Tag } from '../components/panels'
import DowntimeTable from '../components/DowntimeTable'
import { EQUIP_TONE } from '../constants/tones'
import { Timeline } from '../components/charts'
import { Button, StatusBadge } from '../components/ui'
import { ConfirmModal } from '../components/feedback'
import { useMes } from '../store/MesStore'
import { countByStatus, currentWoOf, downtimeMinutes, equipTimeline, sumKind } from '../utils/mes'
import { useToast } from '../store/ToastContext'
import useNow from '../hooks/useNow'
import { EQUIP_LOAD, LEADS, LINES, WORKERS } from '../data/workOrders'
import { formatDuration, shortStamp } from '../utils/clock'
import { levelOf } from '../config/access'
import './Equipment.scss'

export default function Equipment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { equipment } = useMes()
  const selected = equipment.find((e) => e.id === id) ?? equipment.find((e) => e.status === '비가동') ?? equipment[0]
  const st = countByStatus(equipment)

  return (
    <AppLayout current="EQ-01" crumbs={id ? [{ label: selected.id }] : []}>
      <main className="page">
        <header className="page-top">
          <div>
            <h1>설비 현황</h1>
            <p>김해공장 설비 {equipment.length}대 · 가동 {st.가동} · 비가동 {st.비가동} · 대기 {st.대기} · 점검 {st.점검}</p>
          </div>
        </header>
        <div className="eq-layout">
          <EquipTree selected={selected.id} onSelect={(eid) => navigate(`/equipment/${eid}`)} />
          <EquipDetail key={selected.id} eq={selected} />
        </div>
      </main>
    </AppLayout>
  )
}

/** 공장 > 라인 > 설비 트리 (검색하면 일치하는 설비만) */
function EquipTree({ selected, onSelect }) {
  const { equipment } = useMes()
  const [q, setQ] = useState('')
  const selLine = equipment.find((e) => e.id === selected)?.line
  const [open, setOpen] = useState(() => new Set([selLine]))
  const query = q.trim().toLowerCase()
  const match = (e) => !query || e.id.toLowerCase().includes(query) || e.name.includes(q.trim())
  const toggle = (l) => setOpen((o) => { const n = new Set(o); if (n.has(l)) n.delete(l); else n.add(l); return n })

  return (
    <aside className="card tree" aria-label="설비 목록">
      <label className="list-search tree__search">
        <Icon name="search" size={15} />
        <input type="search" placeholder="설비명 또는 코드" aria-label="설비 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <ul role="tree" aria-label="김해공장 설비">
        <li role="treeitem" aria-expanded="true">
          <div className="tree__node is-root"><Icon name="chev" size={14} /> <strong>김해공장</strong> <span className="num">{equipment.length}</span></div>
          <ul role="group">
            {LINES.map((l) => {
              const list = equipment.filter((e) => e.line === l && match(e))
              const expanded = query ? list.length > 0 : open.has(l)
              if (query && !list.length) return null
              return (
                <li key={l} role="treeitem" aria-expanded={expanded}>
                  <button type="button" className="tree__node" onClick={() => toggle(l)}>
                    <Icon name={expanded ? 'chev' : 'chevR'} size={14} /> <strong>{l} 라인</strong> <span className="num">{equipment.filter((e) => e.line === l).length}</span>
                  </button>
                  {expanded && (
                    <ul role="group">
                      {list.map((e) => (
                        <li key={e.id} role="treeitem" aria-selected={e.id === selected}>
                          <button type="button" className={`tree__leaf ${e.id === selected ? 'is-on' : ''}`} onClick={() => onSelect(e.id)}>
                            <span className={`dot dot--${EQUIP_TONE[e.status]}`} aria-hidden="true" />
                            <span className="num">{e.id}</span>
                            {e.status !== '가동' && <Tag tone={EQUIP_TONE[e.status]}>{e.status}</Tag>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </li>
      </ul>
    </aside>
  )
}

/** 오른쪽 상세 — 설비가 바뀌면 key로 새로 그려서 탭·모달 상태 초기화 */
function EquipDetail({ eq }) {
  const { user, permissions, workOrders, downtime, run } = useMes()
  const toast = useToast()
  const now = useNow()
  const [tab, setTab] = useState('status')
  const [modal, setModal] = useState(null)
  const canAct = levelOf(permissions, user.role, 'EQ-01') === '처리'

  const wo = currentWoOf(workOrders, eq.id)
  const history = downtime.filter((d) => d.equip === eq.id).sort((a, b) => b.start.localeCompare(a.start))
  const unplanned = history.filter((d) => !d.planned)
  const openDown = history.find((d) => !d.end)
  // 오늘 08:00~지금 구간을 가동·셋업·비가동·계획정비로 나눔 → 타임라인과 가동률 계산에 사용
  const segs = equipTimeline(eq, downtime, now.min)
  const elapsed = Math.max(1, Math.min(now.min, 1020) - 480)
  // 가동률 = 가동 시간 / (경과 시간 - 계획 정비)  · 계획 정비는 가동률에서 제외하는 MES 관행
  const todayRate = Math.round((sumKind(segs, 'run') / (elapsed - sumKind(segs, 'plan'))) * 100)
  const monthMin = unplanned.reduce((n, d) => n + downtimeMinutes(d), 0)
  const monthRate = Math.round(100 - (monthMin / (16 * 540)) * 100 - (100 - EQUIP_LOAD[eq.id]) * 0.1)
  const avgFix = unplanned.length ? Math.round(monthMin / unplanned.length) : 0
  const maint = [
    ...history.filter((d) => d.planned).map((d) => ({ at: d.start, title: d.reason, by: d.by, note: d.note || '정기 점검' })),
    { at: '2026-10-05 13:00', title: '정기 점검', by: '설비팀', note: '윤활유 교체 · 이상 없음' },
    { at: '2026-09-21 09:00', title: '부품 교체', by: '설비팀', note: eq.line === '가공' ? '주축 베어링 교체' : '유압 호스 교체' },
    { at: '2026-09-07 13:00', title: '정기 점검', by: '설비팀', note: '이상 없음' },
  ]

  const resume = () => {
    run('downtime/resume', { equip: eq.id })
    toast(`${eq.id} 가동을 재개했어요`)
    setModal(null)
  }

  return (
    <section className="card eq-detail" aria-label={`${eq.id} 상세`}>
      <header className="eq-detail__head">
        <div>
          <h2>
            <span className="num">{eq.id}</span>
            <StatusBadge status={eq.status} tone={EQUIP_TONE[eq.status]}>
              {eq.status}{eq.status === '비가동' ? ` ${formatDuration(downtimeMinutes(openDown ?? { start: eq.since }))}째` : ''}
            </StatusBadge>
          </h2>
          <p>{eq.name} · {eq.line} 라인 · 담당 {WORKERS[eq.id] ?? '설비팀'} · 반장 {LEADS[eq.line]}</p>
        </div>
        {canAct && (
          <div className="eq-detail__actions">
            <Button icon="wrench" onClick={() => toast(`${eq.id} 정비를 설비팀에 요청했어요`)}>정비 요청</Button>
            {eq.status === '비가동' ? (
              <>
                <Button icon="edit" onClick={() => setModal('edit')} disabled={!openDown}>사유 수정</Button>
                <Button variant="primary" icon="check" onClick={() => setModal('resume')}>재개</Button>
              </>
            ) : eq.status !== '점검' ? (
              <Button variant="danger" icon="alert" onClick={() => setModal('report')}>비가동 신고</Button>
            ) : null}
          </div>
        )}
      </header>

      <Tabs
        label="설비 정보"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'status', label: '가동 현황' },
          { key: 'info', label: '기본정보' },
          { key: 'down', label: '비가동 이력', count: unplanned.length },
          { key: 'maint', label: '정비 이력', count: maint.length },
        ]}
      />

      <div className="eq-detail__panel" role="tabpanel">
        {tab === 'status' && (
          <>
            <div className="mini-kpis">
              <div><span>오늘 가동률</span><strong className="num">{Math.max(0, todayRate)}<small>%</small></strong></div>
              <div><span>이번 달 가동률</span><strong className="num">{Math.max(0, monthRate)}<small>%</small></strong></div>
              <div><span>이번 달 비가동</span><strong className={`num ${monthMin > 300 ? 'is-danger' : ''}`}>{(monthMin / 60).toFixed(1)}<small>시간</small></strong></div>
              <div><span>평균 복구 시간</span><strong className="num">{avgFix}<small>분</small></strong></div>
            </div>

            <div className="eq-detail__section">
              <div className="eq-detail__title">
                <h3>오늘 가동 타임라인</h3>
                <div className="legend-row">
                  <Dot tone="success">가동 {formatDuration(sumKind(segs, 'run'))}</Dot>
                  <Dot tone="muted">셋업·대기 {formatDuration(sumKind(segs, 'setup'))}</Dot>
                  <Dot tone="danger">비가동 {formatDuration(sumKind(segs, 'down'))}</Dot>
                  {sumKind(segs, 'plan') > 0 && <Dot tone="brand">계획 정비</Dot>}
                </div>
              </div>
              <Timeline segments={segs} now={now.min} />
            </div>

            {wo && (
              <div className="eq-detail__wo">
                <span>현재 작업</span>
                <Link to={`/work-orders/${wo.id}`} className="cell-link num">{wo.id}</Link>
                <strong>{wo.itemName}</strong>
                <StatusBadge status={wo.status} />
                <span className="num muted">{wo.done.toLocaleString()} / {wo.qty.toLocaleString()} EA</span>
                <Link to={`/tablet/${eq.id}`} className="eq-detail__tablet">태블릿 화면 <Icon name="chevR" size={14} /></Link>
              </div>
            )}

            <div className="eq-detail__section">
              <div className="eq-detail__title">
                <h3>최근 비가동 이력</h3>
                <Link to={`/downtime?equip=${eq.id}`} className="card__link">전체 {unplanned.length}건 보기</Link>
              </div>
              <DowntimeTable rows={unplanned.slice(0, 4)} />
            </div>
          </>
        )}

        {tab === 'info' && (
          <dl className="info-list">
            {[
              ['설비 코드', eq.id], ['설비명', eq.name], ['라인', `${eq.line} 라인`], ['담당 작업자', WORKERS[eq.id] ?? '—'],
              ['담당 반장', LEADS[eq.line]], ['도입일', '2021.03.15'], ['제조사', eq.line === '가공' ? '두산공작기계(가상)' : eq.line === '프레스' ? '심팩(가상)' : '현대로보틱스(가상)'],
              ['기준 사이클 타임', eq.line === '가공' ? '6:00' : eq.line === '프레스' ? '0:45' : '5:00'], ['오늘 부하', `${EQUIP_LOAD[eq.id]}%`],
            ].map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>
            ))}
          </dl>
        )}

        {tab === 'down' && <DowntimeTable rows={unplanned} />}

        {tab === 'maint' && (
          <ol className="maint-list">
            {maint.map((m, i) => (
              <li key={i}>
                <span className="num muted">{shortStamp(m.at)}</span>
                <strong>{m.title}</strong>
                <span>{m.note}</span>
                <span className="muted">{m.by}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <DowntimeModal open={modal === 'report' || modal === 'edit'} equip={eq.id} edit={modal === 'edit' ? openDown : null} onClose={() => setModal(null)} />
      <ConfirmModal open={modal === 'resume'} title={`${eq.id} 가동을 재개할까요?`} confirmLabel="재개" onConfirm={resume} onClose={() => setModal(null)}>
        <p>비가동을 종료하고{wo?.status === '일시정지' ? `, ${wo.id} 작업을 다시 진행 상태로 바꿔요` : ''}. 비가동 시간은 이력에 기록돼요.</p>
      </ConfirmModal>
    </section>
  )
}

