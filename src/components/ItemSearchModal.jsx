/** CM-P01 품목 검색 팝업 — 품목군 + 검색어로 좁히고, 라디오로 하나 선택 (더블클릭하면 바로 선택) */
import { useMemo, useState } from 'react'
import Icon from './Icon'
import { Button } from './ui'
import { Modal } from './feedback'
import { Select } from './form'
import { useMes } from '../store/MesStore'
import './ItemSearchModal.scss'

export default function ItemSearchModal({ open, initialCode, onSelect, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="품목 검색" description="작업지시에 사용할 품목을 선택하세요" size="lg" closeButton>
      {/* open 될 때마다 내부 상태를 새로 시작 */}
      {open && <ItemSearchBody initialCode={initialCode} onSelect={onSelect} onClose={onClose} />}
    </Modal>
  )
}

function ItemSearchBody({ initialCode, onSelect, onClose }) {
  const [group, setGroup] = useState('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(initialCode ?? null)
  const { items } = useMes() // 품목 관리(MD-01)에서 바꾼 내용이 바로 반영됨 (사용 중지 품목 제외)
  const ITEMS = useMemo(() => items.filter((i) => i.active !== false), [items])
  const ITEM_GROUPS = [...new Set(ITEMS.map((i) => i.group))]

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ITEMS.filter((i) => (!group || i.group === group) && (!q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)))
  }, [ITEMS, group, query])

  const pickedItem = ITEMS.find((i) => i.code === picked)

  return (
    <div className="item-search">
      <div className="item-search__filters">
        <Select aria-label="품목군" options={ITEM_GROUPS} placeholder="전체 품목군" value={group} onChange={(e) => setGroup(e.target.value)} />
        <label className="list-search item-search__q">
          <Icon name="search" size={15} />
          <input autoFocus type="search" aria-label="품목명 또는 코드" placeholder="품목명 또는 코드" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <div className="item-search__meta">
        <strong>검색 결과 <span className="num">{results.length}</span>건</strong>
        <span>행을 더블클릭하면 바로 선택돼요</span>
      </div>

      <div className="item-search__table" role="radiogroup" aria-label="품목 목록">
        <div className="item-search__row is-head" aria-hidden="true">
          <span /><span>품목코드</span><span>품목명</span><span>품목군</span><span>표준 공정</span>
        </div>
        {results.map((i) => (
          <label
            key={i.code}
            className={`item-search__row ${picked === i.code ? 'is-on' : ''}`}
            onDoubleClick={() => onSelect(i)}
          >
            <input type="radio" name="item" checked={picked === i.code} onChange={() => setPicked(i.code)} />
            <span className="num">{i.code}</span>
            <span className="item-search__name">{i.name}</span>
            <span>{i.group}</span>
            <span className="item-search__route">{i.route.join(' → ')}</span>
          </label>
        ))}
        {results.length === 0 && <p className="item-search__empty">검색 결과가 없어요. 품목군이나 검색어를 바꿔 보세요.</p>}
      </div>

      <div className="item-search__foot">
        <span>
          {pickedItem ? (
            <><Icon name="check" size={16} /> <strong className="num">{pickedItem.code}</strong> {pickedItem.name}</>
          ) : (
            '품목을 선택하세요'
          )}
        </span>
        <div>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={!pickedItem} onClick={() => onSelect(pickedItem)}>선택</Button>
        </div>
      </div>
    </div>
  )
}
