import { pictoKind, pictoLabel } from "@/lib/pictograms";

/**
 * Vereinfachte Darstellung von GHS- und ISO-7010-Zeichen: genormte Form und Farbe,
 * Code als Text. (Die Originalgrafiken können später als Bilddateien hinterlegt werden.)
 */
export function Pictogram({ code, size = 56 }: { code: string; size?: number }) {
  const kind = pictoKind(code);
  const label = pictoLabel(code);
  const text = (fill: string, y = 54) => (
    <text x="50" y={y} textAnchor="middle" fontSize="18" fontWeight="700" fill={fill} fontFamily="Arial, sans-serif">{code}</text>
  );
  let body;
  switch (kind) {
    case "ghs":
      body = (<><rect x="18" y="18" width="64" height="64" transform="rotate(45 50 50)" fill="#fff" stroke="#d50000" strokeWidth="7" />{text("#000")}</>);
      break;
    case "mandatory":
      body = (<><circle cx="50" cy="50" r="44" fill="#005ca8" />{text("#fff")}</>);
      break;
    case "prohibition":
      body = (<><circle cx="50" cy="50" r="40" fill="#fff" stroke="#c4161c" strokeWidth="9" /><line x1="22" y1="22" x2="78" y2="78" stroke="#c4161c" strokeWidth="9" />{text("#000", 46)}</>);
      break;
    case "warning":
      body = (<><polygon points="50,8 94,88 6,88" fill="#f9c80e" stroke="#000" strokeWidth="5" strokeLinejoin="round" />{text("#000", 72)}</>);
      break;
    case "safe":
      body = (<><rect x="6" y="6" width="88" height="88" rx="6" fill="#008a4b" />{text("#fff")}</>);
      break;
    default:
      body = text("#475569");
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
      <title>{`${code} – ${label}`}</title>
      {body}
    </svg>
  );
}
