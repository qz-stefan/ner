"use client";

import { FormEvent, useState } from "react";

interface Props {
  initialValue?: string;
  onSearch: (query: string) => void;
}

export function LetterSearchBar({ initialValue = "", onSearch }: Props) {
  const [value, setValue] = useState(initialValue);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(value.trim());
  }

  function clear() {
    setValue("");
    onSearch("");
  }

  return (
    <form className="letter-search" onSubmit={submit} role="search">
      <span className="search-symbol" aria-hidden="true">⌕</span>
      <label className="sr-only" htmlFor="letter-search-input">检索书信</label>
      <input
        id="letter-search-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="检索书信：输入收信人、时间或原文关键词"
        autoComplete="off"
      />
      {value ? <button className="search-clear" type="button" onClick={clear}>清除</button> : null}
      <button className="search-submit" type="submit">检索</button>
    </form>
  );
}
