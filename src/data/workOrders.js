/**
 * 시드 데이터 — 기준 시각 2026-10-22 (목) 14:32
 * 모든 화면이 이 데이터에서 시작하고, 이후 변경은 저장소(store)에 저장됩니다.
 */
export const TODAY = '2026-10-22'
export const NOW_TIME = '14:32'
export const NOW = `${TODAY} ${NOW_TIME}`

export const LINES = ['프레스', '가공', '조립·검사']

export const LEADS = {
  프레스: '박서진',
  가공: '이정우',
  '조립·검사': '최현우',
}

/** 품목 마스터 (MD-01) — 표준 공정·사이클 타임 포함 */
export const ITEMS = [
  { code: 'BR-2201', name: '브레이크 브래킷 A', group: '브레이크 브래킷', line: '프레스', route: ['프레스', '검사·포장'], cycle: 45 },
  { code: 'BR-2202', name: '브레이크 브래킷 B', group: '브레이크 브래킷', line: '프레스', route: ['프레스', '검사·포장'], cycle: 45 },
  { code: 'BR-2203', name: '브레이크 브래킷 C', group: '브레이크 브래킷', line: '프레스', route: ['프레스', '용접', '검사·포장'], cycle: 52 },
  { code: 'BR-2204', name: '브레이크 브래킷 D', group: '브레이크 브래킷', line: '프레스', route: ['프레스', '검사·포장'], cycle: 48 },
  { code: 'BR-2205', name: '브레이크 브래킷 E (단종)', group: '브레이크 브래킷', line: '프레스', route: ['프레스', '검사·포장'], cycle: 45, active: false },
  { code: 'BR-2210', name: '브래킷 보강판', group: '브래킷 부속', line: '가공', route: ['프레스', '표면처리', '검사·포장'], cycle: 30 },
  { code: 'BR-2211', name: '브래킷 고정 핀', group: '브래킷 부속', line: '가공', route: ['CNC 가공', '검사·포장'], cycle: 18 },
  { code: 'EM-1108', name: '엔진 마운트 L', group: '엔진 마운트', line: '가공', route: ['CNC 가공', '검사·포장'], cycle: 360 },
  { code: 'EM-1110', name: '엔진 마운트 R', group: '엔진 마운트', line: '가공', route: ['CNC 가공', '검사·포장'], cycle: 360 },
  { code: 'EM-1112', name: '엔진 마운트 브래킷', group: '엔진 마운트', line: '가공', route: ['CNC 가공', '표면처리', '검사·포장'], cycle: 240 },
  { code: 'WD-3301', name: '서스펜션 암 가공', group: '서스펜션', line: '조립·검사', route: ['CNC 가공', '용접', '검사·포장'], cycle: 420 },
  { code: 'WD-3302', name: '서스펜션 암 용접', group: '서스펜션', line: '조립·검사', route: ['용접', '검사·포장'], cycle: 300 },
  { code: 'WD-3305', name: '서스펜션 부싱 조립', group: '서스펜션', line: '조립·검사', route: ['조립', '검사·포장'], cycle: 120 },
].map((i) => ({ unit: 'EA', active: true, ...i }))

/* ---------- 설비 (김해공장 25대) ---------- */

const EQ_TYPES = {
  프레스: (n) => ({ id: `PR-${String(n).padStart(2, '0')}`, name: `${n <= 6 ? 200 : 400}톤 프레스` }),
  가공: (n) => ({ id: `CNC-${String(n).padStart(2, '0')}`, name: n === 3 || n === 5 ? '5축 가공기' : n >= 7 ? '선반' : '4축 가공기' }),
}
const ASSEMBLY = [
  { id: 'WD-01', name: '로봇 용접기' }, { id: 'WD-02', name: '로봇 용접기' }, { id: 'WD-03', name: '로봇 용접기' }, { id: 'WD-04', name: '수동 용접대' },
  { id: 'AS-01', name: '부싱 압입기' }, { id: 'AS-02', name: '부싱 압입기' }, { id: 'IN-01', name: '비전 검사기' }, { id: 'IN-02', name: '3차원 측정기' },
]

const SPECIAL_STATUS = {
  'CNC-05': { status: '비가동', since: `${TODAY} 13:57` },
  'CNC-04': { status: '대기', since: `${TODAY} 11:20` },
  'PR-04': { status: '대기', since: `${TODAY} 10:05` },
  'CNC-08': { status: '점검', since: `${TODAY} 13:00`, note: '계획 정비 13:00–15:00 · 설비팀' },
}

export const EQUIPMENT_LIST = [
  ...Array.from({ length: 9 }, (_, i) => ({ ...EQ_TYPES.프레스(i + 1), line: '프레스' })),
  ...Array.from({ length: 8 }, (_, i) => ({ ...EQ_TYPES.가공(i + 1), line: '가공' })),
  ...ASSEMBLY.map((e) => ({ ...e, line: '조립·검사' })),
].map((e) => ({ status: '가동', since: `${TODAY} 08:00`, note: '', ...e, ...SPECIAL_STATUS[e.id] }))

/** 라인별 설비 ID */
export const EQUIPMENT = Object.fromEntries(LINES.map((l) => [l, EQUIPMENT_LIST.filter((e) => e.line === l).map((e) => e.id)]))

/** 설비별 오늘 부하(%) — 배정·발행 화면 참고용 */
export const EQUIP_LOAD = {
  'PR-01': 70, 'PR-02': 45, 'PR-03': 85, 'PR-04': 10, 'PR-05': 62, 'PR-06': 58, 'PR-07': 55, 'PR-08': 66, 'PR-09': 40,
  'CNC-01': 45, 'CNC-02': 60, 'CNC-03': 85, 'CNC-04': 0, 'CNC-05': 0, 'CNC-06': 72, 'CNC-07': 50, 'CNC-08': 0,
  'WD-01': 40, 'WD-02': 65, 'WD-03': 52, 'WD-04': 30, 'AS-01': 48, 'AS-02': 35, 'IN-01': 60, 'IN-02': 25,
}

/** 설비 담당 작업자 (태블릿 로그인) */
export const WORKERS = {
  'CNC-01': '김태호', 'CNC-02': '정하늘', 'CNC-03': '윤서준', 'CNC-05': '이정우', 'CNC-06': '오민재', 'CNC-07': '한지우',
  'PR-01': '이민호', 'PR-02': '이민호', 'PR-03': '이민호', 'PR-05': '강도현', 'PR-06': '강도현', 'PR-07': '서유진', 'PR-08': '서유진', 'PR-09': '강도현',
  'WD-01': '최현우', 'WD-02': '문지아', 'WD-03': '문지아', 'WD-04': '최현우', 'AS-01': '배지성', 'AS-02': '배지성', 'IN-01': '최유나', 'IN-02': '최유나',
}

export const PLANS = ['2026년 43주차 주간계획', '2026년 44주차 주간계획']
export const PRIORITIES = ['긴급', '높음', '보통']

/* ---------- 작업지시 ---------- */

// 시안·라인 모니터링과 맞춘 상위 17건 [번호, 상태, 품목, 설비, 생산, 지시, 납기, 시작, 배정 여부]
const FEATURED = [
  ['0150', '대기', 'EM-1110', '', 0, 400, '2026-10-26', '2026-10-23', false],
  ['0149', '대기', 'WD-3301', '', 0, 300, '2026-10-25', '2026-10-23', false],
  ['0148', '진행', 'WD-3302', 'WD-01', 210, 600, '2026-10-24', '2026-10-22', true],
  ['0147', '대기', 'EM-1108', '', 0, 600, '2026-10-24', '2026-10-22', false],
  ['0146', '진행', 'BR-2210', 'CNC-07', 854, 1000, '2026-10-23', '2026-10-22', true],
  ['0145', '진행', 'EM-1110', 'CNC-06', 640, 800, '2026-10-23', '2026-10-21', true],
  ['0144', '진행', 'WD-3301', 'CNC-03', 96, 300, '2026-10-24', '2026-10-22', true],
  ['0143', '진행', 'EM-1108', 'CNC-01', 420, 600, '2026-10-23', '2026-10-22', true],
  ['0142', '진행', 'BR-2201', 'PR-03', 1240, 2000, '2026-10-24', '2026-10-22', true],
  ['0141', '일시정지', 'EM-1108', 'CNC-05', 310, 800, '2026-10-21', '2026-10-21', true],
  ['0140', '대기', 'BR-2203', 'PR-01', 0, 1500, '2026-10-25', '2026-10-23', true],
  ['0139', '진행', 'EM-1110', 'CNC-02', 520, 800, '2026-10-23', '2026-10-22', true],
  ['0138', '대기', 'BR-2201', 'PR-02', 0, 2000, '2026-10-27', '2026-10-24', true],
  ['0137', '대기', 'WD-3302', 'WD-01', 0, 600, '2026-10-27', '2026-10-24', true],
  ['0136', '완료', 'BR-2203', 'PR-01', 1500, 1500, '2026-10-22', '2026-10-20', true],
  ['0135', '진행', 'WD-3301', 'WD-02', 120, 400, '2026-10-24', '2026-10-22', true],
  ['0134', '완료', 'EM-1108', 'CNC-05', 800, 800, '2026-10-20', '2026-10-18', true],
]

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 결정적(매번 같은) 난수
let seed = 42
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

/** 작업지시 → LOT 번호 (시작일 + 번호) */
export const lotOf = (wo) => `L${wo.start.slice(2, 4)}${wo.start.slice(5, 7)}-${wo.start.slice(8, 10)}-${wo.id.slice(-3)}`

/** 상태에 맞는 진행 이력 (최신순) */
function makeHistory(wo) {
  const h = [{ type: '발행', status: '대기', at: `${addDays(wo.start, -1)} 14:20`, by: '김도윤' }]
  if (wo.assigned) h.push({ type: '작업자 배정', status: '대기', at: `${wo.start} 07:50`, by: wo.lead, note: `${wo.equip} 배정` })
  if (wo.status === '대기') return h.reverse()
  h.push({ type: '작업 시작', status: '진행', at: `${wo.start} 08:20`, by: WORKERS[wo.equip] ?? '작업자' })
  if (wo.status === '일시정지') h.push({ type: '일시정지', status: '일시정지', at: `${TODAY} 13:57`, by: wo.lead, note: '비가동 · 공구 파손' })
  if (wo.status === '완료') h.push({ type: '작업 종료', status: '완료', at: `${wo.due} 17:00`, by: WORKERS[wo.equip] ?? '작업자', note: `${wo.done.toLocaleString('ko-KR')} EA 생산` })
  return h.reverse()
}

const itemByCode = (code) => ITEMS.find((i) => i.code === code)

const build = (no, status, item, equip, done, qty, due, start, assigned = true) => {
  const wo = {
    id: `WO-2610-${no}`,
    status,
    itemCode: item.code,
    itemName: item.name,
    route: item.route,
    line: item.line,
    equip,
    assigned,
    done,
    defects: status === '대기' ? 0 : Math.round(done * 0.015),
    qty,
    due,
    start,
    startTime: '08:00',
    lead: LEADS[item.line],
    priority: '보통',
    plan: due > '2026-10-25' ? PLANS[1] : PLANS[0],
    memo: '',
  }
  wo.history = makeHistory(wo)
  return wo
}

const featured = FEATURED.map(([no, status, code, equip, done, qty, due, start, assigned]) =>
  build(no, status, itemByCode(code), equip, done, qty, due, start, assigned),
)
const f0142 = featured.find((w) => w.id === 'WO-2610-0142')
f0142.memo = '고객사 출하 일정 확인 필요 (10.24 오전 출하)'
f0142.defects = 18
f0142.history = [
  { type: '재개', status: '진행', at: '2026-10-22 11:40', by: '박서진', note: '설비 복구 완료' },
  { type: '일시정지', status: '일시정지', at: '2026-10-22 11:05', by: '박서진', note: '금형 교체 지연 (PR-03)' },
  { type: '작업 시작', status: '진행', at: '2026-10-22 09:12', by: '이민호' },
  { type: '작업자 배정', status: '대기', at: '2026-10-22 08:30', by: '박서진', note: '이민호 · PR-03 배정' },
  { type: '발행', status: '대기', at: '2026-10-21 14:20', by: '김도윤' },
]
featured.find((w) => w.id === 'WO-2610-0143').defects = 16
featured.find((w) => w.id === 'WO-2610-0147').priority = '높음'

// 나머지 111건 — 전체 128건. 가동 중인 설비에만 배정
const RUNNING_POOL = Object.fromEntries(
  LINES.map((l) => [l, EQUIPMENT_LIST.filter((e) => e.line === l && e.status === '가동').map((e) => e.id)]),
)
const GEN_ITEMS = ITEMS.filter((i) => i.active)
const plan = [...Array(33).fill('대기'), ...Array(51).fill('진행'), ...Array(27).fill('완료')]
const generated = plan.map((status, i) => {
  const item = pick(GEN_ITEMS)
  const qty = pick([300, 400, 600, 800, 1000, 1500, 2000])
  const no = String(133 - i).padStart(4, '0')
  let start, due, done
  if (status === '완료') {
    start = addDays(TODAY, -Math.ceil(rand() * 12) - 2)
    due = addDays(start, 2 + Math.floor(rand() * 3))
    done = qty
  } else if (status === '진행') {
    start = addDays(TODAY, -Math.floor(rand() * 2))
    due = addDays(TODAY, 1 + Math.floor(rand() * 5))
    done = Math.round((qty * (0.1 + rand() * 0.8)) / 10) * 10
  } else {
    start = addDays(TODAY, Math.floor(rand() * 5))
    due = addDays(start, 2 + Math.floor(rand() * 4))
    done = 0
  }
  if (status === '대기' && i < 10) start = TODAY
  if (status === '진행' && (i === 40 || i === 41)) due = addDays(TODAY, -1 - (i - 40))
  const assigned = !(status === '대기' && i % 4 === 1)
  return build(no, status, item, assigned ? pick(RUNNING_POOL[item.line]) : '', done, qty, due, start, assigned)
})

export const WORK_ORDERS = [...featured, ...generated]

export const isLate = (wo) => wo.status !== '완료' && wo.status !== '취소' && wo.due < TODAY
