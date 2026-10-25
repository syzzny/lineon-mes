/**
 * MES 통합 저장소 — 작업지시·설비·비가동·실적·불량·LOT·품목·사용자·권한을 한 곳에서 관리
 *
 * 한 화면의 행동이 다른 화면에 바로 반영되도록 "업무 단위" 액션으로 만들었습니다.
 *   예) 비가동 신고 → 설비 상태 '비가동' + 진행 중 작업지시 '일시정지' + 비가동 이력 추가 + 알림
 * 실제 서비스에서는 아래 api의 함수만 서버 호출로 바꾸면 화면 코드는 그대로 둘 수 있습니다.
 * 지금은 localStorage에 저장해서 새로고침해도 변경 내용이 유지됩니다.
 */
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { EQUIPMENT_LIST, ITEMS, TODAY, WORKERS, WORK_ORDERS, isLate } from '../data/workOrders'
import { DEFECTS, DOWNTIME, LOT_HOLDS, PERMISSIONS, RESULTS, USERS } from '../data/mes'
import { stamp } from '../utils/clock'
import { currentWoOf } from '../utils/mes'



const STORAGE_KEY = 'lineon-mes:data:v3'

const initialState = () => ({
  workOrders: WORK_ORDERS,
  equipment: EQUIPMENT_LIST,
  downtime: DOWNTIME,
  results: RESULTS,
  defects: DEFECTS,
  lotHolds: LOT_HOLDS,
  items: ITEMS,
  users: USERS,
  permissions: PERMISSIONS,
  permissionLog: [
    { at: '2026-10-15 10:20', by: '정수아', note: '라인 반장 · 품질관리 조회 → 처리' },
    { at: '2026-10-02 09:05', by: '정수아', note: '현장 작업자 · 설비관리 조회 → 처리' },
  ],
  extraOutput: { 프레스: 0, 가공: 0, '조립·검사': 0 }, // 오늘 태블릿으로 추가된 생산량 (대시보드 반영)
  readNotices: [],
  userId: 'u01',
})

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...initialState(), ...JSON.parse(saved) }
  } catch {
    /* 저장소를 쓸 수 없으면 기본 데이터 */
  }
  return initialState()
}

/* ---------- 작은 도우미 ---------- */
const ev = (type, status, at, by, note) => ({ type, status, at, by, note })
const mapWo = (s, id, fn) => s.workOrders.map((w) => (w.id === id ? fn(w) : w))
const setEquip = (list, id, changes) => list.map((e) => (e.id === id ? { ...e, ...changes } : e))
const nextNo = (list, prefix) => {
  const max = list.reduce((m, x) => Math.max(m, Number(String(x.id).replace(/\D/g, '').slice(-4)) || 0), 0)
  return `${prefix}${String(max + 1).padStart(2, '0')}`
}

/** 승인 대기 실적에 수량을 더하거나 새로 만듦 */
function addToPendingResult(results, wo, { good = 0, defect = 0, at, by, log }) {
  const i = results.findIndex((r) => r.woId === wo.id && r.status === '승인 대기')
  if (i >= 0) {
    const r = results[i]
    const next = { ...r, good: r.good + good, defect: r.defect + defect, at, log: [log, ...r.log].slice(0, 30) }
    return results.map((x, j) => (j === i ? next : x))
  }
  return [
    {
      id: nextNo(results, 'R-'), woId: wo.id, at, good, defect, minutes: 0, status: '승인 대기',
      itemName: wo.itemName, itemCode: wo.itemCode, line: wo.line, equip: wo.equip, worker: by, rejectReason: '', log: [log],
    },
    ...results,
  ]
}

function reducer(s, a) {
  const { at, by } = a
  switch (a.type) {
    /* ----- 작업지시 ----- */
    case 'wo/create':
      return { ...s, workOrders: [{ ...a.wo, history: [ev('발행', '대기', at, by)] }, ...s.workOrders] }

    case 'wo/update':
      return { ...s, workOrders: mapWo(s, a.id, (w) => ({ ...w, ...a.changes, history: [ev('수정', w.status, at, by, a.summary), ...w.history] })) }

    case 'wo/cancel': {
      const ids = new Set(a.ids)
      return {
        ...s,
        workOrders: s.workOrders.map((w) => (ids.has(w.id) ? { ...w, status: '취소', history: [ev('취소', '취소', at, by, `사유: ${a.reason}`), ...w.history] } : w)),
      }
    }

    case 'wo/finishEarly':
      return {
        ...s,
        workOrders: mapWo(s, a.id, (w) => ({
          ...w, status: '완료', qty: w.done,
          history: [ev('조기 종료', '완료', at, by, `사유: ${a.reason} · ${w.done.toLocaleString('ko-KR')} EA로 확정`), ...w.history],
        })),
      }

    case 'wo/assign': {
      const eq = s.equipment.find((e) => e.id === a.equip)
      return {
        ...s,
        workOrders: mapWo(s, a.id, (w) => ({
          ...w, equip: a.equip, line: eq.line, assigned: true,
          history: [ev('작업자 배정', w.status, at, by, `${WORKERS[a.equip] ?? '작업자'} · ${a.equip} 배정`), ...w.history],
        })),
      }
    }

    case 'wo/unassign':
      return {
        ...s,
        workOrders: mapWo(s, a.id, (w) => ({ ...w, equip: '', assigned: false, history: [ev('배정 해제', w.status, at, by, `${w.equip} 배정 해제`), ...w.history] })),
      }

    case 'wo/start': {
      const wo = s.workOrders.find((w) => w.id === a.id)
      return {
        ...s,
        workOrders: mapWo(s, a.id, (w) => ({ ...w, status: '진행', start: w.start > TODAY ? TODAY : w.start, history: [ev('작업 시작', '진행', at, by), ...w.history] })),
        equipment: setEquip(s.equipment, wo.equip, { status: '가동', since: at, note: '' }),
      }
    }

    case 'wo/endWork': {
      const wo = s.workOrders.find((w) => w.id === a.id)
      return {
        ...s,
        workOrders: mapWo(s, a.id, (w) => ({
          ...w, status: '완료', qty: Math.min(w.qty, w.done) || w.qty,
          history: [ev('작업 종료', '완료', at, by, `${w.done.toLocaleString('ko-KR')} EA 생산 · 실적 승인 요청`), ...w.history],
        })),
        equipment: setEquip(s.equipment, wo.equip, { status: '대기', since: at, note: `${wo.id} 완료` }),
      }
    }

    /* ----- 실적 (태블릿) ----- */
    case 'output/add': {
      const wo = s.workOrders.find((w) => w.id === a.woId)
      const sign = a.good >= 0 ? '+' : ''
      return {
        ...s,
        workOrders: mapWo(s, a.woId, (w) => ({ ...w, done: Math.max(0, w.done + a.good) })),
        results: addToPendingResult(s.results, wo, { good: a.good, at, by, log: `${at} · 양품 ${sign}${a.good}${a.undo ? ' (실행 취소)' : ''}` }),
        extraOutput: { ...s.extraOutput, [wo.line]: (s.extraOutput[wo.line] ?? 0) + a.good },
      }
    }

    /* ----- 불량 ----- */
    case 'defect/add': {
      const wo = s.workOrders.find((w) => w.id === a.defect.woId)
      const d = { id: `D-${TODAY.slice(5).replace('-', '')}-${String(s.defects.length + 1).padStart(3, '0')}`, at, by, status: '미조치', action: '', causeText: '', cause4M: '', ...a.defect }
      return {
        ...s,
        defects: [d, ...s.defects],
        // 태블릿: 새로 만든 것 중 불량 → 생산수량에도 더함 / PC 등록: 이미 만든 것에서 발견 → 불량만 늘림
        workOrders: mapWo(s, wo.id, (w) => ({ ...w, done: a.fromTablet ? w.done + d.qty : w.done, defects: w.defects + d.qty })),
        results: a.fromTablet ? addToPendingResult(s.results, wo, { defect: d.qty, at, by, log: `${at} · 불량 +${d.qty} (${d.type})` }) : s.results,
        extraOutput: a.fromTablet ? { ...s.extraOutput, [wo.line]: (s.extraOutput[wo.line] ?? 0) + d.qty } : s.extraOutput,
      }
    }

    case 'defect/remove': {
      const d = s.defects.find((x) => x.id === a.id)
      if (!d) return s
      const wo = s.workOrders.find((w) => w.id === d.woId)
      return {
        ...s,
        defects: s.defects.filter((x) => x.id !== a.id),
        workOrders: mapWo(s, d.woId, (w) => ({ ...w, done: Math.max(0, w.done - d.qty), defects: Math.max(0, w.defects - d.qty) })),
        results: addToPendingResult(s.results, wo, { defect: -d.qty, at, by, log: `${at} · 불량 -${d.qty} (실행 취소)` }),
        extraOutput: { ...s.extraOutput, [wo.line]: (s.extraOutput[wo.line] ?? 0) - d.qty },
      }
    }

    case 'defect/update':
      return { ...s, defects: s.defects.map((d) => (d.id === a.id ? { ...d, ...a.changes } : d)) }

    /* ----- 실적 승인 ----- */
    case 'results/approve': {
      const ids = new Set(a.ids)
      return { ...s, results: s.results.map((r) => (ids.has(r.id) ? { ...r, status: '승인', approvedBy: by, approvedAt: at } : r)) }
    }
    case 'results/reject':
      return { ...s, results: s.results.map((r) => (r.id === a.id ? { ...r, status: '반려', rejectReason: a.reason, approvedBy: by, approvedAt: at } : r)) }

    /* ----- 비가동 ----- */
    case 'downtime/report': {
      const wo = currentWoOf(s.workOrders, a.equip)
      const pause = wo?.status === '진행'
      return {
        ...s,
        downtime: [{ id: nextNo(s.downtime, 'DT-'), equip: a.equip, start: a.start, end: null, reason: a.reason, woId: wo?.id ?? '', by, note: a.note ?? '', planned: false }, ...s.downtime],
        equipment: setEquip(s.equipment, a.equip, { status: '비가동', since: a.start, note: a.reason }),
        workOrders: pause
          ? mapWo(s, wo.id, (w) => ({ ...w, status: '일시정지', history: [ev('일시정지', '일시정지', at, by, `비가동 · ${a.reason}${a.note ? ` (${a.note})` : ''}`), ...w.history] }))
          : s.workOrders,
      }
    }

    case 'downtime/resume': {
      const open = s.downtime.find((d) => d.equip === a.equip && !d.end)
      const wo = s.workOrders.find((w) => w.equip === a.equip && w.status === '일시정지')
      return {
        ...s,
        downtime: s.downtime.map((d) => (d === open ? { ...d, end: at } : d)),
        equipment: setEquip(s.equipment, a.equip, { status: wo || currentWoOf(s.workOrders, a.equip) ? '가동' : '대기', since: at, note: '' }),
        workOrders: wo ? mapWo(s, wo.id, (w) => ({ ...w, status: '진행', history: [ev('재개', '진행', at, by, `${a.equip} 복구 · ${open?.reason ?? ''}`), ...w.history] })) : s.workOrders,
      }
    }

    case 'downtime/edit':
      return {
        ...s,
        downtime: s.downtime.map((d) => (d.id === a.id ? { ...d, ...a.changes } : d)),
        equipment: a.changes.reason && !s.downtime.find((d) => d.id === a.id)?.end
          ? setEquip(s.equipment, s.downtime.find((d) => d.id === a.id).equip, { note: a.changes.reason })
          : s.equipment,
      }

    /* ----- LOT ----- */
    case 'lot/hold':
      return { ...s, lotHolds: { ...s.lotHolds, [a.lot]: a.hold ? { hold: true, reason: a.reason, by, at } : { hold: false, released: true, reason: a.reason, by, at } } }

    /* ----- 기준정보 ----- */
    case 'items/save': {
      const exists = s.items.some((i) => i.code === a.item.code)
      return { ...s, items: exists ? s.items.map((i) => (i.code === a.item.code ? { ...i, ...a.item } : i)) : [...s.items, a.item] }
    }

    /* ----- 사용자·권한 ----- */
    case 'users/save': {
      const exists = s.users.some((u) => u.id === a.user.id)
      return { ...s, users: exists ? s.users.map((u) => (u.id === a.user.id ? { ...u, ...a.user } : u)) : [...s.users, { ...a.user, id: `u${Date.now()}` }] }
    }
    case 'permissions/save':
      return { ...s, permissions: a.permissions, permissionLog: [...a.log.map((note) => ({ at, by, note })), ...s.permissionLog] }

    /* ----- 공통 ----- */
    case 'notices/read':
      return { ...s, readNotices: [...new Set([...s.readNotices, ...a.ids])] }
    case 'session/switch':
      return { ...s, userId: a.userId }
    case 'reset':
      return { ...initialState(), userId: s.userId }
    default:
      return s
  }
}

const MesContext = createContext(null)

export function MesProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [state])

  const user = state.users.find((u) => u.id === state.userId) ?? state.users[0]

  const api = useMemo(() => {
    // 모든 액션에 "언제·누가"를 붙여서 이력에 남김
    const run = (type, payload = {}) => dispatch({ type, at: stamp(), by: user.name, ...payload })
    return {
      ...state,
      user,
      run,
      equipById: (id) => state.equipment.find((e) => e.id === id),
      woById: (id) => state.workOrders.find((w) => w.id === id),
    }
  }, [state, user])

  return <MesContext.Provider value={api}>{children}</MesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMes() {
  const ctx = useContext(MesContext)
  if (!ctx) throw new Error('useMes는 MesProvider 안에서 써야 해요')
  return ctx
}

/** 작업지시 화면용 (기존 화면 코드와 같은 모양) */
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkOrders() {
  const { workOrders, run } = useMes()
  return useMemo(
    () => ({
      workOrders,
      getById: (id) => workOrders.find((w) => w.id === id),
      nextId: () => {
        const max = workOrders.reduce((m, w) => Math.max(m, Number(w.id.slice(-4))), 0)
        return `WO-2610-${String(max + 1).padStart(4, '0')}`
      },
      create: (wo) => run('wo/create', { wo }),
      update: (id, changes, summary) => run('wo/update', { id, changes, summary }),
      cancel: (ids, reason) => run('wo/cancel', { ids, reason }),
      finishEarly: (id, reason) => run('wo/finishEarly', { id, reason }),
    }),
    [workOrders, run],
  )
}

/* ---------- 알림 (CM-02) — 데이터에서 바로 계산 ---------- */
// eslint-disable-next-line react-refresh/only-export-components
export function useNotices() {
  const { downtime, results, defects, workOrders, readNotices } = useMes()
  return useMemo(() => {
    const list = []
    downtime.filter((d) => !d.end && !d.planned).forEach((d) =>
      list.push({ id: `dt-${d.id}`, tone: 'danger', label: '비가동', title: `${d.equip} 비가동 · ${d.reason}`, desc: d.woId ? `${d.woId} 일시정지됨 · ${d.by} 신고` : `${d.by} 신고`, at: d.start, to: `/equipment/${d.equip}` }),
    )
    list.push({ id: 'cycle-CNC-03', tone: 'warning', label: '경고', title: 'CNC-03 사이클 타임 +18%', desc: '기준 6:00 → 7:05 · WO-2610-0144', at: `${TODAY} 14:21`, to: '/line-monitoring?line=가공' })
    const pending = results.filter((r) => r.status === '승인 대기')
    if (pending.length) {
      const oldest = pending.reduce((a, b) => (a.at < b.at ? a : b))
      list.push({ id: `res-${pending.length}-${oldest.id}`, tone: 'brand', label: '승인', title: `실적 승인 대기 ${pending.length}건`, desc: `가장 오래된 건 ${oldest.at.slice(11)} 입력`, at: oldest.at, to: '/results/approval' })
    }
    const open = defects.filter((d) => d.status === '미조치')
    if (open.length) list.push({ id: `def-${open.length}`, tone: 'warning', label: '불량', title: `미조치 불량 ${open.length}건`, desc: '원인·조치 입력이 필요해요', at: open[0].at, to: '/defects?status=미조치' })
    const late = workOrders.filter(isLate)
    if (late.length) list.push({ id: `late-${late.map((w) => w.id).join()}`, tone: 'danger', label: '납기', title: `납기 지연 작업지시 ${late.length}건`, desc: late.slice(0, 2).map((w) => w.id).join(', '), at: `${TODAY} 08:00`, to: '/work-orders' })
    list.sort((a, b) => b.at.localeCompare(a.at))
    return list.map((n) => ({ ...n, read: readNotices.includes(n.id) }))
  }, [downtime, results, defects, workOrders, readNotices])
}
