/** QC-01 불량 등록 (PC) — 작업지시를 고르면 품목·LOT·설비가 자동으로 채워지고, 원인(4M)과 조치까지 한 번에 */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import { Card, Dot, Meter } from '../components/panels'
import { Field, ReadOnly, Segmented, Select, TextInput, Textarea } from '../components/form'
import { Button, StatusBadge } from '../components/ui'
import { useMes } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { TODAY, lotOf } from '../data/workOrders'
import { ACTION_STATUSES, CAUSE_4M, DEFECT_TYPES } from '../data/mes'
import { formatNumber } from '../utils/format'
import { nowTime } from '../utils/clock'
import { levelOf } from '../config/access'
import './DefectForm.scss'

const empty = (woId) => ({ woId: woId ?? '', type: '', qty: '', cause4M: '', causeText: '', status: '미조치', action: '', time: nowTime() })

export default function DefectForm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { workOrders, defects, user, permissions, run } = useMes()
  const [form, setForm] = useState(() => empty(params.get('wo')))
  const [files, setFiles] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const canAct = levelOf(permissions, user.role, 'QC-01') === '처리'

  // 불량을 등록할 수 있는 작업지시: 진행·일시정지 + 최근 완료 건
  const candidates = workOrders.filter((w) => w.status === '진행' || w.status === '일시정지' || (w.status === '완료' && w.due >= '2026-10-15'))
  const wo = workOrders.find((w) => w.id === form.woId)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const qty = Number(form.qty)
  // 검증 규칙 — 제출을 한 번 누른 뒤부터 오류 표시 (submitted)
  const errors = {
    woId: !form.woId && '작업지시를 선택하세요',
    type: !form.type && '불량 유형을 선택하세요',
    qty: (!qty || qty < 1) ? '1 이상 입력하세요' : wo && qty > wo.done - wo.defects ? `양품 ${formatNumber(wo.done - wo.defects)} EA보다 많을 수 없어요` : null,
    cause4M: !form.cause4M && '원인 구분을 선택하세요',
  }
  const err = (k) => (submitted ? errors[k] || undefined : undefined)
  const valid = !Object.values(errors).some(Boolean)

  const woDefects = wo ? defects.filter((d) => d.woId === wo.id) : []
  const byType = DEFECT_TYPES.map((t) => ({ t, n: woDefects.filter((d) => d.type === t).reduce((a, d) => a + d.qty, 0) })).filter((x) => x.n)

  // again=true면 같은 작업지시로 계속 등록할 수 있게 폼만 비움
  const submit = (again) => {
    setSubmitted(true)
    if (!valid) return
    run('defect/add', {
      defect: {
        id: `D-${TODAY.slice(5).replace('-', '')}-P${defects.length + 1}`,
        at: `${TODAY} ${form.time}`,
        woId: wo.id, lot: lotOf(wo), itemCode: wo.itemCode, itemName: wo.itemName, line: wo.line, equip: wo.equip,
        type: form.type, qty, cause4M: form.cause4M, causeText: form.causeText, status: form.status, action: form.action,
        files: files.map((f) => f.name),
      },
    })
    toast(`${wo.id} 불량 ${qty} EA를 등록했어요`)
    if (again) {
      setForm(empty(wo.id))
      setFiles([])
      setSubmitted(false)
    } else navigate('/defects')
  }

  return (
    <AppLayout current="QC-01">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>불량 등록</h1>
            <p>검사에서 발견한 불량을 등록하면 작업지시·LOT·불량 분석에 바로 반영돼요</p>
          </div>
          {canAct && (
            <div className="page-top__right">
              <Button onClick={() => submit(true)}>저장 후 계속 등록</Button>
              <Button variant="primary" onClick={() => submit(false)}>등록</Button>
            </div>
          )}
        </header>

        <div className="form-page__cols">
          <form className="data-card form" onSubmit={(e) => { e.preventDefault(); submit(false) }} noValidate>
            <fieldset className="form__section">
              <legend className="form__legend"><strong>대상</strong><span>작업지시를 고르면 나머지는 자동으로 채워져요</span></legend>
              <div className="form__grid">
                <Field label="작업지시" required error={err('woId')} className="form__full">
                  {(p) => (
                    <Select
                      {...p}
                      placeholder="작업지시 선택"
                      value={form.woId}
                      onChange={(e) => set('woId', e.target.value)}
                      options={candidates.map((w) => ({ value: w.id, label: `${w.id} · ${w.itemName} · ${w.equip || '미배정'} (${w.status})` }))}
                    />
                  )}
                </Field>
                <Field label="품목">{() => <ReadOnly>{wo ? <>{wo.itemName} <span className="num muted">{wo.itemCode}</span></> : <span className="muted">—</span>}</ReadOnly>}</Field>
                <Field label="LOT">{() => <ReadOnly>{wo ? <Link to={`/lots/${lotOf(wo)}`} className="cell-link num">{lotOf(wo)}</Link> : <span className="muted">—</span>}</ReadOnly>}</Field>
                <Field label="라인 · 설비">{() => <ReadOnly>{wo ? <span className="num">{wo.line} · {wo.equip || '미배정'}</span> : <span className="muted">—</span>}</ReadOnly>}</Field>
                <Field label="발생 시각" required>
                  {(p) => <TextInput {...p} type="time" value={form.time} onChange={(e) => set('time', e.target.value)} suffix={TODAY.slice(5).replace('-', '.')} />}
                </Field>
              </div>
            </fieldset>

            <fieldset className="form__section">
              <legend className="form__legend"><strong>불량 내용</strong></legend>
              <div className="form__grid">
                <Field label="불량 유형" required error={err('type')} className="form__full">
                  {() => <Segmented label="불량 유형" options={DEFECT_TYPES} value={form.type} onChange={(v) => set('type', v)} />}
                </Field>
                <Field label="수량" required error={err('qty')} help={wo ? `양품 ${formatNumber(wo.done - wo.defects)} EA 중` : undefined}>
                  {(p) => <TextInput {...p} inputMode="numeric" placeholder="0" value={form.qty} onChange={(e) => set('qty', e.target.value.replace(/\D/g, ''))} suffix="EA" />}
                </Field>
                <Field label="원인 구분 (4M)" required error={err('cause4M')}>
                  {() => <Segmented label="원인 구분" options={CAUSE_4M} value={form.cause4M} onChange={(v) => set('cause4M', v)} />}
                </Field>
                <Field label="원인 상세" className="form__full">
                  {(p) => <Textarea {...p} rows={2} placeholder="예: 금형 마모로 홀 위치 편차 발생 (+0.3mm)" value={form.causeText} onChange={(e) => set('causeText', e.target.value)} />}
                </Field>
              </div>
            </fieldset>

            <fieldset className="form__section is-last">
              <legend className="form__legend"><strong>조치</strong><span>나중에 불량 분석 화면에서 바꿀 수 있어요</span></legend>
              <div className="form__grid">
                <Field label="조치 상태">
                  {() => <Segmented label="조치 상태" options={ACTION_STATUSES} value={form.status} onChange={(v) => set('status', v)} />}
                </Field>
                <Field label="사진 첨부" help="JPG·PNG, 최대 5장">
                  {(p) => (
                    <label className="upload">
                      <Icon name="upload" size={16} /> 사진 선택
                      <input {...p} type="file" accept="image/*" multiple onChange={(e) => setFiles([...files, ...e.target.files].slice(0, 5))} />
                    </label>
                  )}
                </Field>
                {files.length > 0 && (
                  <ul className="upload__list form__full">
                    {files.map((f, i) => (
                      <li key={i}>{f.name}<button type="button" aria-label={`${f.name} 삭제`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button></li>
                    ))}
                  </ul>
                )}
                <Field label="조치 내용" className="form__full">
                  {(p) => <Textarea {...p} rows={2} placeholder="예: 금형 교체 요청 · 설비팀" value={form.action} onChange={(e) => set('action', e.target.value)} />}
                </Field>
              </div>
            </fieldset>
          </form>

          <aside className="form-side">
            <Card title="이 작업지시의 불량">
              <div className="card__body">
                {wo ? (
                  <>
                    <p className="defect-side__wo"><Link to={`/work-orders/${wo.id}`} className="cell-link num">{wo.id}</Link> <StatusBadge status={wo.status} /></p>
                    <div className="defect-side__nums">
                      <div><span>생산</span><strong className="num">{formatNumber(wo.done)}</strong></div>
                      <div><span>불량</span><strong className="num is-danger">{formatNumber(wo.defects)}</strong></div>
                      <div><span>불량률</span><strong className="num">{wo.done ? ((wo.defects / wo.done) * 100).toFixed(1) : '0.0'}%</strong></div>
                    </div>
                    {byType.length ? (
                      <ul className="defect-side__types">
                        {byType.map(({ t, n }) => (
                          <li key={t}>
                            <span>{t}</span><span className="num">{n}</span>
                            <Meter value={(n / Math.max(...byType.map((x) => x.n))) * 100} tone="neutral" />
                          </li>
                        ))}
                      </ul>
                    ) : <p className="muted">등록된 불량 유형 기록이 없어요</p>}
                  </>
                ) : (
                  <p className="muted">작업지시를 선택하면 지금까지의 불량 현황이 보여요</p>
                )}
              </div>
            </Card>
            <Card title="등록 기준">
              <ul className="card__body defect-side__rules">
                <li><Dot tone="danger">미조치</Dot> 원인을 아직 모름 · 24시간 안에 조치 입력</li>
                <li><Dot tone="warning">조치중</Dot> 원인 확인, 개선 진행 중</li>
                <li><Dot tone="success">완료</Dot> 개선 완료 · 재발 확인</li>
              </ul>
            </Card>
          </aside>
        </div>
      </main>
    </AppLayout>
  )
}
