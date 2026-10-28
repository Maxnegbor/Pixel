import { useEffect, useRef, useState } from "react";
import { drawItem, loadCollectibleArt } from "../lib/art";
import type { Item } from "../lib/types";
export default function ItemArt({
  item,
  size = 80,
}: {
  item: Item;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void loadCollectibleArt()
      .then(() => {
        if (!live) return;
        const c = ref.current?.getContext("2d");
        if (c) {
          c.clearRect(0, 0, 160, 160);
          drawItem(c, item, 8, 8, 144, 137);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [item]);
  return failed ? (
    <span className="sprite-fallback" title={item.name}>
      ✧
    </span>
  ) : (
    <canvas
      aria-label={item.name}
      role="img"
      ref={ref}
      width="160"
      height="160"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}
