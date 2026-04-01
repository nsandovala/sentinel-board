// lib/data.ts
export type BoardTask = {
    id: string;
    title: string;
    status: string;
    priority: string;
    repo: string;
    createdAt: string;
  };
  
  export type BoardAgent = {
    name?: string;
    status?: string;
  };
  
  export type BoardLog = {
    id?: string;
    message?: string;
  };
  
  export type BoardData = {
    tasks: BoardTask[];
    agents: BoardAgent[];
    logs: BoardLog[];
  };
  
  export async function loadBoardData(): Promise<BoardData> {
    const res = await fetch("/data/mock.json", { cache: "no-store" });
  
    if (!res.ok) {
      throw new Error("No se pudo cargar /data/mock.json");
    }
  
    return res.json();
  }