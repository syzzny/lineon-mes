import { TODAY } from '../data/workOrders'
import { formatNumber, formatShortDate } from './format'

/**
 * 작업지시 폼 검증 — 저장 시점이 아니라 입력 직후에 보여줄 오류 메시지를 만듦
 * @param form     폼 값
 * @param original 수정 모드일 때 원래 작업지시 (없으면 신규)
 * @returns { [field]: '오류 메시지' }
 */
export default function validateWorkOrder(form, original) {
  const e = {}
  const qty = Number(String(form.qty).replaceAll(',', ''))

  if (!form.itemCode) e.itemCode = '품목을 선택하세요'

  if (form.qty === '' || form.qty == null) e.qty = '지시수량을 입력하세요'
  else if (!Number.isInteger(qty) || qty <= 0) e.qty = '1 이상의 정수로 입력하세요'
  else if (qty > 100000) e.qty = '한 번에 100,000 EA까지 발행할 수 있어요'
  else if (original && qty < original.done) e.qty = `이미 생산한 수량(${formatNumber(original.done)} EA)보다 적게 줄일 수 없어요`

  if (!form.line) e.line = '라인을 선택하세요'
  if (!form.equip) e.equip = '설비를 선택하세요'

  if (!form.start) e.start = '작업 시작 예정일을 입력하세요'
  else if (!original && form.start < TODAY) e.start = '오늘 이전 날짜로 시작할 수 없어요'

  if (!form.due) e.due = '납기일을 입력하세요'
  else if (form.start && form.due < form.start) e.due = `납기일이 작업 시작 예정일(${formatShortDate(form.start).split(" ")[0]})보다 빨라요`

  if (form.memo && form.memo.length > 200) e.memo = '200자 이내로 입력하세요'

  return e
}
