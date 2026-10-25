import { Link } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import './ComingSoon.scss'

/** 아직 퍼블리싱하지 않은 화면 — Figma 시안만 있는 상태 */
export default function ComingSoon({ screen }) {
  return (
    <AppLayout current={screen?.key}>
      <main className="page">
        <section className="data-card coming-soon">
          <span className="coming-soon__icon"><Icon name="clip" size={28} /></span>
          {screen ? (
            <>
              <p className="coming-soon__id num">{screen.key}</p>
              <h1>{screen.label}</h1>
              <p>이 화면은 Figma 시안까지 완료했고, 퍼블리싱은 준비 중이에요.</p>
            </>
          ) : (
            <>
              <h1>페이지를 찾을 수 없어요</h1>
              <p>주소가 바뀌었거나 없는 화면이에요.</p>
            </>
          )}
          <Link to="/" className="btn btn--primary">첫 화면으로</Link>
        </section>
      </main>
    </AppLayout>
  )
}
