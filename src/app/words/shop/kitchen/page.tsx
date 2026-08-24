import { Suspense } from "react";
import WordsWorkspace from "../../WordsWorkspace";

export default function ShopKitchenPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="shopKitchen" />
    </Suspense>
  );
}
