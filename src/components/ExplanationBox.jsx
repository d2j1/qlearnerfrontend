function ExplanationBox({ isVisible, explanation }) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-emerald-400/20 bg-emerald-500/10 transition-all duration-300 ${
        isVisible ? 'mt-5 max-h-64 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Explanation</p>
        <p className="mt-2 text-sm leading-6 text-emerald-50/90">{explanation}</p>
      </div>
    </div>
  )
}

export default ExplanationBox