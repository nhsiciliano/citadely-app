import type { BlogBlock } from "@/lib/blog";

export function BlogContent({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="space-y-7 text-[var(--color-ink)]">
      {blocks.map((block, index) => {
        const key = block.id ?? `${block.position}-${index}`;
        if (block.kind === "heading2") return <h2 className="font-display pt-5 text-3xl font-semibold leading-tight tracking-[-0.03em] text-[var(--color-navy)]" key={key}>{block.content}</h2>;
        if (block.kind === "heading3") return <h3 className="font-display pt-3 text-2xl font-semibold leading-tight text-[var(--color-navy)]" key={key}>{block.content}</h3>;
        if (block.kind === "quote") return <blockquote className="border-l-2 border-[var(--color-primary)] pl-6 font-display text-2xl leading-snug text-[var(--color-navy)]" key={key}>{block.content}</blockquote>;
        if (block.kind === "ordered_list" || block.kind === "unordered_list") {
          const items = block.content.split("\n").map((item) => item.trim()).filter(Boolean);
          const className = "ml-7 space-y-2 text-[1.06rem] leading-8 text-[var(--color-ink-soft)] marker:text-[var(--color-primary)]";
          return block.kind === "ordered_list"
            ? <ol className={`${className} list-decimal`} key={key}>{items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{item}</li>)}</ol>
            : <ul className={`${className} list-disc`} key={key}>{items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{item}</li>)}</ul>;
        }
        return <p className="whitespace-pre-line text-[1.06rem] leading-8 text-[var(--color-ink-soft)]" key={key}>{block.content}</p>;
      })}
    </div>
  );
}
