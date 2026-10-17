import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

// LLM- and user-written content: raw HTML is never rendered (react-markdown ignores it without
// rehype-raw) and unsafe link protocols are stripped by the default urlTransform.
function Markdown({ children, className = '', style }) {
  return (
    <div className={`markdown-body ${className}`} style={style}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]} skipHtml>
        {children ?? ''}
      </ReactMarkdown>
    </div>
  )
}

export default Markdown
