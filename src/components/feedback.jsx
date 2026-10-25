import { useEffect, useRef } from 'react'
import Icon from './Icon'
import { Button } from './ui'
import './feedback.scss'

/** Pagination — 앞뒤 1페이지 + 처음/끝, 나머지는 … */
export function Pagination({ page, pageCount, onChange }) {
  const pages = []
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }
  return (
    <nav className="pager" aria-label="페이지 이동">
      <button type="button" className="pager__btn" aria-label="이전 페이지" disabled={page === 1} onClick={() => onChange(page - 1)}>
        <Icon name="chevL" size={16} />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={'e' + i} className="pager__gap">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`pager__btn num ${p === page ? 'is-active' : ''}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className="pager__btn" aria-label="다음 페이지" disabled={page === pageCount} onClick={() => onChange(page + 1)}>
        <Icon name="chevR" size={16} />
      </button>
    </nav>
  )
}

/** BulkActionBar — 행을 선택하면 하단에 떠오르는 일괄 처리 바 */
export function BulkActionBar({ count, onAssign, onCancel, onClear }) {
  if (!count) return null
  return (
    <div className="bulk-bar" role="region" aria-label="선택 항목 일괄 처리">
      <span className="bulk-bar__count">
        <span className="num">{count}</span>개 선택됨
      </span>
      <span className="bulk-bar__sep" />
      <button type="button" onClick={onAssign}>
        <Icon name="userp" size={16} /> 작업자 배정
      </button>
      <button type="button" className="is-danger" onClick={onCancel}>
        <Icon name="ban" size={16} /> 일괄 취소
      </button>
      <span className="bulk-bar__sep" />
      <button type="button" aria-label="선택 해제" onClick={onClear}>
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}

/**
 * Modal — 네이티브 <dialog> 기반 공통 모달 (포커스 가두기, Esc 닫기)
 * @param size 'sm' | 'lg'
 */
export function Modal({ open, onClose, title, description, icon, tone, size = 'sm', footer, children, closeButton = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className={`modal modal--${size}`}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {open && (
        <>
          <div className="modal__head">
            {icon && (
              <span className={`modal__icon ${tone ? `is-${tone}` : ''}`}>
                <Icon name={icon} size={20} />
              </span>
            )}
            <div className="modal__titles">
              <h2 id="modal-title">{title}</h2>
              {description && <p>{description}</p>}
            </div>
            {closeButton && (
              <button type="button" className="modal__close" aria-label="닫기" onClick={onClose}>
                <Icon name="x" size={20} />
              </button>
            )}
          </div>
          <div className="modal__body">{children}</div>
          {footer && <div className="modal__foot">{footer}</div>}
        </>
      )}
    </dialog>
  )
}

/** ConfirmModal — Figma "CM-P03 확인·경고 모달" */
export function ConfirmModal({ open, title, children, confirmLabel, onConfirm, onClose, danger, confirmDisabled }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon="alert"
      tone={danger ? 'danger' : 'warning'}
      footer={
        <>
          <Button onClick={onClose}>닫기</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

/** Toast — 완료 피드백 (4초 후 사라짐) */
export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [message, onDone])
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div className="toast">
          <Icon name="check" size={18} strokeWidth={2.4} />
          {message}
        </div>
      )}
    </div>
  )
}
