import React from "react";

const paths = {
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5",
  chat: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z",
  panelLeft: "M9 3v18 M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
  panelRight: "M15 3v18 M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
  play: "m9 5 10 7-10 7V5Z",
  map: "M4 9h6v6H4z M16 3h5v5h-5z M16 16h5v5h-5z M10 12h3 M13 5.5v13 M13 5.5h3 M13 18.5h3",
  back: "m12 19-7-7 7-7 M5 12h14",
  forward: "m12 5 7 7-7 7 M5 12h14",
  chevron: "m6 9 6 6 6-6",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  close: "m6 6 12 12 M18 6 6 18",
  download: "M12 3v12 m-5-5 5 5 5-5 M5 17v4h14v-4",
  folder: "M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
  git: "M6 3v12 M18 6v5a4 4 0 0 1-4 4H6 M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  send: "m22 2-7 20-4-9-9-4 20-7Z M22 2 11 13",
  check: "m5 12 4 4L19 6",
};
export function Icon({name, size=16, className=""}) {
  return <svg className={"lp-icon "+className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name] || paths.file}/></svg>;
}
