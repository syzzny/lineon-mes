/**
 * SY-02 권한 관리 — 역할 × 메뉴 매트릭스
 * 처리(조회+등록·수정) / 조회 / 숨김. 저장하면 사이드바 메뉴와 화면 접근에 바로 반영돼요.
 * 바꾼 칸은 주황 테두리로 표시하고, 저장 전 변경 건수를 알려줍니다.
 */
import { useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import { Button } from '../components/ui'
import { ConfirmModal, Modal } from '../components/feedback'
import { useMes } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { PERMISSION_LEVELS, PERMISSION_ROWS, ROLES, SCOPES } from '../data/mes'
import { shortStamp } from '../utils/clock'
import { levelOf } from '../config/access'
import './Permissions.scss'

const LOCKED_ROLE = '시스템 관리자' // 관리자 권한은 잠가서 실수로 잠기지 않게
const LABEL = Object.fromEntries(PERMISSION_ROWS.flatMap((r) => [[r.key, r.label], ...(r.children ?? []).map((c) => [c.key, c.label])]))
LABEL.scope = '데이터 범위'

export default function Permissions() {
  const { permissions, users, permissionLog, user, run } = useMes()
  const toast = useToast()
  const canEdit = levelOf(permissions, user.role, 'SY-02') === '처리'
  const [draft, setDraft] = useState(permissions)
  const [openRows, setOpenRows] = useState(() => new Set(['planning']))
  const [modal, setModal] = useState(null) // 'log' | 'save'

  const changes = ROLES.flatMap((role) =>
    Object.keys(draft[role]).filter((k) => draft[role][k] !== permissions[role][k]).map((k) => ({ role, key: k, from: permissions[role][k], to: draft[role][k] })),
  )
  const changed = (role, key) => draft[role][key] !== permissions[role][key]
  const setCell = (role, key, v) => setDraft((d) => ({ ...d, [role]: { ...d[role], [key]: v } }))
  const setGroup = (role, row, v) => setDraft((d) => ({ ...d, [role]: { ...d[role], ...Object.fromEntries(row.children.map((c) => [c.key, v])) } }))
  const groupValue = (role, row) => {
    const vals = [...new Set(row.children.map((c) => draft[role][c.key]))]
    return vals.length === 1 ? vals[0] : '혼합'
  }
  const count = (role) => users.filter((u) => u.role === role).length

  const save = () => {
    run('permissions/save', { permissions: draft, log: changes.map((c) => `${c.role} · ${LABEL[c.key]} ${c.from} → ${c.to}`) })
    toast(`권한 변경 ${changes.length}건을 저장했어요 · 메뉴에 바로 반영돼요`)
    setModal(null)
  }

  /** 표 한 칸 — 그룹 행은 value·onChange로 하위 메뉴를 한 번에 바꿈 */
  const cell = (role, k, { value, onChange, options = PERMISSION_LEVELS } = {}) => (
    <PermCell
      key={role}
      label={`${role} ${LABEL[k] ?? ''}`}
      value={value ?? draft[role][k]}
      changed={Boolean(k) && changed(role, k)}
      locked={role === LOCKED_ROLE || !canEdit}
      lockIcon={role === LOCKED_ROLE}
      options={options}
      onChange={onChange ?? ((v) => setCell(role, k, v))}
    />
  )

  return (
    <AppLayout current="SY-02">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>권한 관리</h1>
            <p>역할별로 메뉴·화면 접근 권한과 볼 수 있는 데이터 범위를 설정합니다</p>
          </div>
          <div className="page-top__right">
            <Button variant="ghost" icon="history" onClick={() => setModal('log')}>변경 이력</Button>
            {canEdit && (
              <>
                <Button icon="undo" onClick={() => setDraft(permissions)} disabled={!changes.length}>되돌리기</Button>
                <Button variant="primary" onClick={() => setModal('save')} disabled={!changes.length}>{changes.length ? `변경 ${changes.length}건 저장` : '저장'}</Button>
              </>
            )}
          </div>
        </header>

        {changes.length > 0 && (
          <div className="perm-banner" role="status">
            <span className="dot dot--warning" /> 저장하지 않은 변경 {changes.length}건이 있어요. 주황색으로 표시된 칸을 확인하세요.
          </div>
        )}

        <section className="data-card perm" aria-label="역할별 권한">
          <div className="table-scroll">
            <table className="perm__table">
              <thead>
                <tr>
                  <th scope="col">메뉴 / 화면</th>
                  {ROLES.map((r) => (
                    <th key={r} scope="col">
                      <span className="perm__role">{r === LOCKED_ROLE && <Icon name="lock" size={14} />} {r}</span>
                      <small className="num">{count(r)}명</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_ROWS.map((row) => (
                  <PermRows key={row.key} row={row} open={openRows.has(row.key)} onToggle={() => setOpenRows((s) => { const n = new Set(s); if (n.has(row.key)) n.delete(row.key); else n.add(row.key); return n })}>
                    {(r, isGroup) => ROLES.map((role) => (isGroup ? cell(role, null, { value: groupValue(role, r), onChange: (v) => setGroup(role, r, v) }) : cell(role, r.key)))}
                  </PermRows>
                ))}
                <tr className="perm__scope">
                  <th scope="row"><strong>데이터 범위</strong><small>볼 수 있는 데이터 제한</small></th>
                  {ROLES.map((role) => cell(role, 'scope', { options: SCOPES }))}
                </tr>
              </tbody>
            </table>
          </div>
          <footer className="perm__legend">
            <span><b className="perm-pill is-처리">처리</b> 조회 + 등록·수정·삭제</span>
            <span><b className="perm-pill is-조회">조회</b> 보기만 가능 (버튼 비활성)</span>
            <span><b className="perm-pill is-숨김">숨김</b> 메뉴에서 보이지 않음</span>
          </footer>
        </section>

        <ConfirmModal open={modal === 'save'} title={`권한 변경 ${changes.length}건을 저장할까요?`} confirmLabel="저장" onConfirm={save} onClose={() => setModal(null)}>
          <ul>
            {changes.map((c) => <li key={c.role + c.key}>{c.role} · {LABEL[c.key]} <b>{c.from} → {c.to}</b></li>)}
          </ul>
          <p>저장하면 해당 역할 사용자의 메뉴가 바로 바뀌어요.</p>
        </ConfirmModal>
        <Modal open={modal === 'log'} onClose={() => setModal(null)} title="권한 변경 이력" closeButton>
          <ol className="perm-log">
            {permissionLog.map((l, i) => (
              <li key={i}><span className="num">{shortStamp(l.at)}</span> <strong>{l.by}</strong> <span>{l.note}</span></li>
            ))}
          </ol>
        </Modal>
      </main>
    </AppLayout>
  )
}

function PermCell({ label, value, changed, locked, lockIcon, options, onChange }) {
  return (
    <td className={`perm__cell ${changed ? 'is-changed' : ''}`}>
      <label className={`perm-pill is-${value} ${locked ? 'is-locked' : ''}`}>
        <span className="sr-only">{label}</span>
        <select value={value} disabled={locked} onChange={(e) => onChange(e.target.value)}>
          {value === '혼합' && <option value="혼합" disabled>혼합</option>}
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <Icon name={lockIcon ? 'lock' : 'chev'} size={13} />
      </label>
    </td>
  )
}

function PermRows({ row, open, onToggle, children }) {
  if (!row.children) {
    return (
      <tr>
        <th scope="row"><strong>{row.label}</strong></th>
        {children(row, false)}
      </tr>
    )
  }
  return (
    <>
      <tr className="perm__group">
        <th scope="row">
          <button type="button" aria-expanded={open} onClick={onToggle}>
            <Icon name={open ? 'chev' : 'chevR'} size={14} /> <strong>{row.label}</strong>
          </button>
        </th>
        {children(row, true)}
      </tr>
      {open && row.children.map((c) => (
        <tr key={c.key} className="perm__child">
          <th scope="row">{c.label}</th>
          {children(c, false)}
        </tr>
      ))}
    </>
  )
}
