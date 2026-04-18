import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ResearchSessionData {
  address: string;
  lat: number;
  lng: number;
  price: number;
  area: number;
  builtYear: number;
  mode: "home" | "investment";
}

export async function saveResearchSession(
  uid: string,
  data: ResearchSessionData
): Promise<void> {
  const col = collection(db, "users", uid, "research_sessions");
  await addDoc(col, { ...data, createdAt: serverTimestamp() });
}
