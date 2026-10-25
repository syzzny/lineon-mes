/** 상태 → 색 이름 (badge·dot·tag 공통). 색만으로 구분하지 않도록 항상 글자와 함께 씁니다. */
import { PLANNED_REASON } from '../data/mes'

export const EQUIP_TONE = { 가동: 'success', 비가동: 'danger', 대기: 'neutral', 점검: 'brand' }

export const REASON_TONE = {
  '설비 고장': 'danger', '공구 파손': 'danger', '품질 이상': 'danger',
  '자재 대기': 'warning', '셋업·품목 전환': 'neutral', [PLANNED_REASON]: 'brand', 기타: 'neutral',
}

export const PRIORITY_TONE = { 긴급: 'danger', 높음: 'warning', 보통: 'neutral' }
