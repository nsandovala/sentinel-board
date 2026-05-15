import { Suspense } from "react";
import { BoardView } from "@/components/board/board-view";

export default function BoardPage() {
  return (
    <Suspense fallback={null}>
      <BoardView />
    </Suspense>
  );
}
