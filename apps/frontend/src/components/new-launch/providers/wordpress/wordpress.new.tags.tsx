'use client';

import { FC, KeyboardEvent, useEffect, useState } from 'react';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';

// x-hakt: tags the site doesn't have yet. The tag list above only offers existing tags; names
// typed here are kept in the post settings and created on the site (WordPress POST /tags) when
// the post publishes or previews. A name the site already has is reused, not duplicated.
export const WordpressNewTags: FC<{
  name: string;
  onChange: (event: { target: { value: string[]; name: string } }) => void;
}> = (props) => {
  const { name, onChange } = props;
  const form = useSettings();
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const settings = form.getValues()[name];
    if (Array.isArray(settings)) setTags(settings.map(String));
  }, []);

  const save = (next: string[]) => {
    setTags(next);
    form.setValue(name, next, { shouldValidate: true });
    onChange?.({ target: { name, value: next } });
  };

  const add = () => {
    const names = draft
      .split(',')
      .map((tag) => tag.trim().replace(/^#+/, '').trim())
      .filter((tag) => tag && tag.length <= 50);
    const next = [...tags];
    for (const tag of names) {
      if (!next.some((current) => current.toLowerCase() === tag.toLowerCase())) next.push(tag);
    }
    setDraft('');
    if (next.length !== tags.length) save(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add();
    }
  };

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="text-[14px]">New tags</div>
      {!!tags.length && (
        <div className="flex flex-wrap gap-[6px]">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-[6px] bg-newBgColorInner border border-newTableBorder rounded-[6px] ps-[10px] pe-[6px] py-[3px] text-[14px]"
            >
              #{tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                className="opacity-60 hover:opacity-100 px-[4px]"
                onClick={() => save(tags.filter((current) => current !== tag))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-[8px]">
        <div className="bg-newBgColorInner h-[42px] border-newTableBorder border rounded-[8px] flex items-center flex-1">
          <input
            className="h-full bg-transparent outline-none flex-1 text-[14px] text-textColor px-[16px]"
            placeholder="Type a tag, press Enter (e.g. SquareEnix)"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <button
          type="button"
          className="h-[42px] px-[16px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] disabled:opacity-50"
          disabled={!draft.trim()}
          onClick={add}
        >
          Add
        </button>
      </div>
    </div>
  );
};
