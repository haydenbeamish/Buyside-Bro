export function MarkdownSection({ content }: { content: string }) {
  const sections = content.split(/(?=^## )/m);

  return (
    <div className="space-y-6 prose prose-invert max-w-none">
      {sections.map((section, idx) => {
        const lines = section.trim().split("\n");
        const titleMatch = lines[0]?.match(/^## (.+)/);
        const title = titleMatch ? titleMatch[1].replace(/\*\*/g, "") : null;
        const body = title ? lines.slice(1).join("\n").trim() : section.trim();

        if (!body && !title) return null;

        return (
          <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 sm:p-5">
            {title && (
              <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {title}
              </h3>
            )}
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {body.split("\n").map((line, i) => {
                const clean = line.replace(/\*\*/g, "");
                if (line.startsWith("- ") || line.startsWith("* ")) {
                  return (
                    <div key={i} className="flex items-start gap-2 mb-1">
                      <span className="text-amber-500 mt-1">&bull;</span>
                      <span>{clean.substring(2)}</span>
                    </div>
                  );
                }
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <p key={i} className="font-semibold text-white mb-2">{clean}</p>;
                }
                if (line.trim() === "") return <br key={i} />;
                return <p key={i} className="mb-1">{clean}</p>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
