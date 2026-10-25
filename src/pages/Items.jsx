/** MD-01 품목 관리 — 품목군 트리 + 목록 + 상세 편집. 저장하면 작업지시 등록의 품목 검색에 바로 반영 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import { EmptyState } from '../components/panels'
import { Button, IconButton, StatusBadge } from '../components/ui'
import { Field, Segmented, Select, TextInput } from '../components/form'
import { useMes } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { LINES } from '../data/workOrders'
import { levelOf } from '../config/access'
import './Items.scss'

const PROCESSES = ['프레스', 'CNC 가공', '용접', '조립', '표면처리', '검사·포장']
const NEW = { code: '', name: '', group: '', line: '', route: [], cycle: '', unit: 'EA', active: true }
const toMMSS = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function Items() {
  const [params, setParams] = useSearchParams()
  const { items, workOrders, user, permissions } = useMes()
  const canEdit = levelOf(permissions, user.role, 'MD-01') === '처리'
  const groups = [...new Set(items.map((i) => i.group))]
  const selCode = params.get('code')
  const selItem = items.find((i) => i.code === selCode)
  const [group, setGroup] = useState(selItem?.group ?? '')
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(true)
  const creating = params.get('new') === '1'

  const query = q.trim().toLowerCase()
  const list = items.filter((i) => (!group || i.group === group) && (showInactive || i.active !== false) && (!query || i.name.toLowerCase().includes(query) || i.code.toLowerCase().includes(query)))
  const select = (code) => setParams(code ? { code } : {})

  return (
    <AppLayout current="MD-01">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>품목 관리</h1>
            <p>품목별 표준 공정과 사이클 타임 · 작업지시 등록과 납기 위험 계산에 사용돼요</p>
          </div>
          {canEdit && <div className="page-top__right"><Button variant="primary" icon="plus" onClick={() => setParams({ new: '1' })}>품목 추가</Button></div>}
        </header>

        <div className="items">
          <aside className="card items__tree" aria-label="품목군">
            <p className="items__tree-title">품목군</p>
            <ul role="tree">
              <li role="treeitem" aria-selected={!group}>
                <button type="button" className={!group ? 'is-on' : ''} onClick={() => setGroup('')}>전체 <span className="num">{items.length}</span></button>
              </li>
              {groups.map((g) => (
                <li key={g} role="treeitem" aria-selected={group === g}>
                  <button type="button" className={group === g ? 'is-on' : ''} onClick={() => setGroup(g)}>
                    <Icon name="db" size={15} /> {g} <span className="num">{items.filter((i) => i.group === g).length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="data-card items__list" aria-label="품목 목록">
            <div className="filter-bar">
              <label className="list-search">
                <Icon name="search" size={15} />
                <input type="search" placeholder="품목명 또는 코드" aria-label="품목 검색" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <div className="filter-bar__spacer" />
              <label className="items__toggle">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> 사용 중지 품목 표시
              </label>
            </div>
            <div className="table-scroll">
              <table className="simple-table">
                <thead><tr><th>품목코드</th><th>품목명</th><th>라인</th><th>표준 공정</th><th className="r">사이클</th><th>사용</th></tr></thead>
                <tbody>
                  {list.map((i) => (
                    <tr key={i.code} className={`is-clickable ${selCode === i.code ? 'is-on' : ''} ${i.active === false ? 'is-inactive' : ''}`} onClick={() => select(i.code)}>
                      <td><button type="button" className="cell-link num" onClick={() => select(i.code)}>{i.code}</button></td>
                      <td>{i.name}</td>
                      <td>{i.line}</td>
                      <td className="items__route">{i.route.join(' → ')}</td>
                      <td className="r num">{toMMSS(i.cycle)}</td>
                      <td><StatusBadge status={i.active === false ? '사용 중지' : '사용'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {list.length === 0 && <EmptyState title="품목이 없어요" />}
            </div>
          </section>

          <aside className="card items__detail" aria-label="품목 상세">
            {creating || selItem ? (
              <ItemEditor
                key={creating ? 'new' : selItem.code}
                item={creating ? { ...NEW, group: group || '' } : selItem}
                isNew={creating}
                groups={groups}
                usedBy={selItem ? workOrders.filter((w) => w.itemCode === selItem.code && w.status !== '완료' && w.status !== '취소').length : 0}
                canEdit={canEdit}
                onDone={(code) => select(code)}
              />
            ) : (
              <EmptyState icon="db" title="품목을 고르세요">목록에서 품목을 누르면 표준 공정과 사이클 타임을 볼 수 있어요</EmptyState>
            )}
          </aside>
        </div>
      </main>
    </AppLayout>
  )
}

/** 오른쪽 편집 패널 — 새 품목이면 코드 입력·중복 확인, 기존 품목이면 바뀐 게 있을 때만 저장 가능 */
function ItemEditor({ item, isNew, groups, usedBy, canEdit, onDone }) {
  const { items, run } = useMes()
  const toast = useToast()
  const [f, setF] = useState({ ...item, cycle: String(item.cycle) })
  const [submitted, setSubmitted] = useState(false)
  const [addStep, setAddStep] = useState('')
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const dirty = JSON.stringify({ ...f, cycle: Number(f.cycle) }) !== JSON.stringify({ ...item, cycle: Number(item.cycle) })

  // 품목코드 형식: 영문 2자-숫자 4자 (예: BR-2206)
  const errors = {
    code: isNew && (!/^[A-Z]{2}-\d{4}$/.test(f.code) ? '형식: 영문 2자-숫자 4자 (예: BR-2206)' : items.some((i) => i.code === f.code) ? '이미 있는 품목코드예요' : null),
    name: !f.name.trim() && '품목명을 입력하세요',
    group: !f.group.trim() && '품목군을 입력하세요',
    line: !f.line && '라인을 선택하세요',
    route: !f.route.length && '공정을 1개 이상 추가하세요',
    cycle: !(Number(f.cycle) > 0) && '1초 이상 입력하세요',
  }
  const err = (k) => (submitted && errors[k]) || undefined
  const valid = !Object.values(errors).some(Boolean)

  const save = () => {
    setSubmitted(true)
    if (!valid) return
    run('items/save', { item: { ...f, cycle: Number(f.cycle), name: f.name.trim(), group: f.group.trim() } })
    toast(isNew ? `${f.code} 품목을 추가했어요` : `${f.code} 품목을 저장했어요`)
    onDone(f.code)
  }

  const ro = !canEdit
  return (
    <div className="item-editor">
      <header>
        <div>
          <p className="num muted">{isNew ? '새 품목' : item.code}</p>
          <h2>{isNew ? '품목 추가' : item.name}</h2>
        </div>
        {!isNew && <StatusBadge status={f.active === false ? '사용 중지' : '사용'} />}
      </header>
      {!isNew && usedBy > 0 && (
        <p className="item-editor__note"><Icon name="alert" size={14} /> 진행 중인 작업지시 {usedBy}건이 이 품목을 써요. 공정을 바꾸면 새로 발행하는 작업지시부터 적용돼요.</p>
      )}
      <div className="item-editor__fields">
        {isNew && (
          <Field label="품목코드" required error={err('code')}>
            {(p) => <TextInput {...p} placeholder="BR-2206" value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />}
          </Field>
        )}
        <Field label="품목명" required error={err('name')}>
          {(p) => <TextInput {...p} value={f.name} onChange={(e) => set('name', e.target.value)} disabled={ro} />}
        </Field>
        <Field label="품목군" required error={err('group')} help="기존 품목군을 고르거나 새로 입력">
          {(p) => (
            <>
              <TextInput {...p} list="item-groups" value={f.group} onChange={(e) => set('group', e.target.value)} disabled={ro} />
              <datalist id="item-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="기본 라인" required error={err('line')}>
          {(p) => <Select {...p} placeholder="라인 선택" options={LINES} value={f.line} onChange={(e) => set('line', e.target.value)} disabled={ro} />}
        </Field>
        <Field label="표준 공정" required error={err('route')} help="작업 순서대로 추가하세요">
          {() => (
            <div className="route-edit">
              <ol>
                {f.route.map((r, i) => (
                  <li key={r + i}>
                    <span className="num">{i + 1}</span> {r}
                    {!ro && <IconButton icon="x" label={`${r} 빼기`} onClick={() => set('route', f.route.filter((_, j) => j !== i))} />}
                  </li>
                ))}
              </ol>
              {!ro && (
                <div className="route-edit__add">
                  <Select aria-label="추가할 공정" placeholder="공정 선택" options={PROCESSES.filter((p) => !f.route.includes(p))} value={addStep} onChange={(e) => setAddStep(e.target.value)} />
                  <Button icon="plus" disabled={!addStep} onClick={() => { set('route', [...f.route, addStep]); setAddStep('') }}>추가</Button>
                </div>
              )}
            </div>
          )}
        </Field>
        <Field label="사이클 타임" required error={err('cycle')} help={Number(f.cycle) > 0 ? `개당 ${toMMSS(Number(f.cycle))} · 시간당 약 ${Math.floor(3600 / Number(f.cycle))}개` : '개당 걸리는 시간(초)'}>
          {(p) => <TextInput {...p} inputMode="numeric" value={f.cycle} onChange={(e) => set('cycle', e.target.value.replace(/\D/g, ''))} suffix="초" disabled={ro} />}
        </Field>
        <Field label="사용 여부" help={f.active === false ? '사용 중지하면 작업지시 등록에서 고를 수 없어요' : undefined}>
          {() => <Segmented label="사용 여부" options={['사용', '사용 중지']} value={f.active === false ? '사용 중지' : '사용'} onChange={(v) => set('active', v === '사용')} disabled={ro} />}
        </Field>
      </div>
      {canEdit && (
        <footer className="item-editor__foot">
          <Button onClick={() => onDone(isNew ? null : item.code)} disabled={!isNew && !dirty}>{isNew ? '취소' : '되돌리기'}</Button>
          <Button variant="primary" onClick={save} disabled={!isNew && !dirty}>{isNew ? '추가' : '저장'}</Button>
        </footer>
      )}
    </div>
  )
}
