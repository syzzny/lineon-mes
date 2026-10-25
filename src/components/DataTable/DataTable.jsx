import Icon from '../Icon'
import { Button, Checkbox, IconButton } from '../ui'
import './DataTable.scss'

/**
 * DataTable — 업무형 목록 공통 표
 *
 * @param columns  [{ key, header, render(row), width?, align?, sortable? }]
 * @param rows     현재 페이지 행
 * @param getRowId (row) => 고유 id
 * @param caption  스크린리더용 표 설명
 * @param selection { selected: Set, onToggle(id), onToggleMany(ids, on) }  — 없으면 체크박스 열 숨김
 * @param sort      { key, dir }   onSort(key)
 * @param rowMenuLabel  (row) => 행 끝 "더보기" 버튼 라벨. 없으면 열 숨김
 * @param empty     { title, description, actionLabel, onAction }
 */
export default function DataTable({
  columns,
  rows,
  getRowId = (r) => r.id,
  caption,
  selection,
  sort,
  onSort,
  rowMenuLabel,
  onRowMenu,
  empty,
  minWidth = 1080,
}) {
  const ids = rows.map(getRowId)
  const selectedOnPage = selection ? ids.filter((id) => selection.selected.has(id)).length : 0
  const allChecked = rows.length > 0 && selectedOnPage === rows.length
  const someChecked = selectedOnPage > 0 && !allChecked

  const ariaSort = (col) => {
    if (!col.sortable) return undefined
    if (sort?.key !== col.key) return 'none'
    return sort.dir === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <div className="table-wrap">
      <table className="table" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {selection && (
              <th className="table__check">
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  onChange={() => selection.onToggleMany(ids, !allChecked)}
                  label="현재 페이지 전체 선택"
                />
              </th>
            )}
            {columns.map((col) => (
              <th key={col.key} scope="col" aria-sort={ariaSort(col)} style={{ width: col.width, textAlign: col.align }}>
                {col.sortable ? (
                  <button
                    type="button"
                    className={`table__sort ${sort?.key === col.key ? 'is-on' : ''}`}
                    onClick={() => onSort?.(col.key)}
                  >
                    {col.header} <Icon name="sort" size={13} />
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
            {rowMenuLabel && <th className="table__more"><span className="sr-only">더보기</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row)
            const on = selection?.selected.has(id)
            return (
              <tr key={id} className={on ? 'is-selected' : ''}>
                {selection && (
                  <td className="table__check">
                    <Checkbox checked={on} onChange={() => selection.onToggle(id)} label={`${id} 선택`} />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                {rowMenuLabel && (
                  <td className="table__more">
                    <IconButton icon="more" label={rowMenuLabel(row)} className="table__row-menu" onClick={() => onRowMenu?.(row)} />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {rows.length === 0 && empty && (
        <div className="table__empty">
          <Icon name="inbox" size={32} />
          <strong>{empty.title}</strong>
          {empty.description && <p>{empty.description}</p>}
          {empty.actionLabel && <Button onClick={empty.onAction}>{empty.actionLabel}</Button>}
        </div>
      )}
    </div>
  )
}
