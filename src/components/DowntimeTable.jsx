import { Link } from 'react-router-dom'
import { Dot, EmptyState } from './panels'
import { REASON_TONE } from '../constants/tones'
import { downtimeMinutes } from '../utils/mes'
import { formatDuration, shortStamp } from '../utils/clock'

/** 비가동 이력 표 (EQ-01 상세·EQ-02에서 같이 사용) */
export default function DowntimeTable({ rows, showEquip = false }) {
  if (!rows.length) return <EmptyState title="비가동 이력이 없어요" />
  return (
    <div className="table-scroll dt-table">
      <table className="simple-table">
        <thead>
          <tr>
            <th>시작</th><th>종료</th><th className="r">시간</th>
            {showEquip && <th>설비</th>}
            <th>사유</th><th>등록자</th><th>비고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const open = !d.end
            return (
              <tr key={d.id} className={open ? 'is-alert' : ''}>
                <td className="num"><strong>{shortStamp(d.start)}</strong></td>
                <td className={`num ${open ? 'is-danger' : ''}`}>{open ? '진행 중' : d.end.slice(11)}</td>
                <td className={`r num ${open ? 'is-danger' : ''}`}>{formatDuration(downtimeMinutes(d))}{open ? '째' : ''}</td>
                {showEquip && <td><Link to={`/equipment/${d.equip}`} className="cell-link num">{d.equip}</Link></td>}
                <td><Dot tone={REASON_TONE[d.reason] ?? 'neutral'}>{d.reason}</Dot></td>
                <td>{d.by}</td>
                <td className="muted">{d.woId ? <><Link to={`/work-orders/${d.woId}`} className="cell-link num">{d.woId}</Link>{open ? ' 일시정지' : ''}{d.note ? ` · ${d.note}` : ''}</> : d.note || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
