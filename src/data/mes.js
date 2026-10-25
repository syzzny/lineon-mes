/**
 * 작업지시 외 시드 데이터: 실적, 불량, 비가동, LOT, 사용자, 권한
 */
import { ITEMS, LEADS, NOW, TODAY, WORK_ORDERS, WORKERS, addDays, lotOf } from './workOrders'

let seed = 7
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const pad = (n) => String(n).padStart(2, '0')

/* ---------- 불량 유형·원인 ---------- */
export const DEFECT_TYPES = ['버(Burr)', '치수 불량', '찍힘·스크래치', '용접 불량', '기타']
export const CAUSE_4M = ['사람', '설비', '자재', '방법']
export const ACTION_STATUSES = ['미조치', '조치중', '완료']

/* ---------- 비가동 사유 (EQ-03 신고 버튼과 같은 코드) ---------- */
export const DOWNTIME_REASONS = ['설비 고장', '공구 파손', '자재 대기', '셋업·품목 전환', '품질 이상', '기타']
export const PLANNED_REASON = '계획 정비'

/* ---------- 시간대별 생산 (DB-01) ---------- */
export const HOURLY_BASE = [
  { hour: '08', value: 1720 }, { hour: '09', value: 1860 }, { hour: '10', value: 1910 }, { hour: '11', value: 1780 },
  { hour: '12', value: 820 }, { hour: '13', value: 1690 }, { hour: '14', value: 980 }, { hour: '15', value: 0 }, { hour: '16', value: 0 },
]
export const HOURLY_TARGET = 1840
export const DAILY_PLAN = 18400

/** 라인별 오늘 계획 */
export const LINE_PLAN = { 프레스: 9600, 가공: 4800, '조립·검사': 4000 }
export const LINE_DONE_BASE = { 프레스: 6120, 가공: 2840, '조립·검사': 1800 }

/* ---------- 생산실적 (PR-01·02) ---------- */
const woById = Object.fromEntries(WORK_ORDERS.map((w) => [w.id, w]))

const RESULT_SEED = [
  // [작업지시, 시각, 양품, 불량, 작업시간(분), 상태]
  ['WO-2610-0143', `${TODAY} 14:28`, 404, 16, 372, '승인 대기'],
  ['WO-2610-0142', `${TODAY} 14:10`, 1222, 18, 320, '승인 대기'],
  ['WO-2610-0139', `${TODAY} 13:55`, 512, 8, 280, '승인 대기'],
  ['WO-2610-0146', `${TODAY} 11:05`, 850, 4, 362, '승인 대기'],
  ['WO-2610-0144', `${TODAY} 12:40`, 93, 3, 65, '승인 대기'],
  ['WO-2610-0148', `${TODAY} 12:30`, 208, 2, 250, '승인 대기'],
  ['WO-2610-0145', `${TODAY} 12:00`, 634, 6, 340, '승인'],
  ['WO-2610-0136', '2026-10-21 17:00', 1478, 22, 480, '승인'],
  ['WO-2610-0135', '2026-10-21 16:40', 118, 2, 150, '반려'],
  ['WO-2610-0134', '2026-10-20 17:00', 794, 6, 470, '승인'],
]

const seededResults = RESULT_SEED.map(([woId, at, good, defect, minutes, status], i) => {
  const w = woById[woId]
  return {
    id: `R-${pad(i + 1)}`, woId, at, good, defect, minutes, status,
    itemName: w.itemName, itemCode: w.itemCode, line: w.line, equip: w.equip, worker: WORKERS[w.equip] ?? '작업자',
    rejectReason: status === '반려' ? '수량 재확인 필요' : '',
    log: [],
  }
})
seededResults.find((r) => r.woId === 'WO-2610-0143').log = [
  `${TODAY} 14:28 · 양품 +20`, `${TODAY} 14:05 · 불량 +1 (치수 불량)`, `${TODAY} 13:51 · 양품 +20`, `${TODAY} 13:40 · 불량 +7 (버)`, `${TODAY} 13:22 · 양품 +20`,
]

// 다른 진행·완료 작업지시의 과거 실적 (승인 완료)
const extraResults = WORK_ORDERS.filter((w) => !RESULT_SEED.some((r) => r[0] === w.id) && w.done > 0)
  .slice(0, 60)
  .map((w, i) => ({
    id: `R-${pad(i + 20)}`, woId: w.id, at: `${w.start} ${pad(13 + (i % 4))}:${pad((i * 7) % 60)}`,
    good: w.done - w.defects, defect: w.defects, minutes: 180 + (i % 5) * 60,
    status: '승인', itemName: w.itemName, itemCode: w.itemCode, line: w.line, equip: w.equip,
    worker: WORKERS[w.equip] ?? '작업자', rejectReason: '', log: [],
  }))

export const RESULTS = [...seededResults, ...extraResults]

/* ---------- 불량 (QC-01·02) ---------- */
// 10월 1일~22일 일별 불량률(%) — QC-02 추이 차트
const DAILY_RATE = [1.4, 1.6, 1.3, 1.5, 1.7, 1.9, 2.4, 1.8, 1.5, 1.4, 1.3, 1.6, 1.9, 2.2, 1.7, 1.5, 1.4, 1.2, 1.5, 1.6, 1.4, 1.5]
export const DAILY_OUTPUT = 6200 // 하루 평균 생산 (EA)
const TYPE_WEIGHT = [38, 27, 18, 11, 6]
const pickType = () => {
  let r = rand() * 100
  for (let i = 0; i < TYPE_WEIGHT.length; i++) {
    r -= TYPE_WEIGHT[i]
    if (r <= 0) return DEFECT_TYPES[i]
  }
  return DEFECT_TYPES[0]
}
const DONE_WOS = WORK_ORDERS.filter((w) => w.done > 0)

const generatedDefects = []
DAILY_RATE.forEach((rate, idx) => {
  const day = `2026-10-${pad(idx + 1)}`
  let remain = Math.round((DAILY_OUTPUT * rate) / 100)
  let n = 0
  while (remain > 0) {
    const qty = Math.min(remain, 4 + Math.floor(rand() * 18))
    remain -= qty
    const w = pick(DONE_WOS)
    const type = w.line === '조립·검사' && rand() < 0.5 ? '용접 불량' : pickType()
    generatedDefects.push({
      id: `D-${day.slice(5).replace('-', '')}-${pad(++n)}`,
      at: `${day} ${pad(8 + Math.floor(rand() * (day === TODAY ? 6 : 9)))}:${pad(Math.floor(rand() * 60))}`, // 오늘은 기준 시각 이전까지만
      woId: w.id, lot: lotOf(w), itemCode: w.itemCode, itemName: w.itemName, line: w.line, equip: w.equip,
      type, qty, cause4M: pick(CAUSE_4M), causeText: '', status: idx < 20 ? '완료' : pick(['완료', '조치중']),
      by: WORKERS[w.equip] ?? '최유나', action: idx < 20 ? '원인 조치 완료' : '',
    })
  }
})

// 오늘 주요 불량 (시안과 같은 내용)
const w0143 = woById['WO-2610-0143']
const w0142 = woById['WO-2610-0142']
const TODAY_DEFECTS = [
  { id: 'D-1022-91', at: `${TODAY} 13:40`, wo: w0143, type: '버(Burr)', qty: 7, cause4M: '설비', status: '미조치', by: '김태호', causeText: '' },
  { id: 'D-1022-92', at: `${TODAY} 10:15`, wo: w0142, type: '버(Burr)', qty: 12, cause4M: '설비', status: '조치중', by: '이민호', causeText: '금형 마모' },
  { id: 'D-1022-93', at: `${TODAY} 10:15`, wo: w0142, type: '치수 불량', qty: 5, cause4M: '설비', status: '미조치', by: '최유나', causeText: '금형 마모로 홀 위치 편차 발생 (+0.3mm)' },
  { id: 'D-1022-94', at: `${TODAY} 12:40`, wo: w0142, type: '찍힘·스크래치', qty: 1, cause4M: '사람', status: '완료', by: '이민호', causeText: '적재 중 충돌' },
  { id: 'D-1022-95', at: `${TODAY} 14:05`, wo: w0143, type: '치수 불량', qty: 1, cause4M: '방법', status: '미조치', by: '김태호', causeText: '' },
].map(({ wo, ...d }) => ({
  ...d, woId: wo.id, lot: lotOf(wo), itemCode: wo.itemCode, itemName: wo.itemName, line: wo.line, equip: wo.equip, action: '',
}))

export const DEFECTS = [...TODAY_DEFECTS, ...generatedDefects].sort((a, b) => b.at.localeCompare(a.at))

/* ---------- 비가동 (EQ-01·02) ---------- */
const DOWNTIME_SEED = [
  ['CNC-05', `${TODAY} 13:57`, null, '공구 파손', 'WO-2610-0141', '이정우', ''],
  ['CNC-08', `${TODAY} 13:00`, `${TODAY} 15:00`, PLANNED_REASON, '', '설비팀', '정기 점검'],
  ['CNC-05', `${TODAY} 09:10`, `${TODAY} 09:25`, '셋업·품목 전환', 'WO-2610-0141', '김태호', '품목 전환'],
  ['PR-03', `${TODAY} 11:05`, `${TODAY} 11:40`, '설비 고장', 'WO-2610-0142', '박서진', '금형 교체 지연'],
  ['PR-03', '2026-10-21 16:20', '2026-10-21 16:50', '설비 고장', 'WO-2610-0142', '박서진', '금형 클램프 이상'],
  ['WD-01', '2026-10-21 10:05', '2026-10-21 10:40', '자재 대기', 'WO-2610-0137', '최현우', '용접봉 입고 지연'],
  ['CNC-05', '2026-10-18 10:20', '2026-10-18 11:05', '자재 대기', '', '이정우', '소재 입고 지연'],
  ['CNC-05', '2026-10-15 15:10', '2026-10-15 15:40', '설비 고장', '', '이정우', '유압 이상 · 설비팀 조치'],
  ['CNC-04', '2026-10-11 08:00', '2026-10-11 08:25', '셋업·품목 전환', '', '김태호', '품목 전환'],
]
const EQ_IDS = Object.keys(WORKERS)
const generatedDowntime = Array.from({ length: 34 }, () => {
  const day = addDays('2026-10-01', Math.floor(rand() * 20))
  const h = 8 + Math.floor(rand() * 8)
  const m = Math.floor(rand() * 50)
  const dur = 10 + Math.floor(rand() * 50)
  const endM = h * 60 + m + dur
  const equip = pick(EQ_IDS)
  return [equip, `${day} ${pad(h)}:${pad(m)}`, `${day} ${pad(Math.floor(endM / 60))}:${pad(endM % 60)}`, pick(['설비 고장', '설비 고장', '자재 대기', '공구 파손', '셋업·품목 전환', '셋업·품목 전환', '기타']), '', WORKERS[equip], '']
})
export const DOWNTIME = [...DOWNTIME_SEED, ...generatedDowntime].map(([equip, start, end, reason, woId, by, note], i) => ({
  id: `DT-${pad(i + 1)}`, equip, start, end, reason, woId, by, note, planned: reason === PLANNED_REASON,
}))

/* ---------- LOT 출하 상태 (QC-03) ---------- */
export const LOT_HOLDS = { [lotOf(w0142)]: { hold: true, reason: '치수 불량 조사', by: '최유나', at: `${TODAY} 10:30` } }

/** 원자재 LOT — 같은 품목군·같은 주에 입고된 소재 */
export const materialLotOf = (wo) => {
  const prefix = wo.itemCode.slice(0, 2)
  const week = wo.start >= '2026-10-19' ? '15-004' : wo.start >= '2026-10-12' ? '08-011' : '01-007'
  return `M2610-${week}-${prefix}`
}
export const MATERIAL_INFO = {
  BR: { name: '강판 SPCC 2.3t', vendor: '대성철강(가상)' },
  EM: { name: '주물 FCD450', vendor: '한일주물(가상)' },
  WD: { name: '강관 STKM13A', vendor: '대성철강(가상)' },
}

/* ---------- 사용자·역할 (SY-01·02) ---------- */
export const ROLES = ['생산관리팀장', '라인 반장', '현장 작업자', '품질 담당', '시스템 관리자']

export const USERS = [
  { id: 'u01', name: '김도윤', role: '생산관리팀장', line: '전체', email: 'doyun.kim@hangyeol.example', active: true, lastLogin: `${TODAY} 08:02` },
  { id: 'u02', name: '오세린', role: '생산관리팀장', line: '전체', email: 'serin.oh@hangyeol.example', active: true, lastLogin: '2026-10-21 17:40' },
  { id: 'u03', name: '박서진', role: '라인 반장', line: '프레스', email: 'seojin.park@hangyeol.example', active: true, lastLogin: `${TODAY} 07:48` },
  { id: 'u04', name: '이정우', role: '라인 반장', line: '가공', email: 'jungwoo.lee@hangyeol.example', active: true, lastLogin: `${TODAY} 07:51` },
  { id: 'u05', name: '최현우', role: '라인 반장', line: '조립·검사', email: 'hyunwoo.choi@hangyeol.example', active: true, lastLogin: `${TODAY} 07:55` },
  { id: 'u06', name: '최유나', role: '품질 담당', line: '전체', email: 'yuna.choi@hangyeol.example', active: true, lastLogin: `${TODAY} 08:10` },
  { id: 'u07', name: '한승민', role: '품질 담당', line: '전체', email: 'seungmin.han@hangyeol.example', active: true, lastLogin: '2026-10-20 16:22' },
  { id: 'u08', name: '정수아', role: '시스템 관리자', line: '전체', email: 'sua.jung@hangyeol.example', active: true, lastLogin: `${TODAY} 09:30` },
  ...[...new Set(Object.values(WORKERS))]
    .filter((n) => !['이정우', '최현우', '최유나'].includes(n))
    .map((name, i) => {
      const equip = Object.keys(WORKERS).find((k) => WORKERS[k] === name)
      const line = equip.startsWith('PR') ? '프레스' : equip.startsWith('CNC') ? '가공' : '조립·검사'
      return { id: `u${pad(20 + i)}`, name, role: '현장 작업자', line, email: '', active: name !== '배지성', lastLogin: `${TODAY} 08:0${i % 10}` }
    }),
]

/** 데모에서 전환할 수 있는 로그인 사용자 */
export const DEMO_ACCOUNTS = ['u01', 'u04', 'u06', 'u08']

/* ---------- 권한 (SY-02) ---------- */
export const PERMISSION_LEVELS = ['처리', '조회', '숨김']

/** 메뉴 키는 config/navigation.js의 key와 같음 */
export const PERMISSION_ROWS = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'planning', label: '생산계획·작업지시', children: [
    { key: 'PP-01', label: '생산계획' },
    { key: 'PP-03', label: '작업지시 조회' },
    { key: 'PP-05', label: '작업지시 등록·수정' },
    { key: 'PP-06', label: '작업 배정' },
  ] },
  { key: 'results', label: '생산실적' },
  { key: 'quality', label: '품질관리' },
  { key: 'equipment', label: '설비관리' },
  { key: 'master', label: '기준정보' },
  { key: 'system', label: '시스템 관리' },
]

export const PERMISSIONS = {
  생산관리팀장: { dashboard: '조회', 'PP-01': '처리', 'PP-03': '처리', 'PP-05': '처리', 'PP-06': '조회', results: '처리', quality: '조회', equipment: '조회', master: '조회', system: '숨김', scope: '전체' },
  '라인 반장': { dashboard: '조회', 'PP-01': '조회', 'PP-03': '조회', 'PP-05': '숨김', 'PP-06': '처리', results: '처리', quality: '처리', equipment: '처리', master: '조회', system: '숨김', scope: '담당 라인' },
  '현장 작업자': { dashboard: '숨김', 'PP-01': '숨김', 'PP-03': '숨김', 'PP-05': '숨김', 'PP-06': '숨김', results: '처리', quality: '처리', equipment: '처리', master: '숨김', system: '숨김', scope: '본인 작업' },
  '품질 담당': { dashboard: '조회', 'PP-01': '조회', 'PP-03': '조회', 'PP-05': '숨김', 'PP-06': '숨김', results: '조회', quality: '처리', equipment: '조회', master: '조회', system: '숨김', scope: '전체' },
  '시스템 관리자': { dashboard: '조회', 'PP-01': '조회', 'PP-03': '조회', 'PP-05': '조회', 'PP-06': '조회', results: '조회', quality: '조회', equipment: '처리', master: '처리', system: '처리', scope: '전체' },
}
export const SCOPES = ['전체', '담당 라인', '본인 작업']

export { LEADS, NOW, ITEMS }

/* ---------- 생산계획 중 아직 작업지시로 발행하지 않은 건 (PP-01) ---------- */
export const PLAN_ONLY = [
  { id: 'P-4301', itemCode: 'BR-2204', qty: 1200, line: '프레스', from: '2026-10-23', to: '2026-10-26', plan: '2026년 43주차 주간계획' },
  { id: 'P-4302', itemCode: 'EM-1112', qty: 400, line: '가공', from: '2026-10-24', to: '2026-10-28', plan: '2026년 43주차 주간계획' },
  { id: 'P-4401', itemCode: 'WD-3305', qty: 800, line: '조립·검사', from: '2026-10-26', to: '2026-10-29', plan: '2026년 44주차 주간계획' },
  { id: 'P-4402', itemCode: 'BR-2210', qty: 1500, line: '가공', from: '2026-10-27', to: '2026-10-30', plan: '2026년 44주차 주간계획' },
  { id: 'P-4403', itemCode: 'BR-2202', qty: 2000, line: '프레스', from: '2026-10-28', to: '2026-10-31', plan: '2026년 44주차 주간계획' },
]
