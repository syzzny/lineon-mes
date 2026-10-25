// Figma "Brand/Logo" — 생산 라인(가로 막대 3개) + 가동 중(초록 점)
export default function Logo() {
  return (
    <span className="logo" aria-label="LineOn MES">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect width="34" height="34" rx="10" fill="var(--brand-primary)" />
        <rect x="8" y="9.5" width="11" height="3.4" rx="1.7" fill="#fff" />
        <rect x="8" y="15.3" width="18" height="3.4" rx="1.7" fill="#fff" opacity="0.9" />
        <rect x="8" y="21.1" width="14" height="3.4" rx="1.7" fill="#fff" opacity="0.75" />
        <circle cx="25" cy="11.2" r="2.6" fill="#5BE49B" />
      </svg>
      <span className="logo__word num">
        Line<em>On</em>
      </span>
      <span className="logo__tag num">MES</span>
    </span>
  )
}
