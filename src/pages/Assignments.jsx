/**
 * PP-06 작업 배정 — 미배정 작업지시를 설비 카드로 끌어다 놓아 배정
 * 끌어놓기가 어려운 환경(키보드·터치)을 위해 카드마다 "설비 선택" 드롭다운도 제공
 * 비가동·점검 설비에는 배정할 수 없어요.
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import { Meter, Tag } from '../components/panels'
import { Button, IconButton, StatusBadge } from '../components/ui'
import { Select } from '../components/form'
import { useMes } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { EQUIP_LOAD, LINES, TODAY, WORKERS } from '../data/workOrders'
import { EQUIP_TONE, PRIORITY_TONE } from '../constants/tones'
import { currentWoOf } from '../utils/mes'
import { formatNumber, formatShortDate } from '../utils/format'
import { levelOf } from '../config/access'
import './Assignments.scss'

const BLOCKED = ['비가동', '점검']
const PRIORITY_ORDER = { 긴급: 0, 높음: 1, 보통: 2 }

export default function Assignments() {
  const [params, setParams] = useSearchParams()
  const { workOrders, equipment, items, user, permissions, run } = useMes()
  const toast = useToast()
  const focusEquip = params.get('equip')
  const highlight = (params.get('ids') ?? '').split(',').filter(Boolean)
  const defaultLine = equipment.find((e) => e.id === focusEquip)?.line ?? (user.line !== '전체' ? user.line : '가공')
  const line = LINES.includes(params.get('line')) ? params.get('line') : defaultLine
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)
  const canAssign = levelOf(permissions, user.role, 'PP-06') === '처리'

  const queue = workOrders
    .filter((w) => w.status === '대기' && !w.equip)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.due.localeCompare(b.due))
  const lineQueue = queue.filter((w) => w.line === line)
  const otherQueue = queue.length - lineQueue.length
  const eqs = equipment.filter((e) => e.line === line)

  const hoursOf = (w) => ((w.qty - w.done) * (items.find((i) => i.code === w.itemCode)?.cycle ?? 60)) / 3600

  // 배정 규칙: 비가동·점검 설비 불가, 다른 라인 설비 불가 → 막히면 이유를 토스트로 안내
  const assign = (woId, equip) => {
    const eq = equipment.find((e) => e.id === equip)
    const wo = workOrders.find((w) => w.id === woId)
    if (!eq || !wo) return
    if (BLOCKED.includes(eq.status)) {
      toast(`${equip}은(는) ${eq.status} 중이라 배정할 수 없어요`)
      return
    }
    if (eq.line !== wo.line) {
      toast(`${wo.line} 라인 작업지시는 ${wo.line} 라인 설비에만 배정할 수 있어요`)
      return
    }
    run('wo/assign', { id: woId, equip })
    toast(`${woId}를 ${equip} · ${WORKERS[equip] ?? '작업자'}에게 배정했어요`)
  }

  // 끌어다 놓기: dataTransfer에 작업지시번호를 실어 설비 카드에 놓으면 배정
  const onDrop = (e, equip) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || dragId
    setOver(null)
    setDragId(null)
    if (id) assign(id, equip)
  }

  return (
    <AppLayout current="PP-06">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>작업 배정</h1>
            <p>왼쪽 작업지시를 설비 카드로 끌어다 놓거나, 카드의 "설비 선택"으로 배정하세요</p>
          </div>
          <div className="page-top__right">
            <div className="seg" role="group" aria-label="라인">
              {LINES.map((l) => (
                <button key={l} type="button" aria-pressed={l === line} onClick={() => setParams({ line: l })}>
                  {l} <span className="num">{queue.filter((w) => w.line === l).length}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {!canAssign && (
          <div className="notice">
            <Icon name="shield" size={16} />
            {user.role}은(는) 작업 배정을 조회만 할 수 있어요. 배정은 라인 반장이 처리해요.
          </div>
        )}

        <div className="assign">
          <section className="card assign__queue" aria-label="미배정 작업지시">
            <header className="assign__head">
              <h2>미배정 작업지시 <span className="num">{lineQueue.length}</span></h2>
              <small>우선순위 → 납기 순</small>
            </header>
            <ul>
              {lineQueue.map((w) => (
                <li
                  key={w.id}
                  className={`wo-card ${dragId === w.id ? 'is-dragging' : ''} ${highlight.includes(w.id) ? 'is-highlight' : ''}`}
                  draggable={canAssign}
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', w.id); setDragId(w.id) }}
                  onDragEnd={() => { setDragId(null); setOver(null) }}
                >
                  <div className="wo-card__top">
                    {canAssign && <Icon name="more" size={16} className="wo-card__grip" />}
                    <Link to={`/work-orders/${w.id}`} className="cell-link num">{w.id}</Link>
                    {w.priority !== '보통' && <Tag tone={PRIORITY_TONE[w.priority]}>{w.priority}</Tag>}
                  </div>
                  <strong>{w.itemName}</strong>
                  <p className="num">{formatNumber(w.qty)} EA · 약 {Math.ceil(hoursOf(w))}시간 · 납기 {formatShortDate(w.due)}{w.due <= TODAY ? ' · 오늘' : ''}</p>
                  {canAssign && (
                    <AssignSelect wo={w} eqs={eqs} onAssign={assign} />
                  )}
                </li>
              ))}
              {lineQueue.length === 0 && (
                <li className="assign__empty"><Icon name="check" size={20} /> {line} 라인에 미배정 작업이 없어요</li>
              )}
            </ul>
            {otherQueue > 0 && <p className="assign__more">다른 라인에 미배정 {otherQueue}건이 있어요</p>}
          </section>

          <section className="assign__board" aria-label={`${line} 라인 설비`}>
            {eqs.map((eq) => {
              const blocked = BLOCKED.includes(eq.status)
              const running = currentWoOf(workOrders, eq.id)
              const waiting = workOrders.filter((w) => w.equip === eq.id && w.status === '대기')
              const qHours = waiting.reduce((n, w) => n + hoursOf(w), 0)
              return (
                <article
                  key={eq.id}
                  className={`eq-card ${blocked ? 'is-blocked' : ''} ${over === eq.id ? (blocked ? 'is-deny' : 'is-over') : ''} ${focusEquip === eq.id ? 'is-focus' : ''}`}
                  onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(eq.id) } }}
                  onDragLeave={() => setOver((o) => (o === eq.id ? null : o))}
                  onDrop={(e) => onDrop(e, eq.id)}
                  aria-label={`${eq.id} ${eq.status}`}
                >
                  <header>
                    <div>
                      <Link to={`/equipment/${eq.id}`} className="num eq-card__id">{eq.id}</Link>
                      <small>{eq.name} · {WORKERS[eq.id] ?? '담당 없음'}</small>
                    </div>
                    <StatusBadge status={eq.status} tone={EQUIP_TONE[eq.status]} />
                  </header>
                  <div className="eq-card__load">
                    <span>오늘 부하</span>
                    <Meter value={EQUIP_LOAD[eq.id]} tone={EQUIP_LOAD[eq.id] >= 85 ? 'warning' : 'brand'} />
                    <strong className="num">{EQUIP_LOAD[eq.id]}%</strong>
                  </div>
                  {running && (
                    <p className="eq-card__now"><StatusBadge status={running.status} /> <Link to={`/work-orders/${running.id}`} className="num">{running.id}</Link> {running.itemName}</p>
                  )}
                  <div className="eq-card__queue">
                    <span className="eq-card__label">대기 작업 {waiting.length}건{waiting.length ? ` · 약 ${Math.ceil(qHours)}시간` : ''}</span>
                    {waiting.map((w) => (
                      <div key={w.id} className="eq-card__wo">
                        <Link to={`/work-orders/${w.id}`} className="num">{w.id.slice(-4)}</Link>
                        <span>{w.itemName}</span>
                        {canAssign && (
                          <IconButton
                            icon="x"
                            label={`${w.id} 배정 해제`}
                            onClick={() => { run('wo/unassign', { id: w.id }); toast(`${w.id} 배정을 해제했어요`) }}
                          />
                        )}
                      </div>
                    ))}
                    {blocked ? (
                      <p className="eq-card__drop is-deny"><Icon name="ban" size={14} /> {eq.status} 중 · 배정 불가</p>
                    ) : (
                      canAssign && <p className="eq-card__drop">{dragId ? '여기에 놓아 배정' : '작업지시를 끌어다 놓으세요'}</p>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
        </div>
      </main>
    </AppLayout>
  )
}

/** 끌어놓기 대신 쓰는 설비 선택 */
function AssignSelect({ wo, eqs, onAssign }) {
  const [equip, setEquip] = useState('')
  return (
    <div className="wo-card__assign">
      <Select
        aria-label={`${wo.id} 배정할 설비`}
        placeholder="설비 선택"
        value={equip}
        onChange={(e) => setEquip(e.target.value)}
        options={eqs.map((e) => ({ value: e.id, label: `${e.id} · ${BLOCKED.includes(e.status) ? e.status : `부하 ${EQUIP_LOAD[e.id]}%`}`, disabled: BLOCKED.includes(e.status) }))}
      />
      <Button variant="primary" disabled={!equip} onClick={() => onAssign(wo.id, equip)}>배정</Button>
    </div>
  )
}
