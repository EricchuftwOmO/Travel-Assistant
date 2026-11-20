// Renders the small Markdown subset the model uses in answers: paragraphs, "- " / "1. " lists,
// "#" headings, **bold**, *italic* and `code`. It builds React elements from plain text, so
// nothing in an answer can inject HTML.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function inline(text, keyPrefix) {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={key}>{part.slice(1, -1)}</code>;
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      if (part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export default function ChatMarkdown({ text }) {
  const blocks = [];
  let list = null; // { ordered, items }

  const closeList = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    const index = blocks.length;
    blocks.push(
      <Tag key={`list-${index}`}>
        {list.items.map((item, i) => (
          <li key={i}>{inline(item, `li-${index}-${i}`)}</li>
        ))}
      </Tag>
    );
    list = null;
  };

  text.split(/\r?\n/).forEach((line, i) => {
    const bullet = line.match(BULLET);
    const numbered = !bullet && line.match(NUMBERED);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) closeList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet || numbered)[1]);
      return;
    }
    closeList();
    if (!line.trim()) return;
    const heading = line.match(HEADING);
    blocks.push(
      heading ? (
        <p key={i} className="chat-md-heading">{inline(heading[1], `h-${i}`)}</p>
      ) : (
        <p key={i}>{inline(line.trim(), `p-${i}`)}</p>
      )
    );
  });
  closeList();

  return <div className="chat-md">{blocks}</div>;
}
