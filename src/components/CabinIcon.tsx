type Name = "focus" | "inventory" | "shop" | "boxes" | "sounds" | "stats";
export default function CabinIcon({ name }: { name: string }) {
  const paths: Record<Name, React.ReactNode> = {
    focus: (
      <>
        <path d="M12 2h8v3h-8zM14 5h4v3h-4z" />
        <path
          d="M9 8h14v3h3v14h-3v3H9v-3H6V11h3zm1 3v13h12V11z"
          fillRule="evenodd"
        />
        <path d="M15 12h2v6h5v2h-7z" />
      </>
    ),
    inventory: (
      <>
        <path d="M10 3h12v5h5v21H5V8h5zm3 3v2h6V6z" fillRule="evenodd" />
        <path d="M9 11h14v9H9z" fill="#55402a" />
        <path d="M9 12h14v2H9zm5 5h4v6h-4zM7 25h18v2H7z" />
      </>
    ),
    shop: (
      <>
        <path d="M12 2h8v3h3v4h3v18H6V9h3V5h3zm0 3v4h8V5z" fillRule="evenodd" />
        <path d="M9 12h14v12H9z" fill="#715235" />
        <path d="M15 12h2v4h3v5h-2v3h-6v-3h-1v-4h3v-2h1z" fill="#f0c477" />
        <path d="M4 27h24v3H4z" />
      </>
    ),
    boxes: (
      <>
        <path
          d="M5 6h22v3h3v19H2V9h3zm0 4v5h22v-5zm0 9v6h22v-6z"
          fillRule="evenodd"
        />
        <path d="M13 12h6v10h-6z" fill="#e6bd72" />
        <path d="M15 15h2v4h-2z" fill="#4b3523" />
      </>
    ),
    sounds: (
      <>
        <path d="M6 4h2v6h4v2h5V5h2v23h-2v-9h-5v2H8v6H6zm15 5h2v3h2v11h-2v3h-2v-3h2V12h-2z" />
        <path d="M9 12h3v8H9z" fill="#e9c681" />
      </>
    ),
    stats: (
      <>
        <path d="M6 4h21v25H6V4H3v25h3zm3 3v19h15V7z" fillRule="evenodd" />
        <path d="M11 10h11v2H11zm0 5h11v2H11zm0 5h8v2h-8z" />
      </>
    ),
  };
  return (
    <svg
      className="cabin-icon"
      width="28"
      height="28"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
      fill="currentColor"
    >
      {paths[name as Name] || paths.focus}
    </svg>
  );
}
