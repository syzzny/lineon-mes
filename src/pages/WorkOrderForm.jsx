/**
 * PP-05 작업지시 등록 / 수정
 * - /work-orders/new        → 신규 발행
 * - /work-orders/:id/edit   → 수정 (진행 중이면 지시수량·납기만 수정 가능)
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import ItemSearchModal from '../components/ItemSearchModal'
import DatePicker from '../components/DatePicker'
import { Field, ReadOnly, Segmented, Select, TextInput, Textarea } from '../components/form'
import { Avatar, Button } from '../components/ui'
import { Modal } from '../components/feedback'
import { useMes, useWorkOrders } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { EQUIP_LOAD, EQUIPMENT, LEADS, LINES, PLANS, PRIORITIES, TODAY } from '../data/workOrders'
import { EDITABLE_WHEN_RUNNING, LEAD_TONE, isRunning } from '../constants/workOrder'
import validateWorkOrder from '../utils/validateWorkOrder'
import { formatNumber, formatShortDate } from '../utils/format'
import ComingSoon from './ComingSoon'
import './WorkOrderForm.scss'

const DRAFT_KEY = 'lineon:draft:work-order'

const EMPTY = {
  itemCode: '', qty: '', due: '', plan: PLANS[0], priority: '보통',
  line: '', equip: '', start: TODAY, startTime: '08:00', memo: '',
}

const TIMES = ['06:00', '08:00', '10:00', '13:00', '15:00', '20:00']

const FIELD_LABEL = { itemCode: '품목', qty: '지시수량', due: '납기일', line: '라인', equip: '설비', start: '작업 시작', startTime: '시작 시각', priority: '우선순위', plan: '생산계획', memo: '비고' }

const toForm = (wo) => ({
  itemCode: wo.itemCode, qty: String(wo.qty), due: wo.due, plan: wo.plan, priority: wo.priority,
  line: wo.line, equip: wo.equip, start: wo.start, startTime: wo.startTime, memo: wo.memo,
})

const readDraft = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) } catch { return null }
}
const writeDraft = (form) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)) } catch { /* 무시 */ }
}
const clearDraft = () => {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* 무시 */ }
}

export default function WorkOrderForm() {
  const { id } = useParams()
  const { getById } = useWorkOrders()
  const original = id ? getById(id) : null
  if (id && !original) return <ComingSoon />
  // key로 대상이 바뀌면 폼 상태를 새로 시작
  return <FormScreen key={id ?? 'new'} original={original} />
}

function FormScreen({ original }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { create, update, nextId } = useWorkOrders()
  const { items, equipById } = useMes()
  const isEdit = Boolean(original)
  const locked = isEdit && isRunning(original) // 진행 중이면 일부만 수정 가능
  const canEditField = (f) => !locked || EDITABLE_WHEN_RUNNING.includes(f)

  // 생산계획(PP-01)·작업 배정(PP-06)에서 넘어오면 주소의 값으로 미리 채움
  const [params] = useSearchParams()
  const [initial] = useState(() => {
    if (original) return toForm(original)
    const prefill = Object.fromEntries(['itemCode', 'qty', 'due', 'line', 'equip', 'start', 'plan'].filter((k) => params.get(k)).map((k) => [k, params.get(k)]))
    return { ...EMPTY, ...prefill }
  })
  const planRef = params.get('planRef')
  const [form, setForm] = useState(initial)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [itemModal, setItemModal] = useState(false)
  const savingRef = useRef(false) // 저장 직후 이동은 이탈 경고 없이
  const [draft, setDraft] = useState(() => (isEdit || params.size ? null : readDraft()))

  const item = items.find((i) => i.code === form.itemCode)
  const errors = validateWorkOrder(form, original)
  const showError = (f) => (touched[f] || submitted ? errors[f] : undefined)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const valid = Object.keys(errors).length === 0

  const set = (field, value) => {
    setForm((f) => {
      const next = { ...f, [field]: value }
      // 라인을 바꾸면 설비를 다시 고르게
      if (field === 'line' && f.line !== value) next.equip = ''
      return next
    })
    setTouched((t) => ({ ...t, [field]: true }))
  }

  const pickItem = (it) => {
    // 라인이 비어 있으면 품목의 기본 라인으로 채움
    setForm((f) => ({ ...f, itemCode: it.code, line: f.line || it.line }))
    setTouched((t) => ({ ...t, itemCode: true }))
    setItemModal(false)
  }

  // ---------- 미저장 이탈 경고 ----------
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !savingRef.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // ---------- 저장 ----------
  const submit = () => {
    setSubmitted(true)
    if (!valid) {
      document.querySelector('.field.has-error input, .field.has-error select')?.focus()
      return
    }
    savingRef.current = true
    const qty = Number(String(form.qty).replaceAll(',', ''))
    if (isEdit) {
      const changes = { ...form, qty, route: item.route, itemName: item.name, lead: LEADS[form.line] }
      const summary = Object.keys(FIELD_LABEL)
        .filter((k) => String(initial[k]) !== String(form[k]))
        .map((k) => `${FIELD_LABEL[k]} ${k === 'qty' ? `${formatNumber(Number(initial.qty))} → ${formatNumber(qty)}` : k === 'due' ? `${formatShortDate(initial.due)} → ${formatShortDate(form.due)}` : '변경'}`)
        .join(', ')
      update(original.id, changes, summary || '변경 없음')
      toast(`${original.id} 작업지시를 수정했어요`)
      navigate(`/work-orders/${original.id}`, { replace: true })
    } else {
      const newId = nextId()
      create({
        id: newId, status: '대기', ...form, qty, done: 0, defects: 0, assigned: Boolean(form.equip), planRef,
        itemName: item.name, route: item.route, lead: LEADS[form.line],
      })
      clearDraft()
      toast(`${newId} 작업지시를 발행했어요`)
      navigate(`/work-orders/${newId}`, { replace: true })
    }
  }

  const saveDraft = () => {
    writeDraft(form)
    toast('임시저장했어요. 다음에 등록 화면을 열면 이어서 작성할 수 있어요')
  }

  // ---------- 발행 전 확인 ----------
  const checks = [
    ['품목', 'itemCode'],
    ['지시수량', 'qty'],
    ['납기일', 'due'],
    ['라인 · 설비', 'equip'],
    ['작업 시작 예정', 'start'],
  ].map(([label, f]) => ({ label, ok: !errors[f] && !(f === 'equip' && errors.line), error: (f === 'equip' ? errors.line || errors.equip : errors[f]) }))
  const okCount = checks.filter((c) => c.ok).length

  const load = form.equip ? EQUIP_LOAD[form.equip] ?? 0 : null
  const lineEquip = form.line ? EQUIPMENT[form.line] : []
  // 비가동·점검 설비는 고를 수 없고, 나머지 중 부하가 가장 낮은 설비를 추천
  const usable = (e) => !['비가동', '점검'].includes(equipById(e)?.status)
  const usableEquip = lineEquip.filter(usable)
  const recommend = usableEquip.length ? usableEquip.reduce((a, b) => ((EQUIP_LOAD[a] ?? 0) <= (EQUIP_LOAD[b] ?? 0) ? a : b)) : null

  const title = isEdit ? '작업지시 수정' : '작업지시 등록'
  const backTo = isEdit ? `/work-orders/${original.id}` : '/work-orders'

  return (
    <AppLayout current="PP-03" crumbs={isEdit ? [{ label: original.id, path: backTo }, { label: '수정' }] : [{ label: '새 작업지시' }]}>
      <main className="page form-page">
        <Link to={backTo} className="back"><Icon name="chevL" size={16} /> {isEdit ? '작업지시 상세' : '작업지시 목록'}</Link>

        <header className="form-page__head">
          <div>
            <h1>{title} {isEdit && <span className="num">{original.id}</span>}</h1>
            <p><span className="field__req">*</span> 표시는 필수 항목입니다</p>
          </div>
          <div className="form-page__actions">
            <Button variant="ghost" onClick={() => navigate(backTo)}>취소</Button>
            {!isEdit && <Button onClick={saveDraft} disabled={!dirty}>임시저장</Button>}
            <Button variant="primary" onClick={submit}>{isEdit ? '저장' : '발행'}</Button>
          </div>
        </header>

        {locked && (
          <div className="notice">
            <Icon name="alert" size={16} />
            진행 중인 작업지시는 지시수량과 납기만 수정할 수 있어요. 다른 항목은 조기 종료 후 새로 발행하세요.
          </div>
        )}
        {draft && (
          <div className="notice notice--info">
            <Icon name="clip" size={16} />
            <span>임시저장한 작성 내용이 있어요.</span>
            <button type="button" onClick={() => { setForm({ ...EMPTY, ...draft }); setDraft(null) }}>불러오기</button>
            <button type="button" onClick={() => { clearDraft(); setDraft(null) }}>삭제</button>
          </div>
        )}

        <div className="form-page__cols">
          <form className="data-card form" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
            <Section title="품목" desc="검색해서 선택하면 공정이 자동으로 입력됩니다">
              <Field label="품목" required error={showError('itemCode')}>
                {(p) => (
                  <div className="form__inline">
                    <TextInput {...p} readOnly value={item ? `${item.code}  ${item.name}` : ''} placeholder="품목 검색으로 선택하세요" onClick={() => canEditField('itemCode') && setItemModal(true)} disabled={!canEditField('itemCode')} />
                    <Button icon="search" onClick={() => setItemModal(true)} disabled={!canEditField('itemCode')}>품목 검색</Button>
                  </div>
                )}
              </Field>
              <Field label="공정" help="품목의 표준 공정 (기준정보에서 관리)">
                {() => (
                  <ReadOnly>
                    {item ? item.route.map((r, i) => (
                      <span key={r} className="route__step">{i > 0 && <Icon name="chevR" size={12} />}<span>{r}</span></span>
                    )) : <span className="muted">품목을 선택하면 표시돼요</span>}
                  </ReadOnly>
                )}
              </Field>
            </Section>

            <Section title="생산 정보" desc="수량과 납기를 입력하세요">
              <Field label="지시수량" required error={showError('qty')}>
                {(p) => <TextInput {...p} inputMode="numeric" suffix="EA" value={form.qty} placeholder="예: 2,000" onChange={(e) => set('qty', e.target.value.replace(/[^\d,]/g, ''))} onBlur={() => setTouched((t) => ({ ...t, qty: true }))} disabled={!canEditField('qty')} />}
              </Field>
              <Field label="납기일" required error={showError('due')}>
                {(p) => <DatePicker {...p} today={TODAY} min={form.start || TODAY} value={form.due} onChange={(v) => set('due', v)} placeholder="납기일 선택" disabled={!canEditField('due')} />}
              </Field>
              <Field label="생산계획">
                {(p) => <Select {...p} options={PLANS} value={form.plan} onChange={(e) => set('plan', e.target.value)} disabled={!canEditField('plan')} />}
              </Field>
              <Field label="우선순위" required>
                {() => <Segmented label="우선순위" options={PRIORITIES} value={form.priority} onChange={(v) => set('priority', v)} disabled={!canEditField('priority')} />}
              </Field>
            </Section>

            <Section title="라인 · 설비" desc="라인을 고르면 담당 반장이 자동 지정됩니다">
              <Field label="라인" required error={showError('line')}>
                {(p) => <Select {...p} options={LINES.map((l) => ({ value: l, label: `${l} 라인` }))} placeholder="라인 선택" value={form.line} onChange={(e) => set('line', e.target.value)} disabled={!canEditField('line')} />}
              </Field>
              <Field label="설비" required error={showError('equip')} help={!form.line ? '라인을 먼저 선택하세요' : undefined}>
                {(p) => (
                  <Select
                    {...p}
                    options={lineEquip.map((e) => ({ value: e, label: usable(e) ? `${e} · 부하 ${EQUIP_LOAD[e] ?? 0}%${e === recommend ? ' · 추천' : ''}` : `${e} · ${equipById(e)?.status} (선택 불가)`, disabled: !usable(e) && e !== initial.equip }))}
                    placeholder="설비 선택"
                    value={form.equip}
                    onChange={(e) => set('equip', e.target.value)}
                    disabled={!form.line || !canEditField('equip')}
                  />
                )}
              </Field>
              <Field label="담당 반장">
                {() => (
                  <ReadOnly>
                    {form.line ? <><Avatar name={LEADS[form.line]} tone={LEAD_TONE[LEADS[form.line]]} /> <strong>{LEADS[form.line]}</strong> <span className="muted">· 라인 반장 자동 지정</span></> : <span className="muted">라인을 선택하면 지정돼요</span>}
                  </ReadOnly>
                )}
              </Field>
              <Field label="작업 시작 예정" required error={showError('start')}>
                {(p) => (
                  <div className="form__inline">
                    <DatePicker {...p} today={TODAY} min={isEdit ? undefined : TODAY} value={form.start} onChange={(v) => set('start', v)} placeholder="시작일 선택" disabled={!canEditField('start')} />
                    <Select aria-label="시작 시각" className="form__time" options={TIMES} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} disabled={!canEditField('startTime')} />
                  </div>
                )}
              </Field>
            </Section>

            <Section title="비고" desc="선택 입력 · 최대 200자" last>
              <Field label="메모" error={showError('memo')} help={`${form.memo.length} / 200`} className="form__full">
                {(p) => <Textarea {...p} value={form.memo} placeholder="작업 시 참고할 내용을 입력하세요" onChange={(e) => set('memo', e.target.value)} disabled={!canEditField('memo')} />}
              </Field>
            </Section>
          </form>

          <aside className="form-side">
            <section className="data-card checklist" aria-label="발행 전 확인">
              <header>
                <h2>{isEdit ? '저장 전 확인' : '발행 전 확인'}</h2>
                <span className="num">{okCount} / {checks.length}</span>
              </header>
              <div className="checklist__bar"><span style={{ width: `${(okCount / checks.length) * 100}%` }} /></div>
              <ul>
                {checks.map((c) => (
                  <li key={c.label} className={c.ok ? 'is-ok' : submitted || Object.keys(touched).length ? 'is-todo' : ''}>
                    <span className="checklist__mark"><Icon name={c.ok ? 'check' : 'x'} size={12} strokeWidth={3} /></span>
                    <span>{c.label}</span>
                    {!c.ok && <small>{c.error}</small>}
                  </li>
                ))}
              </ul>
            </section>

            {load != null && (
              <section className="data-card load" aria-label="설비 부하">
                <h2><Icon name="wrench" size={16} /> {form.equip} 같은 기간 부하</h2>
                <p className={`load__value num ${load > 80 ? 'is-high' : ''}`}>{load}%</p>
                <div className="load__bar"><span className={load > 80 ? 'is-high' : ''} style={{ width: `${load}%` }} /></div>
                {load > 80 ? (
                  <div className="load__warn">
                    <Icon name="alert" size={16} />
                    <span>
                      이 작업을 추가하면 납기 내 처리가 어려울 수 있어요.
                      {recommend && recommend !== form.equip && (
                        <> 여유가 많은 <button type="button" onClick={() => set('equip', recommend)}>{recommend}</button>를 추천해요.</>
                      )}
                    </span>
                  </div>
                ) : (
                  <p className="muted">여유 있음 · 납기 내 처리 가능</p>
                )}
              </section>
            )}
          </aside>
        </div>

        <ItemSearchModal open={itemModal} initialCode={form.itemCode} onSelect={pickItem} onClose={() => setItemModal(false)} />

        <Modal
          open={blocker.state === 'blocked'}
          onClose={() => blocker.reset?.()}
          title="저장하지 않은 내용이 있어요"
          icon="alert"
          tone="warning"
          footer={
            <>
              <Button variant="ghost" onClick={() => blocker.proceed?.()}>저장 안 하고 나가기</Button>
              {!isEdit && <Button onClick={() => { writeDraft(form); blocker.proceed?.() }}>임시저장 후 나가기</Button>}
              <Button variant="primary" onClick={() => blocker.reset?.()}>계속 작성</Button>
            </>
          }
        >
          <p>{isEdit ? '지금 나가면 수정한 내용이 사라져요.' : '지금 나가면 입력한 내용이 사라져요. 임시저장하면 다음에 이어서 작성할 수 있어요.'}</p>
        </Modal>
      </main>
    </AppLayout>
  )
}

function Section({ title, desc, last, children }) {
  return (
    <fieldset className={`form__section ${last ? 'is-last' : ''}`}>
      <legend className="form__legend">
        <strong>{title}</strong> <span>{desc}</span>
      </legend>
      <div className="form__grid">{children}</div>
    </fieldset>
  )
}
