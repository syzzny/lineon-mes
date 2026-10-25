/** SY-01 사용자 관리 — 역할·담당 라인 지정, 계정 사용 중지 */
import { useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import FilterChip from '../components/FilterChip'
import DataTable from '../components/DataTable/DataTable'
import { FilterBar, ListFooter, SearchInput } from '../components/list/ListParts'
import { Avatar, Button, StatusBadge } from '../components/ui'
import { Modal } from '../components/feedback'
import { Field, Segmented, Select, TextInput } from '../components/form'
import useListQuery from '../hooks/useListQuery'
import { useMes } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { LINES } from '../data/workOrders'
import { ROLES } from '../data/mes'
import { shortStamp } from '../utils/clock'
import { levelOf } from '../config/access'

const STATES = ['사용', '사용 중지']
const FILTERS = {
  role: { match: (u, v) => v.includes(u.role) },
  line: { match: (u, v) => v.includes(u.line) },
  state: { match: (u, v) => v.includes(u.active ? '사용' : '사용 중지') },
}
const SORTERS = { name: (a, b) => a.name.localeCompare(b.name, 'ko'), lastLogin: (a, b) => (a.lastLogin ?? '').localeCompare(b.lastLogin ?? '') }

export default function Users() {
  const { users, user: me, permissions, run } = useMes()
  const toast = useToast()
  const canEdit = levelOf(permissions, me.role, 'SY-01') === '처리'
  const [edit, setEdit] = useState(null)

  const q = useListQuery(users, { filters: FILTERS, sorters: SORTERS, search: (u) => [u.name, u.email, u.role], pageSize: 20, persistKey: 'lineon:list:users' })

  const columns = useMemo(
    () => [
      { key: 'name', header: '이름', sortable: true, render: (u) => <span className="cell-person"><Avatar name={u.name} tone={u.active ? 'blue' : 'gray'} />{u.name}{u.id === me.id && <small className="muted"> (나)</small>}</span> },
      { key: 'role', header: '역할', render: (u) => u.role },
      { key: 'line', header: '담당 라인', render: (u) => u.line },
      { key: 'email', header: '이메일', render: (u) => <span className="num muted">{u.email || '태블릿 전용 계정'}</span> },
      { key: 'lastLogin', header: '최근 접속', sortable: true, render: (u) => <span className="num">{shortStamp(u.lastLogin)}</span> },
      { key: 'state', header: '상태', render: (u) => <StatusBadge status={u.active ? '사용' : '사용 중지'} /> },
    ],
    [me.id],
  )

  return (
    <AppLayout current="SY-01">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>사용자 관리</h1>
            <p>역할에 따라 볼 수 있는 메뉴가 정해져요 · 역할별 권한은 권한 관리에서 바꿀 수 있어요</p>
          </div>
          {canEdit && <div className="page-top__right"><Button variant="primary" icon="plus" onClick={() => setEdit({ name: '', role: '현장 작업자', line: '가공', email: '', active: true })}>사용자 추가</Button></div>}
        </header>

        <section className="data-card" aria-label="사용자 목록">
          <FilterBar onReset={q.isDirty ? q.resetFilters : null} end={<SearchInput id="user-search" value={q.query} onChange={q.setQuery} placeholder="이름·이메일 검색" label="사용자 검색" />}>
            <FilterChip label="역할" options={ROLES} selected={q.values.role} onChange={(v) => q.setFilter('role', v)} />
            <FilterChip label="담당 라인" options={['전체', ...LINES]} selected={q.values.line} onChange={(v) => q.setFilter('line', v)} />
            <FilterChip label="상태" options={STATES} selected={q.values.state} onChange={(v) => q.setFilter('state', v)} />
          </FilterBar>
          <DataTable
            columns={columns}
            rows={q.pageRows}
            caption={`사용자 ${q.list.length}명`}
            sort={q.sort}
            onSort={q.cycleSort}
            minWidth={900}
            rowMenuLabel={canEdit ? (u) => `${u.name} 수정` : undefined}
            onRowMenu={(u) => setEdit(u)}
            empty={{ title: '조건에 맞는 사용자가 없어요', actionLabel: '필터 초기화', onAction: q.resetFilters }}
          />
          <ListFooter pagination={q.pagination} pageSize={q.pageSize} pageSizes={[20, 50]} onPageSize={q.setPageSize} onPage={q.setPage} />
        </section>

        <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? `${edit.name} 수정` : '사용자 추가'} closeButton>
          {edit && (
            <UserForm
              key={edit.id ?? 'new'}
              user={edit}
              isMe={edit.id === me.id}
              onCancel={() => setEdit(null)}
              onReset={() => toast(`${edit.name}의 비밀번호 초기화 메일을 보냈어요`)}
              onSave={(u) => { run('users/save', { user: u }); toast(edit.id ? `${u.name} 정보를 저장했어요` : `${u.name} 사용자를 추가했어요`); setEdit(null) }}
            />
          )}
        </Modal>
      </main>
    </AppLayout>
  )
}

/** 사용자 추가·수정 폼 — 라인 반장·현장 작업자만 담당 라인 필수, 현장 작업자는 이메일 없이 태블릿 PIN 로그인 */
function UserForm({ user, isMe, onSave, onCancel, onReset }) {
  const [f, setF] = useState(user)
  const [submitted, setSubmitted] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const needsLine = f.role === '라인 반장' || f.role === '현장 작업자'
  const errors = {
    name: !f.name.trim() && '이름을 입력하세요',
    email: f.role !== '현장 작업자' && !/^\S+@\S+\.\S+$/.test(f.email) && '이메일 형식을 확인하세요',
    line: needsLine && (!f.line || f.line === '전체') && '담당 라인을 선택하세요',
  }
  const err = (k) => (submitted && errors[k]) || undefined
  const save = () => {
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
    onSave({ ...f, name: f.name.trim(), line: needsLine ? f.line : '전체', lastLogin: f.lastLogin ?? '' })
  }
  return (
    <div className="user-form">
      <div className="user-form__fields">
        <Field label="이름" required error={err('name')}>{(p) => <TextInput {...p} value={f.name} onChange={(e) => set('name', e.target.value)} />}</Field>
        <Field label="역할" required help={isMe ? '내 역할은 바꿀 수 없어요' : undefined}>
          {(p) => <Select {...p} options={ROLES} value={f.role} onChange={(e) => set('role', e.target.value)} disabled={isMe} />}
        </Field>
        <Field label="담당 라인" required={needsLine} error={err('line')} help={!needsLine ? '이 역할은 전체 라인을 봐요' : undefined}>
          {(p) => <Select {...p} options={needsLine ? LINES : ['전체']} value={needsLine ? (f.line === '전체' ? '' : f.line) : '전체'} placeholder={needsLine ? '라인 선택' : undefined} onChange={(e) => set('line', e.target.value)} disabled={!needsLine} />}
        </Field>
        <Field label="이메일" required={f.role !== '현장 작업자'} error={err('email')} help={f.role === '현장 작업자' ? '현장 작업자는 태블릿 PIN으로 로그인해요' : undefined}>
          {(p) => <TextInput {...p} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />}
        </Field>
        <Field label="계정 상태">{() => <Segmented label="계정 상태" options={STATES} value={f.active ? '사용' : '사용 중지'} onChange={(v) => set('active', v === '사용')} disabled={isMe} />}</Field>
      </div>
      <div className="modal__foot user-form__foot">
        {user.id && <Button variant="ghost" onClick={onReset}>비밀번호 초기화</Button>}
        <span style={{ flex: 1 }} />
        <Button onClick={onCancel}>취소</Button>
        <Button variant="primary" onClick={save}>{user.id ? '저장' : '추가'}</Button>
      </div>
    </div>
  )
}
