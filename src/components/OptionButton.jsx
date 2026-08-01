import { CheckCircle2, XCircle } from 'lucide-react'

function OptionButton({
  correctOptionIndex,
  correctOptionIndices,
  disabled,
  isSelected,
  isAnswered,
  option,
  onClick,
  optionIndex,
  selectedCorrectly,
}) {
  const isCorrectOption =
    isAnswered &&
    (correctOptionIndices?.includes(optionIndex) || optionIndex === correctOptionIndex)
  const isIncorrectSelection = isAnswered && isSelected && !selectedCorrectly

  const baseClass =
    'group flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:cursor-not-allowed'

  const visualClass = isAnswered
    ? isCorrectOption
      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-50'
      : isIncorrectSelection
        ? 'border-rose-400/50 bg-rose-500/15 text-rose-50'
        : 'border-slate-700 bg-slate-900/50 text-slate-300 opacity-80'
    : 'border-slate-700 bg-slate-900/40 text-slate-100 hover:border-cyan-400/40 hover:bg-slate-900'

  return (
    <button
      type="button"
      className={`${baseClass} ${visualClass}`}
      disabled={disabled}
      onClick={() => onClick(optionIndex)}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
          isAnswered
            ? isCorrectOption
              ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100'
              : isIncorrectSelection
                ? 'border-rose-300 bg-rose-400/20 text-rose-100'
                : 'border-slate-600 bg-slate-950/50 text-slate-400'
            : 'border-slate-600 bg-slate-950/50 text-slate-300 group-hover:border-cyan-400 group-hover:text-cyan-200'
        }`}
      >
        {String.fromCharCode(65 + optionIndex)}
      </span>

      <span className="flex-1 text-sm leading-6 sm:text-base">{option.text}</span>

      {isAnswered ? (
        selectedCorrectly && isSelected ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
        ) : isIncorrectSelection ? (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
        ) : isCorrectOption ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
        ) : null
      ) : null}
    </button>
  )
}

export default OptionButton