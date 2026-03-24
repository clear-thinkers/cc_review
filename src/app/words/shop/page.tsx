import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="shop" />
    </Suspense>
  );
}
