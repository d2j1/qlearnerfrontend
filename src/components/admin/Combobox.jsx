import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { inputClass } from './ui'

// Dropdown of existing values that also accepts a new one typed in.
function Combobox({ value, onChange, options, placeholder, loading = false, newLabel = 'New' }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef(null)
  const listId = useId()

  useEffect(() => {
    if (!open) {
      return undefined
    }
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const typed = value.trim()
  const exactMatch = options.some((option) => option.toLowerCase() === typed.toLowerCase())
  // Show everything when the box holds an existing value, so picking a different one is easy.
  const filtered = exactMatch || !typed ? options : options.filter((option) => option.toLowerCase().includes(typed.toLowerCase()))
  const items = [...(typed && !exactMatch ? [{ value: typed, isNew: true }] : []), ...filtered.map((option) => ({ value: option, isNew: false }))]

  const choose = (next) => {
    onChange(next)
    setOpen(false)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlight((current) => Math.min(current + 1, items.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && open && items[highlight]) {
      event.preventDefault()
      choose(items[highlight].value)
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative mt-1">
      <input
        className={`${inputClass} pr-10`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value)
          setHighlight(0)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show options"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-cyan-200"
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 py-1 shadow-2xl shadow-black/50"
        >
          {loading ? <li className="px-4 py-2 text-sm text-slate-500">Loading…</li> : null}
          {!loading && !items.length ? <li className="px-4 py-2 text-sm text-slate-500">No existing values. Type to add a new one.</li> : null}
          {items.map((item, index) => (
            <li
              key={`${item.isNew}-${item.value}`}
              role="option"
              aria-selected={item.value === value}
              className={`flex cursor-pointer items-center gap-2 px-4 py-2 text-sm ${
                index === highlight ? 'bg-slate-800 text-white' : 'text-slate-200'
              }`}
              onMouseEnter={() => setHighlight(index)}
              // pointerdown so the choice lands before the input loses focus
              onPointerDown={(event) => {
                event.preventDefault()
                choose(item.value)
              }}
            >
              {item.isNew ? (
                <>
                  <Plus className="h-4 w-4 text-emerald-300" />
                  <span>
                    {newLabel}: <span className="font-medium text-emerald-200">“{item.value}”</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="w-4">{item.value === value ? <Check className="h-4 w-4 text-cyan-300" /> : null}</span>
                  <span className="truncate">{item.value}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default Combobox
