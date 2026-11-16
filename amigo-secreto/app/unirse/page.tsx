import { Suspense } from "react";
import JoinForm from "@/components/JoinForm";

export default function Unirse() {
  // JoinForm reads ?c=CODE on the client, which needs a Suspense boundary.
  return (
    <Suspense fallback={<main className="screen" />}>
      <JoinForm />
    </Suspense>
  );
}
