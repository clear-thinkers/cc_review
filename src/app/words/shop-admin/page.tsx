import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function ShopAdminPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="shopAdmin" />
    </Suspense>
  );
}
