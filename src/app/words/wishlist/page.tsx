import { Suspense } from "react";
import WordsWorkspace from "../WordsWorkspace";

export default function WishlistPage() {
  return (
    <Suspense fallback={null}>
      <WordsWorkspace page="wishlist" />
    </Suspense>
  );
}
