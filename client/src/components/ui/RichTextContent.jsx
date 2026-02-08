import DOMPurify from "dompurify"
import { useMemo, useState, useCallback } from "react"
import { cn } from "@/lib/utils"

const isHtmlContent = (content) => {
  if (!content) return false
  return /<[a-z][\s\S]*>/i.test(content)
}

const RichTextContent = ({ content, className, expandable = true, maxHeight = 100 }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [needsExpansion, setNeedsExpansion] = useState(false)

  const sanitizedHtml = useMemo(() => {
    if (!content) return ""
    if (!isHtmlContent(content)) return null

    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "s",
        "code",
        "a",
        "h1",
        "h2",
        "ul",
        "ol",
        "li",
        "blockquote",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class"],
    })
  }, [content])

  const contentRef = useCallback(
    (node) => {
      if (node && expandable) {
        setNeedsExpansion(node.scrollHeight > maxHeight)
      }
    },
    [expandable, maxHeight],
  )

  const toggleExpand = useCallback(() => setIsExpanded((prev) => !prev), [])

  if (!content) return null

  if (sanitizedHtml === null) {
    return (
      <div className={cn("whitespace-pre-line", className)}>
        <div ref={contentRef} className={!isExpanded && needsExpansion ? "line-clamp-3" : ""}>
          {content}
        </div>
        {needsExpansion && (
          <button
            onClick={toggleExpand}
            className="text-blue-500 dark:text-blue-400 hover:underline mt-1 text-sm"
          >
            {isExpanded ? "Read Less" : "Read More"}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={cn("rich-text-content", className)}>
      <div
        ref={contentRef}
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "[&_p]:my-1 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-2",
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:my-2",
          "[&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4",
          "[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm",
          "[&_a]:text-blue-500 [&_a]:underline [&_a]:hover:text-blue-600",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-muted [&_blockquote]:pl-3 [&_blockquote]:italic",
          !isExpanded && needsExpansion && "line-clamp-3",
        )}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      {needsExpansion && (
        <button
          onClick={toggleExpand}
          className="text-blue-500 dark:text-blue-400 hover:underline mt-1 text-sm"
        >
          {isExpanded ? "Read Less" : "Read More"}
        </button>
      )}
    </div>
  )
}

export default RichTextContent
