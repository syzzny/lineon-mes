/**
 * EQ-03 비가동 신고 / 사유 수정 팝업 — PC(라인 모니터링·설비 현황)와 태블릿(PR-03)에서 같이 사용
 * 신고하면: 설비 '비가동' + 진행 중 작업지시 '일시정지' + 비가동 이력 추가 + 반장 알림
 */
import { useState } from 'react'
import Icon from './Icon'
import { Button } from './ui'
import { Modal } from './feedback'
import { Field, Select, Textarea } from './form'
import { DOWNTIME_REASONS } from '../data/mes'
import { LEADS, TODAY } from '../data/workOrders'
import { useMes } from '../store/MesStore'
import { currentWoOf } from '../utils/mes'
import { useToast } from '../store/ToastContext'
import { nowMinutes } from '../utils/clock'
import './DowntimeModal.scss'

const pad = (n) => String(n).padStart(2, '0')
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

/**
 * @param equip    설비 ID
 * @param edit     수정할 비가동 기록 (없으면 새 신고)
 * @param variant  'pc' | 'tablet' (태블릿은 버튼이 큼)
 */
export default function DowntimeModal({ open, equip, edit, variant = 'pc', onClose, onDone }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? '비가동 사유 수정' : '비가동 신고'}
      icon="alert"
      tone="warning"
      size={variant === 'tablet' ? 'lg' : 'sm'}
    >
      {open && <Body equip={equip} edit={edit} variant={variant} onClose={onClose} onDone={onDone} />}
    </Modal>
  )
}

function Body({ equip, edit, variant, onClose, onDone }) {
  const { workOrders, equipById, run } = useMes()
  const toast = useToast()
  const eq = equipById(equip)
  const wo = currentWoOf(workOrders, equip)
  const [reason, setReason] = useState(edit?.reason ?? '')
  const [note, setNote] = useState(edit?.note ?? '')
  const [timeOpen, setTimeOpen] = useState(false)
  const nowMin = nowMinutes()
  const [start, setStart] = useState(hhmm(nowMin))
  // 시간 변경: 최근 1시간을 5분 단위로
  const times = Array.from({ length: 13 }, (_, i) => hhmm(Math.floor(nowMin / 5) * 5 - i * 5)).filter((t) => t >= '08:00')
  if (!times.includes(start)) times.unshift(start)

  const submit = () => {
    if (edit) {
      run('downtime/edit', { id: edit.id, changes: { reason, note } })
      toast(`${equip} 비가동 사유를 "${reason}"(으)로 수정했어요`)
    } else {
      run('downtime/report', { equip, reason, note, start: `${TODAY} ${start}` })
      toast(`${equip} 비가동을 신고했어요${wo?.status === '진행' ? ` · ${wo.id} 일시정지` : ''}`)
    }
    onDone?.()
    onClose()
  }

  return (
    <div className={`dt-modal is-${variant}`}>
      <p className="dt-modal__sub num">
        {equip} · {eq.name}{wo ? ` · ${wo.id} ${wo.status === '진행' ? '진행 중' : wo.status}` : ''}
      </p>

      <fieldset className="dt-modal__reasons">
        <legend>사유 <span className="field__req">*</span></legend>
        <div role="radiogroup" aria-label="비가동 사유">
          {DOWNTIME_REASONS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} className={reason === r ? 'is-on' : ''} onClick={() => setReason(r)}>
              {reason === r && <Icon name="check" size={18} />} {r}
            </button>
          ))}
        </div>
      </fieldset>

      {!edit && (
        <div className="dt-modal__time">
          <span>시작 시각</span>
          {timeOpen ? (
            <Select aria-label="시작 시각" options={times} value={start} onChange={(e) => setStart(e.target.value)} />
          ) : (
            <strong className="num">{start}</strong>
          )}
          {!timeOpen && <small>지금</small>}
          <Button onClick={() => setTimeOpen((o) => !o)}>{timeOpen ? '확인' : '시간 변경'}</Button>
        </div>
      )}

      <Field label="세부 내용" help={variant === 'tablet' ? undefined : '선택 입력'}>
        {(p) => <Textarea {...p} rows={variant === 'tablet' ? 2 : 3} placeholder="예: 주축에서 이상 소음이 나요" value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>

      {!edit && (
        <p className="dt-modal__info">
          <Icon name="help" size={16} />
          신고하면 {wo?.status === '진행' ? '작업이 일시정지되고 ' : ''}{LEADS[eq.line]} 반장에게 바로 알림이 가요
        </p>
      )}

      <div className="dt-modal__foot">
        <Button onClick={onClose}>취소</Button>
        <Button variant="primary" className="dt-modal__submit" disabled={!reason} onClick={submit}>
          {edit ? '사유 저장' : '비가동 신고'}
        </Button>
      </div>
    </div>
  )
}
