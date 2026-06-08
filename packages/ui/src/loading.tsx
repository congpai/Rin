import type { ReactNode } from "react";
import { ChickenLoader } from "./chicken-loader";

export function Waiting({
  for: wait,
  children,
}: {
  for?: unknown;
  children?: ReactNode;
}) {
  return !wait ? (
    <div className="w-full h-96 flex flex-col justify-center items-center mb-8 ani-show-fast">
      <ChickenLoader />
    </div>
  ) : (
    <>{children}</>
  );
}