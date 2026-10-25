import { useEffect, useMemo, useState } from 'react'

/** 탭 안에서만 유지되는 저장 (상세에 다녀와도 검색조건 유지) */
const readSaved = (key) => {
  if (!key) return null
  try {
    return JSON.parse(sessionStorage.getItem(key))
  } catch {
    return null
  }
}

/**
 * 목록 화면 공통 로직: 필터 → 보기 탭 → 정렬 → 페이지
 *
 * @param rows      원본 데이터
 * @param options.filters   { key: { initial, match(row, value) } }  값이 비면 필터를 건너뜀
 * @param options.views     [{ key, test(row) }]  저장된 보기 탭
 * @param options.sorters   { key: (a, b) => number }
 * @param options.search    (row) => 검색 대상 문자열 배열
 * @param options.pageSize  초기 페이지 크기
 * @param options.persistKey  주면 검색조건·정렬·페이지를 기억해서 목록으로 돌아왔을 때 복원
 */
export default function useListQuery(rows, { filters = {}, views = [], sorters = {}, search, pageSize: initialSize = 20, persistKey }) {
  const initialFilters = useMemo(
    () => Object.fromEntries(Object.entries(filters).map(([k, f]) => [k, f.initial ?? []])),
    // 초기값은 최초 1회만 계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [saved] = useState(() => readSaved(persistKey))

  const [values, setValues] = useState(saved?.values ?? initialFilters)
  const [query, setQueryState] = useState(saved?.query ?? '')
  const [view, setViewState] = useState(saved?.view ?? views[0]?.key ?? null)
  const [sort, setSort] = useState(saved?.sort ?? null) // { key, dir: 'asc' | 'desc' } | null
  const [page, setPage] = useState(saved?.page ?? 1)
  const [pageSize, setPageSizeState] = useState(saved?.pageSize ?? initialSize)

  useEffect(() => {
    if (!persistKey) return
    try {
      sessionStorage.setItem(persistKey, JSON.stringify({ values, query, view, sort, page, pageSize }))
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [persistKey, values, query, view, sort, page, pageSize])

  // 조건이 바뀌면 1페이지로
  const setFilter = (key, value) => { setValues((v) => ({ ...v, [key]: value })); setPage(1) }
  const setQuery = (q) => { setQueryState(q); setPage(1) }
  const setView = (v) => { setViewState(v); setPage(1) }
  const setPageSize = (n) => { setPageSizeState(n); setPage(1) }
  const resetFilters = () => { setValues(initialFilters); setQueryState(''); setPage(1) }

  /** 정렬 순환: 오름차순 → 내림차순 → 해제 */
  const cycleSort = (key) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))

  const isDirty =
    Boolean(query) ||
    Object.keys(values).some((k) => JSON.stringify(values[k]) !== JSON.stringify(initialFilters[k]))

  // 1) 필터 + 검색 (보기 탭 적용 전 — 탭별 건수 계산용)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      for (const [k, f] of Object.entries(filters)) {
        const v = values[k]
        if (v && (!Array.isArray(v) || v.length) && !f.match(row, v)) return false
      }
      if (q && search) return search(row).some((s) => s.toLowerCase().includes(q))
      return true
    })
    // filters·search는 화면에서 상수로 넘기므로 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, values, query])

  const viewCounts = useMemo(
    () => Object.fromEntries(views.map((v) => [v.key, filtered.filter(v.test).length])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  )

  // 2) 보기 탭 + 정렬
  const list = useMemo(() => {
    const v = views.find((x) => x.key === view)
    const out = v ? filtered.filter(v.test) : [...filtered]
    if (sort && sorters[sort.key]) {
      const dir = sort.dir === 'asc' ? 1 : -1
      out.sort((a, b) => dir * sorters[sort.key](a, b))
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, view, sort])

  // 3) 페이지
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize
  const pageRows = list.slice(start, start + pageSize)

  return {
    // 상태
    values, query, view, sort, pageSize, isDirty,
    // 결과
    list, pageRows, viewCounts,
    pagination: { page: currentPage, pageCount, from: list.length ? start + 1 : 0, to: start + pageRows.length, total: list.length },
    // 변경
    setFilter, setQuery, setView, cycleSort, setPage, setPageSize, resetFilters,
  }
}
