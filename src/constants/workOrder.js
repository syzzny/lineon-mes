import { TODAY, isLate } from '../data/workOrders'

/** 작업지시 상태 — 기획 문서 "작업지시 상태 정의"와 동일 */
export const WO_STATUSES = ['대기', '진행', '일시정지', '완료', '취소']

/** 목록 기본 필터: 취소 제외 */
export const DEFAULT_STATUS_FILTER = ['대기', '진행', '일시정지', '완료']

/* ---------- 상태별 가능한 액션 (기획 문서 "상태별 가능한 액션" 표) ---------- */

/** 취소: 시작 전(대기)만 가능 */
export const CAN_CANCEL = (wo) => wo.status === '대기'

/** 조기 종료: 진행 중이거나 일시정지일 때. 만든 수량은 실적으로 보존 */
export const CAN_FINISH_EARLY = (wo) => wo.status === '진행' || wo.status === '일시정지'

/** 수정: 완료·취소가 아니면 가능 */
export const CAN_EDIT = (wo) => wo.status === '대기' || wo.status === '진행' || wo.status === '일시정지'

/** 진행 중(진행·일시정지)에는 지시수량·납기만 수정 가능 */
export const EDITABLE_WHEN_RUNNING = ['qty', 'due']
export const isRunning = (wo) => wo.status === '진행' || wo.status === '일시정지'

/** 비활성 버튼에 보여줄 이유 */
export const DISABLED_REASON = {
  cancel: '진행 중인 작업지시는 취소할 수 없어요. 조기 종료를 이용하세요.',
  cancelClosed: '이미 종료된 작업지시예요.',
  edit: '완료되거나 취소된 작업지시는 수정할 수 없어요.',
  finish: '진행 중인 작업지시만 조기 종료할 수 있어요.',
}

export const CANCEL_REASONS = ['고객사 주문 변경', '생산계획 변경', '중복 발행', '자재 수급 불가', '기타']
export const FINISH_REASONS = ['고객사 수량 변경', '설비 장기 고장', '품질 이상으로 중단', '기타']

/** 저장된 보기 탭 */
export const WO_VIEWS = [
  { key: 'all', label: '전체', test: () => true },
  { key: 'late', label: '지연', test: isLate, tone: 'danger' },
  { key: 'today', label: '오늘 시작', test: (w) => w.start === TODAY },
  { key: 'waiting', label: '대기', test: (w) => w.status === '대기' },
  { key: 'running', label: '진행 중', test: (w) => w.status === '진행' },
]

export const PAGE_SIZES = [20, 50]

/** 담당 반장별 아바타 색 */
export const LEAD_TONE = { 박서진: 'blue', 이정우: 'green', 최현우: 'orange', 김도윤: 'blue' }
